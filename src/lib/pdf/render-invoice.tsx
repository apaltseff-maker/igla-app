import { pdf } from "@react-pdf/renderer";
import { InvoicePdf } from "./invoice-pdf";
import { createClient } from "@/lib/supabase/server";

export async function renderInvoicePdf(invoice_id: string) {
  const supabase = await createClient();

  const { data: profile, error: eProf } = await supabase.from("profiles").select("org_id").single();
  if (eProf || !profile?.org_id) throw new Error("org not found");
  const org_id = profile.org_id as string;

  const [{ data: invoice, error: eInv }, { data: lines, error: eLines }, { data: org, error: eOrg }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, issue_date, status, basis, current_amount, planned_amount, final_amount, cut_id, counterparty_id")
        .eq("id", invoice_id)
        .eq("org_id", org_id)
        .single(),
      supabase
        .from("invoice_lines")
        .select("product_id, color, unit_price, planned_qty, final_qty, planned_amount, final_amount, line_type, title, qty, amount")
        .eq("invoice_id", invoice_id)
        .eq("org_id", org_id)
        .order("created_at"),
      supabase.from("org_settings").select("*").eq("org_id", org_id).maybeSingle(),
    ]);

  if (eInv) throw new Error(eInv.message);
  if (eLines) throw new Error(eLines.message);
  if (eOrg) throw new Error(eOrg.message);

  const { data: cut } = await supabase
    .from("cuts")
    .select("cut_name, cut_date")
    .eq("id", invoice.cut_id)
    .eq("org_id", org_id)
    .single();

  const { data: cp } = await supabase
    .from("counterparties")
    .select("name, inn, kpp, address")
    .eq("id", invoice.counterparty_id)
    .eq("org_id", org_id)
    .single();

  // Filter out null/undefined product_ids before querying
  const productIds = Array.from(
    new Set(
      (lines ?? [])
        .map((l: any) => l.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id !== "undefined")
    )
  );
  
  let productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products } = await supabase.from("products").select("id, display").in("id", productIds);
    productMap = new Map((products ?? []).map((p) => [p.id, p.display]));
  }

  const doc = (
    <InvoicePdf
      invoice={{
        id: invoice.id,
        issue_date: invoice.issue_date,
        cut_name: cut?.cut_name ?? "",
        cut_date: cut?.cut_date ?? null,
        basis: invoice.basis,
        current_amount: Number(invoice.current_amount ?? 0),
      }}
      supplier={{
        portal_name: org?.portal_name ?? "",
        legal_name: org?.legal_name ?? "",
        legal_inn: org?.legal_inn ?? "",
        legal_kpp: org?.legal_kpp ?? "",
        legal_address: org?.legal_address ?? "",
        bank_name: org?.bank_name ?? "",
        bank_bik: org?.bank_bik ?? "",
        bank_corr_account: org?.bank_corr_account ?? "",
        bank_account: org?.bank_account ?? "",
      }}
      buyer={{
        name: cp?.name ?? "",
        inn: cp?.inn ?? "",
        kpp: cp?.kpp ?? "",
        address: cp?.address ?? "",
      }}
      lines={(lines ?? []).map((l: any, idx: number) => {
        // For work lines: use product display, for services/inventory: use title
        let itemName: string;
        if (l.product_id && productMap.has(l.product_id)) {
          itemName = productMap.get(l.product_id)!;
          if (l.color) itemName += `, ${l.color}`;
        } else {
          itemName = l.title ?? "—";
        }
        
        // Use qty for services/inventory, planned_qty for work
        const qty = l.qty != null ? Number(l.qty) : Number(l.planned_qty ?? 0);
        const amount = l.amount != null ? Number(l.amount) : Number(l.planned_amount ?? 0);
        
        return {
          n: idx + 1,
          item: itemName,
          qty,
          unit_price: Number(l.unit_price ?? 0),
          amount,
        };
      })}
    />
  );

  const buffer = await pdf(doc).toBuffer();
  return buffer;
}
