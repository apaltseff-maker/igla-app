import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({ party_no: z.string().trim().min(3) });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const { data, error } = await supabase.rpc("party_preview", { p_party_no: parsed.data.party_no });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const preview = Array.isArray(data) ? data[0] : data;
  if (!preview) return NextResponse.json({ error: "Партия не найдена" }, { status: 404 });

  return NextResponse.json({ ok: true, preview });
}
