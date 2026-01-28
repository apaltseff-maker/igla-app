import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PriceRow = { product_id: string; color: string; unit_price: number };

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const cut_id = body?.cut_id as string | undefined;
  const counterparty_id = body?.counterparty_id as string | undefined;
  const prices = (body?.prices as PriceRow[] | undefined) ?? [];
  const allow_incomplete_prices = body?.allow_incomplete_prices === true;

  if (!cut_id) {
    return NextResponse.json({ error: "cut_id обязателен" }, { status: 400 });
  }
  // counterparty_id может быть null для черновика
  if (!allow_incomplete_prices && !counterparty_id) {
    return NextResponse.json({ error: "counterparty_id обязателен" }, { status: 400 });
  }
  if (!allow_incomplete_prices && (!Array.isArray(prices) || prices.length === 0)) {
    return NextResponse.json({ error: "Нужны строки цен" }, { status: 400 });
  }

  // org_id из profiles (RLS по auth.uid())
  const { data: profile, error: eProf } = await supabase.from("profiles").select("org_id").single();
  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  // Проверим, что крой существует в этой org
  const { data: cut, error: eCut } = await supabase
    .from("cuts")
    .select("id, org_id, counterparty_id")
    .eq("id", cut_id)
    .single();

  if (eCut || !cut) {
    return NextResponse.json({ error: "Крой не найден" }, { status: 404 });
  }
  if (cut.org_id !== org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Проверим контрагента (если указан)
  if (counterparty_id) {
    const { data: cp, error: eCp } = await supabase
      .from("counterparties")
      .select("id, org_id")
      .eq("id", counterparty_id)
      .single();

    if (eCp || !cp) {
      return NextResponse.json({ error: "Контрагент не найден" }, { status: 404 });
    }
    if (cp.org_id !== org_id) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
  }

  // Проверяем, есть ли уже счёт по этому крою (upsert логика)
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("cut_id", cut_id)
    .eq("org_id", org_id)
    .maybeSingle();

  // Берём preview (planned/final/defect) по (product,color)
  const { data: preview, error: ePrev } = await supabase.rpc("invoice_preview_by_cut", { p_cut_id: cut_id });
  if (ePrev) {
    return NextResponse.json({ error: ePrev.message }, { status: 500 });
  }

  const priceMap = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.product_id}||${p.color ?? ""}`;
    const v = Number(p.unit_price);
    if (!allow_incomplete_prices && (!v || v <= 0 || !isFinite(v))) {
      return NextResponse.json({ error: "Цена должна быть > 0" }, { status: 400 });
    }
    if (v && v > 0 && isFinite(v)) {
      priceMap.set(key, v);
    }
  }

  const lines = (preview ?? []).map((r: any) => {
    const product_id = r.product_id as string;
    const color = (r.color as string) ?? "";
    const key = `${product_id}||${color}`;
    const unit_price = priceMap.get(key) ?? 0;

    const planned_qty = Number(r.planned_qty ?? 0);
    const final_qty = Number(r.final_qty ?? 0);

    const planned_amount = Math.round(planned_qty * unit_price * 100) / 100;
    const final_amount = Math.round(final_qty * unit_price * 100) / 100;

    return {
      org_id,
      line_type: "work",
      product_id,
      color,
      unit_price,
      planned_qty,
      final_qty,
      planned_amount,
      final_amount,
    };
  });

  // planned_total
  const planned_total = Math.round(lines.reduce((s: number, x) => s + (x.planned_amount ?? 0), 0) * 100) / 100;
  const final_total = Math.round(lines.reduce((s: number, x) => s + (x.final_amount ?? 0), 0) * 100) / 100;

  let invoice_id: string;

  if (existing?.id) {
    // Обновляем существующий invoice
    invoice_id = existing.id;

    const updateData: any = {
      planned_amount: planned_total,
      final_amount: final_total,
      current_amount: planned_total,
    };

    // Обновляем counterparty_id только если он пришёл (не null)
    if (counterparty_id !== undefined) {
      updateData.counterparty_id = counterparty_id;
    }

    // Обновляем issue_date, basis и status только если это не черновик
    if (!allow_incomplete_prices) {
      updateData.issue_date = new Date().toISOString().slice(0, 10);
      updateData.basis = "planned";
      updateData.status = "waiting_payment"; // Переводим из draft в waiting_payment
    }

    const { error: eInvUpd } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoice_id)
      .eq("org_id", org_id);

    if (eInvUpd) {
      return NextResponse.json({ error: eInvUpd.message }, { status: 500 });
    }

    // Удаляем старые work-строки (только work, чтобы не удалить service/inventory)
    // SAFEGUARD: строго по invoice_id + org_id + line_type='work' для безопасности
    const { error: eDel } = await supabase
      .from("invoice_lines")
      .delete()
      .eq("invoice_id", invoice_id)
      .eq("org_id", org_id)
      .eq("line_type", "work");

    if (eDel) {
      return NextResponse.json({ error: eDel.message }, { status: 500 });
    }

    // Вставляем новые work-строки
    const { error: eLines } = await supabase.from("invoice_lines").insert(
      lines.map((l) => ({
        ...l,
        invoice_id,
      }))
    );

    if (eLines) {
      return NextResponse.json({ error: eLines.message }, { status: 500 });
    }
  } else {
    // Создаём новый invoice
    const { data: invoice, error: eInv } = await supabase
      .from("invoices")
      .insert({
        org_id,
        cut_id,
        counterparty_id,
        issue_date: allow_incomplete_prices ? null : new Date().toISOString().slice(0, 10),
        status: allow_incomplete_prices ? "draft" : "waiting_payment",
        basis: allow_incomplete_prices ? null : "planned",
        planned_amount: planned_total,
        final_amount: final_total,
        current_amount: planned_total,
        paid_amount: 0,
      })
      .select("id")
      .single();

    if (eInv || !invoice?.id) {
      return NextResponse.json({ error: eInv?.message ?? "Не удалось создать счёт" }, { status: 500 });
    }

    invoice_id = invoice.id;

    // Вставляем строки
    const { error: eLines } = await supabase.from("invoice_lines").insert(
      lines.map((l) => ({
        ...l,
        invoice_id,
      }))
    );

    if (eLines) {
      return NextResponse.json({ error: eLines.message }, { status: 500 });
    }
  }

  // Запоминаем цены (по (org, counterparty, product)) - только если counterparty_id есть
  if (counterparty_id) {
    const upserts = prices.map((p) => ({
      org_id,
      counterparty_id,
      product_id: p.product_id,
      price: p.unit_price,
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from("work_price_memory")
      .upsert(upserts, { onConflict: "org_id,counterparty_id,product_id" });
  }

  return NextResponse.json({ invoice_id });
}
