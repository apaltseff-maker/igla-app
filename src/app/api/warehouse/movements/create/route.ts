import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const warehouse_type = body?.warehouse_type as "fabric" | "notion" | "packaging" | undefined;
  const item_id = body?.item_id as string | undefined;
  const reason = (body?.reason as "receipt" | "issue" | "adjustment" | "return") || "receipt";
  const movement_date = body?.movement_date as string | undefined;

  // Fabric fields - правильно обрабатываем 0 и null
  const rolls_delta =
    body?.rolls_delta === undefined || body?.rolls_delta === null || body?.rolls_delta === ""
      ? null
      : Number(body.rolls_delta);

  const meters_delta =
    body?.meters_delta === undefined || body?.meters_delta === null || body?.meters_delta === ""
      ? null
      : Number(body.meters_delta);

  const total_cost =
    body?.total_cost === undefined || body?.total_cost === null || body?.total_cost === ""
      ? null
      : Number(body.total_cost);

  // Notion/Packaging fields - правильно обрабатываем 0 и null
  const qty_delta =
    body?.qty_delta === undefined || body?.qty_delta === null || body?.qty_delta === ""
      ? null
      : Number(body.qty_delta);

  const unit_cost =
    body?.unit_cost === undefined || body?.unit_cost === null || body?.unit_cost === ""
      ? null
      : Number(body.unit_cost);

  const notes = body?.notes as string | undefined;

  if (!warehouse_type || !item_id) {
    return NextResponse.json({ error: "warehouse_type и item_id обязательны" }, { status: 400 });
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

  // Validate item exists and belongs to org
  if (warehouse_type === "fabric") {
    const { data: item, error: eItem } = await supabase
      .from("warehouse_fabrics")
      .select("id, org_id")
      .eq("id", item_id)
      .single();

    if (eItem || !item || item.org_id !== org_id) {
      return NextResponse.json({ error: "Ткань не найдена" }, { status: 404 });
    }

    // Validate rolls_delta for fabric (required, > 0)
    if (rolls_delta === null || Number.isNaN(rolls_delta) || rolls_delta <= 0) {
      return NextResponse.json({ error: "Укажите количество рулонов (> 0)" }, { status: 400 });
    }
  } else if (warehouse_type === "notion") {
    const { data: item, error: eItem } = await supabase
      .from("warehouse_notions")
      .select("id, org_id")
      .eq("id", item_id)
      .single();

    if (eItem || !item || item.org_id !== org_id) {
      return NextResponse.json({ error: "Фурнитура не найдена" }, { status: 404 });
    }
  } else if (warehouse_type === "packaging") {
    const { data: item, error: eItem } = await supabase
      .from("warehouse_packaging")
      .select("id, org_id")
      .eq("id", item_id)
      .single();

    if (eItem || !item || item.org_id !== org_id) {
      return NextResponse.json({ error: "Упаковка не найдена" }, { status: 404 });
    }
  }

  // Calculate cost_per_meter for fabric
  let cost_per_meter: number | null = null;
  if (warehouse_type === "fabric" && total_cost && meters_delta && meters_delta > 0) {
    cost_per_meter = total_cost / meters_delta;
  }

  // Calculate total_cost from unit_cost for notion/packaging
  let calculated_total_cost = total_cost;
  if ((warehouse_type === "notion" || warehouse_type === "packaging") && unit_cost && qty_delta) {
    calculated_total_cost = unit_cost * qty_delta;
  }

  // Build movement data
  const movementData: any = {
    org_id,
    warehouse_type,
    reason,
    movement_date: movement_date || new Date().toISOString().slice(0, 10),
    notes: notes?.trim() || null,
  };

  if (warehouse_type === "fabric") {
    movementData.fabric_id = item_id;
    movementData.rolls_delta = rolls_delta ?? null;
    movementData.meters_delta = meters_delta ?? null;
    movementData.total_cost = calculated_total_cost ?? null;
    movementData.cost_per_meter = cost_per_meter ?? null;
  } else if (warehouse_type === "notion") {
    movementData.notion_id = item_id;
    movementData.qty_delta = qty_delta ?? null;
    movementData.unit_cost = unit_cost ?? null;
    movementData.total_cost = calculated_total_cost ?? null;
  } else {
    movementData.packaging_id = item_id;
    movementData.qty_delta = qty_delta ?? null;
    movementData.unit_cost = unit_cost ?? null;
    movementData.total_cost = calculated_total_cost ?? null;
  }

  // Create movement
  const { data: movement, error: eMov } = await supabase
    .from("warehouse_movements")
    .insert(movementData)
    .select("id")
    .single();

  if (eMov) {
    console.error("[warehouse/movements/create] Insert error:", {
      error: eMov,
      message: eMov.message,
      details: eMov.details,
      hint: eMov.hint,
      code: eMov.code,
      movementData,
    });
    return NextResponse.json({ error: eMov.message }, { status: 500 });
  }

  // Update balance
  const { error: eBalance } = await supabase.rpc("warehouse_update_balance", {
    p_org_id: org_id,
    p_warehouse_type: warehouse_type,
    p_item_id: item_id,
    p_rolls_delta: rolls_delta,
    p_meters_delta: meters_delta,
    p_qty_delta: qty_delta,
    p_total_cost: calculated_total_cost,
    p_unit_cost: unit_cost,
  });

  if (eBalance) {
    console.error("[warehouse/movements/create] RPC error:", {
      error: eBalance,
      message: eBalance.message,
      details: eBalance.details,
      hint: eBalance.hint,
      code: eBalance.code,
      params: { p_org_id: org_id, p_warehouse_type: warehouse_type, p_item_id: item_id },
    });
    return NextResponse.json({ error: eBalance.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, movement_id: movement.id });
}
