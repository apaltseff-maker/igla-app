import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const org_id = searchParams.get("org_id");

  if (!org_id) {
    return NextResponse.json({ error: "org_id обязателен" }, { status: 400 });
  }

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, name, category, uom, recommended_sale_price")
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: items ?? [] });
}
