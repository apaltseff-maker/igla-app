import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();

  const { org_id, invoice_id, title, qty, unit_price, uom } = body;

  const amount = Number(qty) * Number(unit_price);

  const { error } = await supabase.from("invoice_lines").insert({
    org_id,
    invoice_id,
    product_id: null,
    color: null,
    unit_price,
    planned_qty: 0,
    final_qty: 0,
    planned_amount: 0,
    final_amount: 0,

    line_type: "service",
    title,
    uom: uom ?? "шт",
    qty,
    amount,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
