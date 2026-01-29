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

  // RPC уже фильтрует по org_id. Приводим к форме, ожидаемой клиентом.
  const filteredNotAssigned = ((notAssigned ?? []) as any[]).map((item) => ({
    cut_id: item.cut_id,
    cut_name: item.cut_name ?? null,
    cut_date: item.cut_date ?? null,
    bundle_id: item.id,
    bundle_no: item.bundle_no ?? '',
    product_display: item.cut_name ?? '',
    color: item.color ?? null,
    size: item.size ?? null,
    qty_total: Number(item.qty_total ?? 0),
    assigned_total: Number(item.assigned_qty ?? 0),
    remaining: Number(item.remaining_qty ?? 0),
  }));

  const filteredWip = ((wip ?? []) as any[]).map((item) => ({
    sewer_employee_id: item.sewer_employee_id,
    sewer_code: item.sewer_code ?? '',
    sewer_full_name: item.sewer_name ?? '',
    bundle_id: item.bundle_id,
    bundle_no: item.bundle_no ?? '',
    product_display: item.cut_name ?? '',
    color: item.color ?? null,
    size: item.size ?? null,
    took_qty: Number(item.assigned_qty ?? 0),
    closed_qty: Number(item.packed_qty ?? 0),
    remaining: Number(item.remaining_qty ?? 0),
  }));

  return <WipReportClient notAssigned={filteredNotAssigned} wip={filteredWip} />;
}
