import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userData.user.id)
    .single();

  if (eProf) throw new Error(eProf.message);
  if (!profile?.org_id) redirect("/app");

  const orgId = profile.org_id as string;

  const [orgSettingsRes, cpsRes] = await Promise.all([
    supabase.from("org_settings").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("counterparties").select("id,name,inn,active").eq("org_id", orgId).order("name"),
  ]);

  return (
    <SettingsClient
      orgId={orgId}
      initialSettings={orgSettingsRes.data ?? null}
      initialCounterparties={cpsRes.error ? [] : (cpsRes.data ?? [])}
    />
  );
}
