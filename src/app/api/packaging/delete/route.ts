import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();

  // Get org_id for security
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }

  const { event_id } = await req.json();

  if (!event_id) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  // Verify event belongs to org (RPC should check, but we verify first)
  const { data: event, error: eEvent } = await supabase
    .from("packaging_events")
    .select("id, org_id")
    .eq("id", event_id)
    .single();

  if (eEvent || !event) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  if (event.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // RPC packaging_event_delete should handle recalculation of fact/payroll
  const { error } = await supabase.rpc("packaging_event_delete", {
    p_event_id: event_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
