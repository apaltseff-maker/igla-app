import { createClient } from "@/lib/supabase/server";
import { InvoiceEditClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function InvoiceEditPage({
  params,
}: {
  params: Promise<{ invoice_id: string }>;
}) {
  const { invoice_id } = await params;
  
  if (!invoice_id || invoice_id === "undefined") {
    throw new Error(`Missing invoice_id param: ${String(invoice_id)}`);
  }
  
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (!profile?.org_id) {
    throw new Error("Не удалось определить org_id");
  }

  const org_id = profile.org_id as string;

  const { data: invoice, error: eInv } = await supabase
    .from("invoices")
    .select(
      `id, issue_date, status, basis, current_amount, planned_amount, final_amount, paid_amount,
       cut_id, counterparty_id, org_id,
       cuts(cut_name, cut_date),
       counterparties(name)`
    )
    .eq("id", invoice_id)
    .eq("org_id", org_id)
    .single();

  if (eInv) throw new Error(eInv.message);

  return (
    <InvoiceEditClient
      invoice={{
        id: invoice.id as string,
        issue_date: invoice.issue_date as string,
        status: invoice.status as string,
        basis: invoice.basis as string,
        current_amount: Number(invoice.current_amount ?? 0),
        planned_amount: Number(invoice.planned_amount ?? 0),
        final_amount: Number(invoice.final_amount ?? 0),
        paid_amount: Number(invoice.paid_amount ?? 0),
        cut_id: invoice.cut_id as string | null,
        counterparty_id: invoice.counterparty_id as string,
        cut_name: (invoice.cuts as any)?.cut_name ?? null,
        cut_date: (invoice.cuts as any)?.cut_date ?? null,
        counterparty_name: (invoice.counterparties as any)?.name ?? "",
      }}
      invoiceId={invoice.id as string}
      orgId={org_id}
    />
  );
}
