import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const movement_id = body?.movement_id as string | undefined;
  const updates = body?.updates as Record<string, any> | undefined;

  if (!movement_id || !updates) {
    return NextResponse.json({ error: "movement_id и updates обязательны" }, { status: 400 });
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

  // Get current movement
  const { data: movement, error: eMov } = await supabase
    .from("warehouse_movements")
    .select("*")
    .eq("id", movement_id)
    .eq("org_id", org_id)
    .single();

  if (eMov || !movement) {
    return NextResponse.json({ error: "Движение не найдено" }, { status: 404 });
  }

  const warehouse_type = movement.warehouse_type as "fabric" | "notion" | "packaging";
  const item_id = movement.fabric_id || movement.notion_id || movement.packaging_id;

  // Calculate old deltas (negative for reversal)
  const old_rolls_delta = movement.rolls_delta ? -Number(movement.rolls_delta) : null;
  const old_meters_delta = movement.meters_delta ? -Number(movement.meters_delta) : null;
  const old_qty_delta = movement.qty_delta ? -Number(movement.qty_delta) : null;
  const old_total_cost = movement.total_cost ? -Number(movement.total_cost) : null;

  // Build update data
  const updateData: any = {};

  if (updates.movement_date) updateData.movement_date = updates.movement_date;
  if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;

  if (warehouse_type === "fabric") {
    if (updates.rolls_delta !== undefined) updateData.rolls_delta = updates.rolls_delta ? Number(updates.rolls_delta) : null;
    if (updates.meters_delta !== undefined) updateData.meters_delta = updates.meters_delta ? Number(updates.meters_delta) : null;
    if (updates.total_cost !== undefined) {
      updateData.total_cost = updates.total_cost ? Number(updates.total_cost) : null;
      // Recalculate cost_per_meter
      if (updateData.meters_delta && updateData.meters_delta > 0 && updateData.total_cost) {
        updateData.cost_per_meter = updateData.total_cost / updateData.meters_delta;
      } else {
        updateData.cost_per_meter = null;
      }
    }
  } else {
    if (updates.qty_delta !== undefined) updateData.qty_delta = updates.qty_delta ? Number(updates.qty_delta) : null;
    if (updates.unit_cost !== undefined) updateData.unit_cost = updates.unit_cost ? Number(updates.unit_cost) : null;
    if (updates.total_cost !== undefined) {
      updateData.total_cost = updates.total_cost ? Number(updates.total_cost) : null;
    } else if (updateData.qty_delta && updateData.unit_cost) {
      // Recalculate total_cost from qty * unit_cost
      updateData.total_cost = updateData.qty_delta * updateData.unit_cost;
    }
  }

  updateData.updated_at = new Date().toISOString();

  // Update movement
  const { error: eUpd } = await supabase
    .from("warehouse_movements")
    .update(updateData)
    .eq("id", movement_id)
    .eq("org_id", org_id);

  if (eUpd) {
    return NextResponse.json({ error: eUpd.message }, { status: 500 });
  }

  // Revert old movement and apply new
  // First revert old values
  await supabase.rpc("warehouse_update_balance", {
    p_org_id: org_id,
    p_warehouse_type: warehouse_type,
    p_item_id: item_id,
    p_rolls_delta: old_rolls_delta,
    p_meters_delta: old_meters_delta,
    p_qty_delta: old_qty_delta,
    p_total_cost: old_total_cost,
    p_unit_cost: null,
  });

  // Then apply new values
  const new_rolls_delta = updateData.rolls_delta !== undefined ? updateData.rolls_delta : movement.rolls_delta;
  const new_meters_delta = updateData.meters_delta !== undefined ? updateData.meters_delta : movement.meters_delta;
  const new_qty_delta = updateData.qty_delta !== undefined ? updateData.qty_delta : movement.qty_delta;
  const new_total_cost = updateData.total_cost !== undefined ? updateData.total_cost : movement.total_cost;
  const new_unit_cost = updateData.unit_cost !== undefined ? updateData.unit_cost : movement.unit_cost;

  await supabase.rpc("warehouse_update_balance", {
    p_org_id: org_id,
    p_warehouse_type: warehouse_type,
    p_item_id: item_id,
    p_rolls_delta: new_rolls_delta,
    p_meters_delta: new_meters_delta,
    p_qty_delta: new_qty_delta,
    p_total_cost: new_total_cost,
    p_unit_cost: new_unit_cost,
  });

  return NextResponse.json({ ok: true });
}
