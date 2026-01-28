import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: profile, error: eProf }, { data: orgSettings, error: eSet }, { data: cps, error: eCp }] =
    await Promise.all([
      supabase.from("profiles").select("org_id").single(),
      supabase.from("org_settings").select("*").maybeSingle(),
      supabase.from("counterparties").select("id,name,inn,active").order("name"),
    ]);

  if (eProf) throw new Error(eProf.message);
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
