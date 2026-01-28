import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: list usage for a cut
// POST: upsert usage (create or update)
// DELETE: delete usage

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const cut_id = searchParams.get("cut_id");

  if (!cut_id) {
    return NextResponse.json({ error: "cut_id обязателен" }, { status: 400 });
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

  // Verify cut belongs to org
  const { data: cut, error: eCut } = await supabase
    .from("cuts")
    .select("id, org_id")
    .eq("id", cut_id)
    .single();

  if (eCut || !cut || cut.org_id !== org_id) {
    return NextResponse.json({ error: "Крой не найден" }, { status: 404 });
  }

  // Get usage with fabric details
  const { data: usage, error: eUsage } = await supabase
    .from("cut_fabric_usage")
    .select(
      `
      id, cut_id, fabric_id, rolls_used, created_at, updated_at,
      warehouse_fabrics(name, color, width_cm, density)
    `
    )
    .eq("cut_id", cut_id)
    .eq("org_id", org_id)
    .order("created_at", { ascending: true });

  if (eUsage) {
    return NextResponse.json({ error: eUsage.message }, { status: 500 });
  }

  return NextResponse.json({ usage: usage || [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const cut_id = body?.cut_id as string | undefined;
  const fabric_id = body?.fabric_id as string | undefined;
  const rolls_used = body?.rolls_used !== undefined ? Number(body.rolls_used) : undefined;

  if (!cut_id || !fabric_id) {
    return NextResponse.json({ error: "cut_id и fabric_id обязательны" }, { status: 400 });
  }

  if (rolls_used === undefined || !Number.isFinite(rolls_used) || rolls_used < 0) {
    return NextResponse.json({ error: "rolls_used должен быть числом >= 0" }, { status: 400 });
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

  // Verify cut belongs to org
  const { data: cut, error: eCut } = await supabase
    .from("cuts")
    .select("id, org_id, cut_date")
    .eq("id", cut_id)
    .single();

  if (eCut || !cut || cut.org_id !== org_id) {
    return NextResponse.json({ error: "Крой не найден" }, { status: 404 });
  }

  // Verify fabric belongs to org
  const { data: fabric, error: eFab } = await supabase
    .from("warehouse_fabrics")
    .select("id, org_id")
    .eq("id", fabric_id)
    .single();

  if (eFab || !fabric || fabric.org_id !== org_id) {
    return NextResponse.json({ error: "Ткань не найдена" }, { status: 404 });
  }

  // Check current usage count (max 10)
  const { data: existingUsage, error: eCount } = await supabase
    .from("cut_fabric_usage")
    .select("id, fabric_id, rolls_used")
    .eq("cut_id", cut_id)
    .eq("org_id", org_id);

  if (eCount) {
    return NextResponse.json({ error: eCount.message }, { status: 500 });
  }

  const isUpdate = existingUsage?.some((u) => u.fabric_id === fabric_id);
  const currentCount = existingUsage?.length || 0;

  if (!isUpdate && currentCount >= 10) {
    return NextResponse.json({ error: "Максимум 10 разных тканей на крой" }, { status: 400 });
  }

  // Get old rolls_used for movement reversal
  const oldUsage = existingUsage?.find((u) => u.fabric_id === fabric_id);
  const old_rolls = oldUsage ? Number(oldUsage.rolls_used) : 0;

  // Upsert usage
  const { data: usage, error: eUpsert } = await supabase
    .from("cut_fabric_usage")
    .upsert(
      {
        org_id,
        cut_id,
        fabric_id,
        rolls_used: rolls_used,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "org_id,cut_id,fabric_id",
      }
    )
    .select("id")
    .single();

  if (eUpsert) {
    return NextResponse.json({ error: eUpsert.message }, { status: 500 });
  }

  // If rolls_used is 0, delete the record instead
  if (rolls_used === 0) {
    await supabase.from("cut_fabric_usage").delete().eq("id", usage.id);
    
    // Revert old movement if existed
    if (old_rolls > 0) {
      await supabase.rpc("warehouse_update_balance", {
        p_org_id: org_id,
        p_warehouse_type: "fabric",
        p_item_id: fabric_id,
        p_rolls_delta: old_rolls, // positive to revert
        p_meters_delta: null,
        p_qty_delta: null,
        p_total_cost: null,
        p_unit_cost: null,
      });
    }
    
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Create/update warehouse movement for fabric issue
  // Calculate delta
  const rolls_delta = -(rolls_used - old_rolls); // negative for issue

  // Revert old movement if existed
  if (old_rolls > 0) {
    await supabase.rpc("warehouse_update_balance", {
      p_org_id: org_id,
      p_warehouse_type: "fabric",
      p_item_id: fabric_id,
      p_rolls_delta: old_rolls, // positive to revert
      p_meters_delta: null,
      p_qty_delta: null,
      p_total_cost: null,
      p_unit_cost: null,
    });
  }

  // Apply new movement
  if (rolls_used > 0) {
    // Create movement record
    await supabase.from("warehouse_movements").insert({
      org_id,
      warehouse_type: "fabric",
      fabric_id,
      reason: "issue",
      movement_date: cut.cut_date || new Date().toISOString().slice(0, 10),
      rolls_delta: -rolls_used, // negative for issue
      meters_delta: null,
      total_cost: null,
      cost_per_meter: null,
      notes: `Расход на крой ${cut_id}`,
    });

    // Update balance
    await supabase.rpc("warehouse_update_balance", {
      p_org_id: org_id,
      p_warehouse_type: "fabric",
      p_item_id: fabric_id,
      p_rolls_delta: -rolls_used, // negative for issue
      p_meters_delta: null,
      p_qty_delta: null,
      p_total_cost: null,
      p_unit_cost: null,
    });
  }

  return NextResponse.json({ ok: true, usage_id: usage.id });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const usage_id = searchParams.get("usage_id");

  if (!usage_id) {
    return NextResponse.json({ error: "usage_id обязателен" }, { status: 400 });
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

  // Get usage to revert movement
  const { data: usage, error: eUsage } = await supabase
    .from("cut_fabric_usage")
    .select("fabric_id, rolls_used, cut_id, cuts(cut_date)")
    .eq("id", usage_id)
    .eq("org_id", org_id)
    .single();

  if (eUsage || !usage) {
    return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
  }

  const rolls_used = Number(usage.rolls_used || 0);

  // Delete usage
  const { error: eDel } = await supabase
    .from("cut_fabric_usage")
    .delete()
    .eq("id", usage_id)
    .eq("org_id", org_id);

  if (eDel) {
    return NextResponse.json({ error: eDel.message }, { status: 500 });
  }

  // Revert warehouse movement if rolls_used > 0
  if (rolls_used > 0) {
    await supabase.rpc("warehouse_update_balance", {
      p_org_id: org_id,
      p_warehouse_type: "fabric",
      p_item_id: usage.fabric_id,
      p_rolls_delta: rolls_used, // positive to revert
      p_meters_delta: null,
      p_qty_delta: null,
      p_total_cost: null,
      p_unit_cost: null,
    });
  }

  return NextResponse.json({ ok: true });
}
