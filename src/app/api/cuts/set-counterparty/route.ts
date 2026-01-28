import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const cut_id = body?.cut_id as string | undefined;
  const counterparty_id = body?.counterparty_id as string | undefined;

  if (!cut_id || !counterparty_id) {
    return NextResponse.json({ error: "cut_id и counterparty_id обязательны" }, { status: 400 });
  }

  const { data: profile, error: eProf } = await supabase.from("profiles").select("org_id").single();
  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  // Обновляем только в своей org
  const { error } = await supabase
    .from("cuts")
    .update({ counterparty_id })
    .eq("id", cut_id)
    .eq("org_id", org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
