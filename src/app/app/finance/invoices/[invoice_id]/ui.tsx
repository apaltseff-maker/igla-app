"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InvoiceLinesEditor } from "../../_components/InvoiceLinesEditor";

type Invoice = {
  id: string;
  issue_date: string;
  status: string;
  basis: string;
  current_amount: number;
  planned_amount: number;
  final_amount: number;
  paid_amount: number;
  cut_id: string | null;
  counterparty_id: string;
  cut_name: string | null;
  cut_date: string | null;
  counterparty_name: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function statusLabel(s: string) {
  if (s === "draft") return "Черновик";
  if (s === "waiting_payment") return "Ждёт оплаты";
  if (s === "part_paid") return "Частично оплачен";
  if (s === "paid") return "Оплачен";
  if (s === "void") return "Аннулирован";
  return s;
}

export function InvoiceEditClient({
  invoice,
  invoiceId,
  orgId,
}: {
  invoice: Invoice;
  invoiceId: string;
  orgId: string;
}) {
  const router = useRouter();
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const canVoid = invoice.status !== "void" && invoice.paid_amount === 0;

  async function handleVoid() {
    if (!canVoid) return;

    setVoiding(true);
    try {
      const res = await fetch("/api/invoices/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(body?.error || `Ошибка (status ${res.status})`);
        return;
      }

      // Refresh page to show updated status
      router.refresh();
      setShowVoidModal(false);
    } catch (err) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setVoiding(false);
    }
  }

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] text-muted-foreground">
            Счёт · {statusLabel(invoice.status)}
          </div>
          <h1 className="text-[20px] font-semibold">
            {invoice.cut_name ?? "Без кроя"}{" "}
            <span className="text-muted-foreground font-normal">
              ({fmtDate(invoice.cut_date)})
            </span>
          </h1>
          <div className="text-[13px] text-muted-foreground mt-1">
            Контрагент: <span className="text-foreground">{invoice.counterparty_name}</span>
            {" · "}Дата выставления: <span className="text-foreground">{fmtDate(invoice.issue_date)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {canVoid && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="h-9 px-3 rounded-md border border-red-300 text-red-600 text-[13px] hover:bg-red-50"
            >
              Аннулировать
            </button>
          )}
          <a
            href={`/api/invoices/pdf?invoice_id=${invoice.id}`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-md border border-border text-[13px] hover:bg-muted/50 inline-flex items-center"
          >
            PDF
          </a>
          <button
            onClick={() => router.back()}
            className="h-9 px-3 rounded-md border border-border text-[13px] hover:bg-muted/50"
          >
            Назад
          </button>
        </div>
      </div>

      {/* Void Confirmation Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-card">
            <h2 className="text-lg font-semibold mb-2">Аннулировать счёт?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Это действие нельзя отменить. Счёт будет помечен как аннулированный, все строки будут удалены,
              а крой вернётся в список "невыставленных".
            </p>
            {invoice.paid_amount > 0 && (
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Внимание: у счёта есть оплата ({invoice.paid_amount} руб.). Аннулирование невозможно.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowVoidModal(false)}
                disabled={voiding}
                className="h-9 px-4 rounded-md border border-border text-[13px] hover:bg-muted/50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || invoice.paid_amount > 0}
                className="h-9 px-4 rounded-md bg-red-600 text-white text-[13px] hover:bg-red-700 disabled:opacity-50"
              >
                {voiding ? "..." : "Аннулировать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lines Editor */}
      <InvoiceLinesEditor invoiceId={invoiceId} orgId={orgId} mode="full" />
    </main>
  );
}
