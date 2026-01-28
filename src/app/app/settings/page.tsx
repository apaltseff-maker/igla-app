import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const [{ data: profile, error: eProf }, { data: orgSettings, error: eSet }, { data: cps, error: eCp }] =
    await Promise.all([
      supabase.from("profiles").select("org_id").eq('id', userData.user.id).single(),
      supabase.from("org_settings").select("*").maybeSingle(),
      supabase.from("counterparties").select("id,name,inn,active").order("name"),
    ]);

  if (eProf) throw new Error(eProf.message);
  if (!profile?.org_id) redirect('/app');
  if (eSet) throw new Error(eSet.message);
  if (eCp) throw new Error(eCp.message);

  return (
    <SettingsClient
      orgId={(profile?.org_id as string) ?? ""}
      initialSettings={orgSettings ?? null}
      initialCounterparties={cps ?? []}
    />
  );
}
