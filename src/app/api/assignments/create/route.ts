import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  bundle_no: z.string().trim().min(1),
  sewer_code: z.string().trim().min(1), // "12"
  qty: z.coerce.number().int().positive(),
  assigned_at: z.string().datetime().optional(), // опционально
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid payload" }, { status: 400 });
  }

  const { bundle_no, sewer_code, qty, assigned_at } = parsed.data;

  // 1) org_id берём из профиля
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", userData.user.id)
    .single();

  if (profErr || !profile?.org_id) {
    return NextResponse.json({ error: "profile/org not found" }, { status: 400 });
  }

  const org_id = profile.org_id as string;

  // 2) найти пачку по org+bundle_no
  const { data: bundle, error: bErr } = await supabase
    .from("cut_bundles")
    .select("id, qty_total, bundle_no")
    .eq("org_id", org_id)
    .eq("bundle_no", bundle_no)
    .single();

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 });

  // 3) найти швею по org+role+code
  const { data: sewer, error: sErr } = await supabase
    .from("employees")
    .select("id, full_name, code")
    .eq("org_id", org_id)
    .eq("role", "sewer")
    .eq("code", sewer_code)
    .single();

  if (sErr) return NextResponse.json({ error: "Швея с таким кодом не найдена" }, { status: 400 });

  // 4) вставить выдачу (триггер 1.4 не даст превысить qty_total)
  const { error: insErr } = await supabase.from("sewing_assignments").insert({
    org_id,
    bundle_id: bundle.id,
    sewer_employee_id: sewer.id,
    qty,
    assigned_at: assigned_at ? assigned_at : new Date().toISOString(),
    source: "manual",
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    party_no: `${bundle.bundle_no}-${sewer.code}`,
  });
}
