import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();

  const { item_id, qty_delta } = body;

  if (!item_id || qty_delta === undefined || qty_delta === null) {
    return NextResponse.json({ error: "item_id и qty_delta обязательны" }, { status: 400 });
  }

  const qty = Number(qty_delta);
  if (!isFinite(qty) || qty === 0) {
    return NextResponse.json({ error: "qty_delta должен быть числом != 0" }, { status: 400 });
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

  // Verify item belongs to org
  const { data: item, error: eItem } = await supabase
    .from("inventory_items")
    .select("id, org_id")
    .eq("id", item_id)
    .single();

  if (eItem || !item) {
    return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });
  }
  if (item.org_id !== org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Create movement
  const { data: movement, error: eMov } = await supabase
    .from("inventory_movements")
    .insert({
      org_id,
      item_id,
      reason: "adjustment",
      qty_delta: qty,
      unit_cost: null, // корректировка без стоимости
    })
    .select("id")
    .single();

  if (eMov) {
    return NextResponse.json({ error: eMov.message }, { status: 500 });
  }

  // Update balance via RPC
  const { error: eBalance } = await supabase.rpc("inventory_apply_delta", {
    p_org_id: org_id,
    p_item_id: item_id,
    p_qty: qty,
    p_unit_cost: null,
  });

  if (eBalance) {
    return NextResponse.json({ error: eBalance.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, movement_id: movement.id });
}
