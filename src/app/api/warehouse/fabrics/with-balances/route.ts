import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: List fabrics with balances (only fabrics with stock > 0)
// Used for fabric usage selection in cuts

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

  // Get fabrics with balances where rolls_on_hand > 0 or meters_on_hand > 0
  const { data: balances, error: eBal } = await supabase
    .from("warehouse_balances")
    .select(
      `
      fabric_id, rolls_on_hand, meters_on_hand,
      warehouse_fabrics(id, name, color, width_cm, density)
    `
    )
    .eq("org_id", org_id)
    .eq("warehouse_type", "fabric")
    .or("rolls_on_hand.gt.0,meters_on_hand.gt.0")
    .order("updated_at", { ascending: false });

  if (eBal) {
    return NextResponse.json({ error: eBal.message }, { status: 500 });
  }

  // Map to fabric format with balances
  const fabrics = (balances || [])
    .filter((b: any) => b.warehouse_fabrics) // Only fabrics that exist
    .map((b: any) => ({
      id: b.warehouse_fabrics.id,
      name: b.warehouse_fabrics.name,
      color: b.warehouse_fabrics.color,
      width_cm: b.warehouse_fabrics.width_cm,
      density: b.warehouse_fabrics.density,
      rolls_on_hand: Number(b.rolls_on_hand || 0),
      meters_on_hand: Number(b.meters_on_hand || 0),
    }));

  return NextResponse.json({ fabrics });
}
