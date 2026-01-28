import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const { data: profile, error: eProf } = await supabase.from("profiles").select("org_id").single();
  if (eProf || !profile?.org_id) return NextResponse.json({ error: "org not found" }, { status: 401 });

  const org_id = profile.org_id as string;

  const payload = {
    org_id,
    portal_name: (body?.portal_name ?? "").toString(),
    legal_inn: body?.legal_inn ? String(body.legal_inn) : null,
    legal_name: body?.legal_name ? String(body.legal_name) : null,
    legal_kpp: body?.legal_kpp ? String(body.legal_kpp) : null,
    legal_ogrn: body?.legal_ogrn ? String(body.legal_ogrn) : null,
    legal_address: body?.legal_address ? String(body.legal_address) : null,
    bank_name: body?.bank_name ? String(body.bank_name) : null,
    bank_bik: body?.bank_bik ? String(body.bank_bik) : null,
    bank_account: body?.bank_account ? String(body.bank_account) : null,
    bank_corr_account: body?.bank_corr_account ? String(body.bank_corr_account) : null,
    label_format: body?.label_format ? String(body.label_format) : "30x20",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("org_settings").upsert(payload, { onConflict: "org_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
