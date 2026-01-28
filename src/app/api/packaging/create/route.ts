import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  party_no: z.string().trim().min(3), // "123454-12"
  packed_qty: z.coerce.number().int().nonnegative(),
  defect_qty: z.coerce.number().int().nonnegative(),
  packaged_at: z.string().datetime().optional(),
});

function parseParty(party_no: string) {
  const t = party_no.trim();
  // split по последнему дефису (на случай если bundle_no когда-нибудь станет с дефисом)
  const i = t.lastIndexOf("-");
  if (i <= 0 || i === t.length - 1) return null;
  const bundle_no = t.slice(0, i).trim();
  const sewer_code = t.slice(i + 1).trim();
  if (!bundle_no || !sewer_code) return null;
  return { bundle_no, sewer_code };
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid payload" }, { status: 400 });
  }

  const { party_no, packed_qty, defect_qty, packaged_at } = parsed.data;

  if (packed_qty + defect_qty <= 0) {
    return NextResponse.json({ error: "Введите упаковано и/или брак (больше 0)" }, { status: 400 });
  }

  const parsedParty = parseParty(party_no);
  if (!parsedParty) return NextResponse.json({ error: "Неверный номер партии. Формат: 123454-12" }, { status: 400 });

  const { bundle_no, sewer_code } = parsedParty;

  // org_id из profiles
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (profErr || !profile?.org_id) {
    return NextResponse.json({ error: "profile/org not found" }, { status: 400 });
  }
  const org_id = profile.org_id as string;

  // найти пачку
  const { data: bundle, error: bErr } = await supabase
    .from("cut_bundles")
    .select("id, qty_total, bundle_no")
    .eq("org_id", org_id)
    .eq("bundle_no", bundle_no)
    .single();

  if (bErr) return NextResponse.json({ error: "Пачка не найдена" }, { status: 400 });

  // найти швею по коду
  const { data: sewer, error: sErr } = await supabase
    .from("employees")
    .select("id, code")
    .eq("org_id", org_id)
    .eq("role", "sewer")
    .eq("code", sewer_code)
    .single();

  if (sErr) return NextResponse.json({ error: "Швея (код) не найдена" }, { status: 400 });

  const bundle_id = bundle.id as string;
  const sewer_employee_id = sewer.id as string;

  // посчитать текущие totals по этой швее в этой пачке
  const { data: asgRows, error: asgErr } = await supabase
    .from("sewing_assignments")
    .select("qty")
    .eq("bundle_id", bundle_id)
    .eq("sewer_employee_id", sewer_employee_id);

  if (asgErr) return NextResponse.json({ error: asgErr.message }, { status: 400 });

  const { data: pkgRows, error: pkgErr } = await supabase
    .from("packaging_events")
    .select("packed_qty, defect_qty")
    .eq("bundle_id", bundle_id)
    .eq("sewer_employee_id", sewer_employee_id);

  if (pkgErr) return NextResponse.json({ error: pkgErr.message }, { status: 400 });

  const assigned = (asgRows ?? []).reduce((s, r: any) => s + Number(r.qty ?? 0), 0);
  const closed = (pkgRows ?? []).reduce((s, r: any) => s + Number(r.packed_qty ?? 0) + Number(r.defect_qty ?? 0), 0);

  const addClosed = packed_qty + defect_qty;
  const needAutoAssign = Math.max(closed + addClosed - assigned, 0);

  // ещё один глобальный лимит: суммарно по пачке нельзя закрыть больше qty_total
  // (даже если разные швеи). Считаем total closed по пачке:
  const { data: pkgAll, error: pkgAllErr } = await supabase
    .from("packaging_events")
    .select("packed_qty, defect_qty")
    .eq("bundle_id", bundle_id);

  if (pkgAllErr) return NextResponse.json({ error: pkgAllErr.message }, { status: 400 });

  const closedAll = (pkgAll ?? []).reduce(
    (s, r: any) => s + Number(r.packed_qty ?? 0) + Number(r.defect_qty ?? 0),
    0
  );

  if (closedAll + addClosed > Number(bundle.qty_total ?? 0)) {
    return NextResponse.json(
      { error: `Нельзя упаковать больше чем в пачке. В пачке=${bundle.qty_total}, уже закрыто=${closedAll}` },
      { status: 400 }
    );
  }

  // если не хватает выдачи — добавляем авто-выдачу
  if (needAutoAssign > 0) {
    const { error: autoErr } = await supabase.from("sewing_assignments").insert({
      org_id,
      bundle_id,
      sewer_employee_id,
      qty: needAutoAssign,
      assigned_at: new Date().toISOString(),
      source: "auto_from_packaging",
    });

    if (autoErr) {
      // тут может сработать триггер 1.4 (выдано > qty_total)
      return NextResponse.json({ error: `Авто-выдача не удалась: ${autoErr.message}` }, { status: 400 });
    }
  }

  // вставляем событие упаковки (триггер 1.5 проверит упаковка<=выдача)
  const { error: insErr } = await supabase.from("packaging_events").insert({
    org_id,
    bundle_id,
    sewer_employee_id,
    packed_qty,
    defect_qty,
    packaged_at: packaged_at ? packaged_at : new Date().toISOString(),
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    bundle_no: bundle.bundle_no,
    sewer_code: sewer.code,
    auto_assigned_added: needAutoAssign,
  });
}
