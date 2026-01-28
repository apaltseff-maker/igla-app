import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WipReportClient from "./ui";

export const dynamic = "force-dynamic";

export default async function WipReportPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: notAssigned, error: e1 }, { data: wip, error: e2 }] = await Promise.all([
    supabase.rpc("bundles_not_assigned"),
    supabase.rpc("sewing_wip"),
  ]);

  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  return <WipReportClient notAssigned={notAssigned ?? []} wip={wip ?? []} />;
}
