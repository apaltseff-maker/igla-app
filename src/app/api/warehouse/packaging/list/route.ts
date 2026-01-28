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

  // Get packaging with balances
  const { data: packaging, error: ePkg } = await supabase
    .from("warehouse_packaging")
    .select(
      `
      id, name, uom, created_at,
      warehouse_balances!inner(qty_on_hand, total_cost, avg_unit_cost)
    `
    )
    .eq("org_id", org_id)
    .order("name", { ascending: true });

  if (ePkg) {
    return NextResponse.json({ error: ePkg.message }, { status: 500 });
  }

  // Also get packaging without balances
  const { data: packagingNoBalance, error: ePkg2 } = await supabase
    .from("warehouse_packaging")
    .select("id, name, uom, created_at")
    .eq("org_id", org_id)
    .not("id", "in", (packaging || []).map((p: any) => p.id));

  const allPackaging = [
    ...(packaging || []).map((p: any) => ({
      ...p,
      balance: p.warehouse_balances?.[0] || null,
    })),
    ...(packagingNoBalance || []).map((p: any) => ({
      ...p,
      balance: null,
    })),
  ];

  return NextResponse.json({ packaging: allPackaging });
}
