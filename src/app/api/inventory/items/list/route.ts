import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
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

  // items + balances (левый join)
  const { data, error } = await supabase
    .from("inventory_items")
    .select(`
      id, org_id, name, category, sku, uom, recommended_sale_price, is_active, created_at,
      inventory_balances:inventory_balances!left(qty_on_hand, avg_cost, updated_at)
    `)
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // inventory_balances приходит массивом из-за left join — нормализуем
  const rows = (data ?? []).map((it: any) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    sku: it.sku,
    uom: it.uom,
    recommended_sale_price: it.recommended_sale_price,
    balance: Array.isArray(it.inventory_balances) ? it.inventory_balances[0] ?? null : it.inventory_balances ?? null,
  }));

  return NextResponse.json({ rows });
}
