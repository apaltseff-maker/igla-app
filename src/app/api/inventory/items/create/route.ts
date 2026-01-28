import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();

  const { name, category, uom, recommended_sale_price } = body;

  if (!name || !uom) {
    return NextResponse.json({ error: "name и uom обязательны" }, { status: 400 });
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

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      org_id,
      name: name.trim(),
      category: category?.trim() || null,
      uom: uom.trim(),
      recommended_sale_price: recommended_sale_price ? Number(recommended_sale_price) : null,
      is_active: true,
    })
    .select("id, name, category, uom, recommended_sale_price")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item });
}
