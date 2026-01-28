import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();

  // Get org_id
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  // Get all fabrics with LEFT JOIN to balances
  const { data: fabrics, error: eFab } = await supabase
    .from("warehouse_fabrics")
    .select(
      `
      id, name, color, width_cm, density, created_at,
      warehouse_balances(rolls_on_hand, meters_on_hand, total_cost, avg_cost_per_meter)
    `
    )
    .eq("org_id", org_id)
    .order("name", { ascending: true });

  if (eFab) {
    return NextResponse.json({ error: eFab.message }, { status: 500 });
  }

  // Map to include balance as single object (not array)
  const allFabrics = (fabrics || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    width_cm: f.width_cm,
    density: f.density,
    created_at: f.created_at,
    balance: Array.isArray(f.warehouse_balances) && f.warehouse_balances.length > 0
      ? f.warehouse_balances[0]
      : null,
  }));

  return NextResponse.json({ fabrics: allFabrics });
}
