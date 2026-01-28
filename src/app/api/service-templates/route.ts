import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const org_id = searchParams.get("org_id");

  if (!org_id) {
    return NextResponse.json({ error: "org_id обязателен" }, { status: 400 });
  }

  const { data: templates, error } = await supabase
    .from("service_templates")
    .select("id, code, name, uom, recommended_unit_price")
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates ?? [] });
}
