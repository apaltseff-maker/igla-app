import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const warehouse_type = body?.warehouse_type as "fabric" | "notion" | "packaging" | undefined;
  const item_id = body?.item_id as string | undefined; // optional filter

  // Get org_id
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  if (!warehouse_type) {
    return NextResponse.json({ error: "warehouse_type обязателен" }, { status: 400 });
  }

  // Build query - join only with relevant catalog table
  let selectFields = `
    id, warehouse_type, reason, movement_date, created_at, updated_at,
    rolls_delta, meters_delta, qty_delta, total_cost, cost_per_meter, unit_cost, notes,
    fabric_id, notion_id, packaging_id
  `;

  if (warehouse_type === "fabric") {
    selectFields += `, warehouse_fabrics(name, color)`;
  } else if (warehouse_type === "notion") {
    selectFields += `, warehouse_notions(name, uom)`;
  } else if (warehouse_type === "packaging") {
    selectFields += `, warehouse_packaging(name, uom)`;
  }

  let query = supabase
    .from("warehouse_movements")
    .select(selectFields)
    .eq("org_id", org_id)
    .eq("warehouse_type", warehouse_type)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (item_id) {
    if (warehouse_type === "fabric") {
      query = query.eq("fabric_id", item_id);
    } else if (warehouse_type === "notion") {
      query = query.eq("notion_id", item_id);
    } else {
      query = query.eq("packaging_id", item_id);
    }
  }

  const { data: movements, error: eMov } = await query;

  if (eMov) {
    return NextResponse.json({ error: eMov.message }, { status: 500 });
  }

  return NextResponse.json({ movements: movements || [] });
}
