import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  assignment_id: z.string().uuid(),
  qty: z.coerce.number().int().positive().optional(),
  sewer_code: z.string().trim().min(1).optional(), // если меняем швею
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

  const { assignment_id, qty, sewer_code } = parsed.data;

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

  // получить текущую выдачу (нужен bundle_id и текущая швея)
  const { data: asg, error: asgErr } = await supabase
    .from("sewing_assignments")
    .select("id, org_id, bundle_id, sewer_employee_id, qty")
    .eq("id", assignment_id)
    .single();

  if (asgErr) return NextResponse.json({ error: asgErr.message }, { status: 400 });
  if (asg.org_id !== org_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const patch: any = {};

  // смена швеи по коду
  if (sewer_code) {
    // запретим смену швеи, если уже есть упаковка на старую швею по этой пачке
    const { count, error: cntErr } = await supabase
      .from("packaging_events")
      .select("id", { count: "exact", head: true })
      .eq("bundle_id", asg.bundle_id)
      .eq("sewer_employee_id", asg.sewer_employee_id);

    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 400 });
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Нельзя менять швею: по этой выдаче уже есть упаковка" }, { status: 409 });
    }

    const { data: sewer, error: sErr } = await supabase
      .from("employees")
      .select("id")
      .eq("org_id", org_id)
      .eq("role", "sewer")
      .eq("code", sewer_code)
      .single();

    if (sErr) return NextResponse.json({ error: "Швея с таким кодом не найдена" }, { status: 400 });
    patch.sewer_employee_id = sewer.id;
  }

  // изменение qty
  if (typeof qty === "number") {
    // если уменьшаем qty ниже уже закрытого этой швее — запрет
    const { data: pk, error: pkErr } = await supabase
      .from("packaging_events")
      .select("packed_qty, defect_qty")
      .eq("bundle_id", asg.bundle_id)
      .eq("sewer_employee_id", asg.sewer_employee_id);

    if (pkErr) return NextResponse.json({ error: pkErr.message }, { status: 400 });

    const closed = (pk ?? []).reduce(
      (s: number, r: any) => s + Number(r.packed_qty ?? 0) + Number(r.defect_qty ?? 0),
      0
    );
    if (qty < closed) {
      return NextResponse.json({ error: `Нельзя поставить qty меньше закрытого (${closed})` }, { status: 409 });
    }

    patch.qty = qty;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // триггер 1.4 защитит суммарное assigned <= qty_total
  const { error: updErr } = await supabase
    .from("sewing_assignments")
    .update(patch)
    .eq("id", assignment_id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
