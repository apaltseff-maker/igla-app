import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const invoice_id = searchParams.get("invoice_id");

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id обязателен" }, { status: 400 });
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

  // Get invoice lines
  const { data: lines, error: eLines } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoice_id)
    .eq("org_id", org_id)
    .order("created_at");

  if (eLines) {
    return NextResponse.json({ error: eLines.message }, { status: 500 });
  }

  // Get product displays for work lines
  const productIds = Array.from(
    new Set(
      (lines ?? [])
        .map((l: any) => l.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id !== "undefined")
    )
  );

  let productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, display")
      .in("id", productIds);
    
    if (products) {
      productMap = new Map(products.map((p) => [p.id, p.display]));
    }
  }

  const enrichedLines = (lines ?? []).map((l: any) => ({
    ...l,
    line_type: l.line_type || "work",
    product_display:
      l.product_id && typeof l.product_id === "string" && l.product_id.length > 0
        ? productMap.get(l.product_id) ?? "—"
        : null,
  }));

  return NextResponse.json({ lines: enrichedLines });
}
