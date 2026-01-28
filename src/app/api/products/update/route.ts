import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const product_id = body?.product_id as string | undefined;
  const display = body?.display as string | undefined;
  const base_rate = body?.base_rate !== undefined ? Number(body.base_rate) : undefined;

  if (!product_id) {
    return NextResponse.json({ error: "product_id обязателен" }, { status: 400 });
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

  // Verify product belongs to org
  const { data: product, error: eProd } = await supabase
    .from("products")
    .select("id, org_id, display")
    .eq("id", product_id)
    .single();

  if (eProd || !product) {
    return NextResponse.json({ error: "Изделие не найдено" }, { status: 404 });
  }
  if (product.org_id !== org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Build update object
  const updateData: Record<string, any> = {};

  if (display !== undefined) {
    const trimmed = String(display).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Название модели не может быть пустым" }, { status: 400 });
    }
    updateData.display = trimmed;
  }

  if (base_rate !== undefined) {
    if (!Number.isFinite(base_rate) || base_rate < 0) {
      return NextResponse.json({ error: "Расценка должна быть числом >= 0" }, { status: 400 });
    }
    updateData.base_rate = base_rate === 0 ? null : base_rate;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  // Update product (trigger will sync cut_bundles.cut_name)
  const { error: eUpd } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", product_id)
    .eq("org_id", org_id);

  if (eUpd) {
    return NextResponse.json({ error: eUpd.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
