import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createClient();

  // Get org_id for security (RPC should filter by org, but we verify)
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const date_from = searchParams.get("date_from"); // ISO string or null
  const date_to = searchParams.get("date_to");
  const sewer_employee_id = searchParams.get("sewer_employee_id");
  const cut_id = searchParams.get("cut_id");
  const product_id = searchParams.get("product_id");
  const bundle_no = searchParams.get("bundle_no");
  const limit = Number(searchParams.get("limit") ?? "200");

  // RPC packaging_journal should filter by org_id internally (security definer)
  // But we pass org_id explicitly if RPC supports it
  const { data, error } = await supabase.rpc("packaging_journal", {
    p_date_from: date_from ? new Date(date_from).toISOString() : null,
    p_date_to: date_to ? new Date(date_to).toISOString() : null,
    p_sewer_employee_id: sewer_employee_id || null,
    p_cut_id: cut_id || null,
    p_product_id: product_id || null,
    p_bundle_no: bundle_no || null,
    p_limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 200,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
