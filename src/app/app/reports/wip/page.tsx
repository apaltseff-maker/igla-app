import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WipReportClient from "./ui";

export const dynamic = "force-dynamic";

export default async function WipReportPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Получаем org_id для фильтрации
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.org_id) {
    redirect('/app');
  }

  const [{ data: notAssigned, error: e1 }, { data: wip, error: e2 }] = await Promise.all([
    supabase.rpc("bundles_not_assigned"),
    supabase.rpc("sewing_wip"),
  ]);

  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  // Фильтруем результаты по org_id на клиенте (если RPC не фильтрует)
  const filteredNotAssigned = (notAssigned ?? []).filter((item: any) => 
    item.org_id === profile.org_id
  );
  const filteredWip = (wip ?? []).filter((item: any) => 
    item.org_id === profile.org_id
  );

  return <WipReportClient notAssigned={filteredNotAssigned} wip={filteredWip} />;
}
