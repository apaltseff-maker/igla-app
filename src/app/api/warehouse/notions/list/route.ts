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

  // Get notions with balances
  const { data: notions, error: eNot } = await supabase
    .from("warehouse_notions")
    .select(
      `
      id, name, uom, created_at,
      warehouse_balances!inner(qty_on_hand, total_cost, avg_unit_cost)
    `
    )
    .eq("org_id", org_id)
    .order("name", { ascending: true });

  if (eNot) {
    return NextResponse.json({ error: eNot.message }, { status: 500 });
  }

  // Also get notions without balances
  const { data: notionsNoBalance, error: eNot2 } = await supabase
    .from("warehouse_notions")
    .select("id, name, uom, created_at")
    .eq("org_id", org_id)
    .not("id", "in", (notions || []).map((n: any) => n.id));

  const allNotions = [
    ...(notions || []).map((n: any) => ({
      ...n,
      balance: n.warehouse_balances?.[0] || null,
    })),
    ...(notionsNoBalance || []).map((n: any) => ({
      ...n,
      balance: null,
    })),
  ];

  return NextResponse.json({ notions: allNotions });
}
