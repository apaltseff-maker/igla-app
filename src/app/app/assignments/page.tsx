import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssignmentsClient from "./ui";

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: sewers } = await supabase
    .from("employees")
    .select("id, full_name, code")
    .eq("role", "sewer")
    .eq("active", true)
    .order("code", { ascending: true });

  return <AssignmentsClient sewers={(sewers as any) || []} />;
}
