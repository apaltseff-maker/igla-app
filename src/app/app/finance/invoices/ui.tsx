"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  invoice_id: string;
  issue_date: string;
  status: string;
  basis: string;
  current_amount: number;
  paid_amount: number;
  cut_id: string;
  cut_date: string | null;
  cut_name: string | null;
  counterparty_id: string;
  counterparty_name: string;
  planned_qty: number;
  final_qty: number;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function includesCI(h: string | null | undefined, n: string) {
  if (!n) return true;
  return (h ?? "").toLowerCase().includes(n.trim().toLowerCase());
}

function statusLabel(s: string) {
  if (s === "draft") return "Черновик";
  if (s === "waiting_payment") return "Ждёт оплаты";
  if (s === "part_paid") return "Частично";
  if (s === "paid") return "Оплачено";
  if (s === "void") return "Аннулирован";
  return s;
}

export function InvoicesClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okQ = includesCI(r.cut_name, q) || includesCI(r.counterparty_name, q);
      const okS = !status || r.status === status;
      return okQ && okS;
    });
  }, [rows, q, status]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">Счета</h1>
          <div className="text-[13px] text-muted-foreground">Список счетов по кроям.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <div className="text-[12px] text-muted-foreground">Поиск (крой/контрагент)</div>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="например: рарав / WB"
          />
        </label>

        <label className="space-y-1">
          <div className="text-[12px] text-muted-foreground">Статус</div>
          <select
            className="h-9 w-full rounded-md border border-border px-3 text-[13px] bg-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">любой</option>
            <option value="draft">черновик</option>
            <option value="waiting_payment">ждёт оплаты</option>
            <option value="part_paid">частично</option>
            <option value="paid">оплачено</option>
            <option value="void">аннулирован</option>
          </select>
        </label>

        <div className="flex items-end">
          <div className="text-[12px] text-muted-foreground">
            Строк: <span className="text-foreground">{filtered.length}</span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-[110px]">Дата кроя</th>
              <th className="px-3 py-2 font-medium">Название кроя</th>
              <th className="px-3 py-2 font-medium w-[220px]">Контрагент</th>
              <th className="px-3 py-2 font-medium w-[110px] text-right">План (шт)</th>
              <th className="px-3 py-2 font-medium w-[140px] text-right">Сумма</th>
              <th className="px-3 py-2 font-medium w-[120px]">Статус</th>
              <th className="px-3 py-2 font-medium w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.invoice_id}
                className="hover:bg-muted/50 transition cursor-pointer"
                onClick={() => router.push(`/app/finance/invoices/${r.invoice_id}`)}
              >
                <td className="px-3 py-2 tabular-nums">{fmtDate(r.cut_date)}</td>
                <td className="px-3 py-2">{r.cut_name ?? ""}</td>
                <td className="px-3 py-2">{r.counterparty_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.planned_qty ?? 0}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.current_amount ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2">{statusLabel(r.status)}</td>
                <td className="px-3 py-2">
                  <a
                    className="text-[12px] text-blue-600 hover:underline"
                    href={`/api/invoices/pdf?invoice_id=${r.invoice_id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  Нет счетов по текущим фильтрам.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
