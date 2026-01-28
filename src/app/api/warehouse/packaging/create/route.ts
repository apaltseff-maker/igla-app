import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const name = body?.name as string | undefined;
  const uom = body?.uom as string | undefined;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Название упаковки обязательно" }, { status: 400 });
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

  // Insert packaging
  const { data: packaging, error: ePkg } = await supabase
    .from("warehouse_packaging")
    .insert({
      org_id,
      name: name.trim(),
      uom: uom?.trim() || "шт",
    })
    .select("id, name, uom")
    .single();

  if (ePkg) {
    return NextResponse.json({ error: ePkg.message }, { status: 500 });
  }

  return NextResponse.json({ packaging });
}
