import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  bundle_no: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { bundle_no } = parsed.data;

  // org_id текущего пользователя
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", userData.user.id)
    .single();

  if (profErr || !profile?.org_id) {
    return NextResponse.json({ error: "profile/org not found" }, { status: 400 });
  }
  const org_id = profile.org_id as string;

  const { data: bundle, error: bErr } = await supabase
    .from("cut_bundles")
    .select("id, bundle_no, cut_id, cut_name, color, size, qty_total")
    .eq("org_id", org_id)
    .eq("bundle_no", bundle_no)
    .single();

  if (bErr) return NextResponse.json({ error: "Пачка не найдена" }, { status: 404 });

  const { data: rows, error: aErr } = await supabase
    .from("sewing_assignments")
    .select("qty")
    .eq("bundle_id", bundle.id);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

  const assigned_total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.qty ?? 0), 0);
  const available = Number(bundle.qty_total ?? 0) - assigned_total;

  return NextResponse.json({
    ok: true,
    bundle,
    assigned_total,
    available,
  });
}
