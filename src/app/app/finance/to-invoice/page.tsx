import { createClient } from "@/lib/supabase/server";
import { ToInvoiceClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function ToInvoicePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cuts_without_invoices");
  if (error) throw new Error(error.message);

  return <ToInvoiceClient rows={data ?? []} />;
}
