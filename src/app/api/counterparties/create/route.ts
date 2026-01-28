import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data: profile, error: eProf } = await supabase.from("profiles").select("org_id").single();
  if (eProf || !profile?.org_id) return NextResponse.json({ error: "org not found" }, { status: 401 });
  const org_id = profile.org_id as string;

  // допускаем создание только по названию
  const payload = {
    org_id,
    name,
    inn: body?.inn ? String(body.inn) : null,
    kpp: body?.kpp ? String(body.kpp) : null,
    ogrn: body?.ogrn ? String(body.ogrn) : null,
    address: body?.address ? String(body.address) : null,
    phone: body?.phone ? String(body.phone) : null,
    note: body?.note ? String(body.note) : null,
    active: true,
  };

  const { data, error } = await supabase
    .from("counterparties")
    .insert(payload)
    .select("id,name,inn,kpp,ogrn,address")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ counterparty: data });
}
