import { createClient } from "@/lib/supabase/server";
import { CreateInvoiceClient } from "./ui";

export const dynamic = "force-dynamic";

type PreviewRow = {
  product_id: string;
  product_display: string;
  color: string;
  planned_qty: number;
  final_qty: number;
  defect_qty: number;
  suggested_price: number | null;
};

type Counterparty = { id: string; name: string };

export default async function CreateInvoicePage({
  params,
}: {
  params: Promise<{ cut_id: string }>;
}) {
  const { cut_id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (!profile?.org_id) {
    throw new Error("Не удалось определить org_id");
  }
  const org_id = profile.org_id as string;

  const [{ data: cut, error: eCut }, { data: preview, error: ePrev }, { data: cps, error: eCp }] =
    await Promise.all([
      supabase
        .from("cuts")
        .select("id, cut_name, cut_date, counterparty_id")
        .eq("id", cut_id)
        .single(),
      supabase.rpc("invoice_preview_by_cut", { p_cut_id: cut_id }),
      supabase.from("counterparties").select("id,name").eq("active", true).order("name"),
    ]);

  if (eCut) throw new Error(eCut.message);
  if (ePrev) throw new Error(ePrev.message);
  if (eCp) throw new Error(eCp.message);

  return (
    <CreateInvoiceClient
      cut={{
        id: cut.id as string,
        cut_name: (cut.cut_name as string) ?? "",
        cut_date: (cut.cut_date as string) ?? null,
        counterparty_id: (cut.counterparty_id as string | null) ?? null,
      }}
      preview={(preview ?? []) as PreviewRow[]}
      counterparties={(cps ?? []) as Counterparty[]}
      orgId={org_id}
    />
  );
}
