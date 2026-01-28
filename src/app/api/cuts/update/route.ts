import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { cut_id, cut_name, cutter_employee_id, note } = body as {
    cut_id?: string;
    cut_name?: string;
    cutter_employee_id?: string;
    note?: string | null;
  };

  // Валидация cut_id
  if (!cut_id || typeof cut_id !== "string" || cut_id.trim().length === 0) {
    return NextResponse.json({ error: "cut_id is required" }, { status: 400 });
  }

  // Валидация cut_name
  if (!cut_name || typeof cut_name !== "string" || cut_name.trim().length === 0) {
    return NextResponse.json({ error: "cut_name is required" }, { status: 400 });
  }

  // Валидация cutter_employee_id
  if (!cutter_employee_id || typeof cutter_employee_id !== "string" || cutter_employee_id.trim().length === 0) {
    return NextResponse.json({ error: "cutter_employee_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("cuts")
    .update({
      cut_name: cut_name.trim(),
      cutter_employee_id: cutter_employee_id.trim(),
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .eq("id", cut_id.trim());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
