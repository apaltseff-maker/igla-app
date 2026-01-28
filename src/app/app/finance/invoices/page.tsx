import { createClient } from "@/lib/supabase/server";
import { InvoicesClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoices_list", { p_q: null, p_status: null, p_counterparty_id: null });
  if (error) throw new Error(error.message);

  return <InvoicesClient rows={data ?? []} />;
}
