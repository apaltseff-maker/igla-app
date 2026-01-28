import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const name = body?.name as string | undefined;
  const color = body?.color as string | undefined;
  const width_cm = body?.width_cm ? Number(body.width_cm) : undefined;
  const density = body?.density as string | undefined;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Название ткани обязательно" }, { status: 400 });
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

  // Insert fabric
  const { data: fabric, error: eFab } = await supabase
    .from("warehouse_fabrics")
    .insert({
      org_id,
      name: name.trim(),
      color: color?.trim() || null,
      width_cm: width_cm || null,
      density: density?.trim() || null,
    })
    .select("id, name, color, width_cm, density")
    .single();

  if (eFab) {
    return NextResponse.json({ error: eFab.message }, { status: 500 });
  }

  return NextResponse.json({ fabric });
}
