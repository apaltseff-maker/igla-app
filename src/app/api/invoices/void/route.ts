import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const invoice_id = body?.invoice_id as string | undefined;

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id обязателен" }, { status: 400 });
  }

  // Get org_id
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  // Verify invoice belongs to org and get current state
  const { data: invoice, error: eInv } = await supabase
    .from("invoices")
    .select("id, org_id, status, paid_amount")
    .eq("id", invoice_id)
    .single();

  if (eInv || !invoice) {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }
  if (invoice.org_id !== org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Check if already void
  if (invoice.status === "void") {
    return NextResponse.json({ error: "Счёт уже аннулирован" }, { status: 400 });
  }

  // Check paid_amount (client-side check, RPC will also check)
  const paid_amount = Number(invoice.paid_amount ?? 0);
  if (paid_amount > 0) {
    return NextResponse.json(
      { error: `Нельзя аннулировать счёт с оплатой > 0. Текущая оплата: ${paid_amount}` },
      { status: 400 }
    );
  }

  // Call RPC function
  const { error: eRpc } = await supabase.rpc("invoice_void", {
    p_invoice_id: invoice_id,
  });

  if (eRpc) {
    return NextResponse.json({ error: eRpc.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
