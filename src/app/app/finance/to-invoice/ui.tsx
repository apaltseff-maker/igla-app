"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  cut_id: string;
  cut_date: string | null;
  cut_name: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  planned_qty: number | null;
};

function includesCI(haystack: string | null | undefined, needle: string) {
  if (!needle) return true;
  return (haystack ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  // iso может быть 'YYYY-MM-DD'
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function ToInvoiceClient({ rows }: { rows: Row[] }) {
  const router = useRouter();

  const [qCut, setQCut] = useState("");
  const [qCounterparty, setQCounterparty] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      return includesCI(r.cut_name, qCut) && includesCI(r.counterparty_name, qCounterparty);
    });
  }, [rows, qCut, qCounterparty]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">Крои без выставленных счетов</h1>
          <div className="text-[13px] text-muted-foreground">
            Нажми на строку — откроется выставление счёта по крою.
          </div>
        </div>
      </div>

      {/* Фильтры как Excel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <div className="text-[12px] text-muted-foreground">Название кроя</div>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
            value={qCut}
            onChange={(e) => setQCut(e.target.value)}
            placeholder="Например: лексипик"
          />
        </label>

        <label className="space-y-1">
          <div className="text-[12px] text-muted-foreground">Контрагент</div>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
            value={qCounterparty}
            onChange={(e) => setQCounterparty(e.target.value)}
            placeholder="Например: WB / ИП ..."
          />
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
              <th className="px-3 py-2 font-medium w-[110px]">Дата</th>
              <th className="px-3 py-2 font-medium">Название</th>
              <th className="px-3 py-2 font-medium w-[220px]">Контрагент</th>
              <th className="px-3 py-2 font-medium w-[110px] text-right">План (шт)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.cut_id}
                className="cursor-pointer hover:bg-muted/50 transition"
                onClick={() => router.push(`/app/finance/to-invoice/${r.cut_id}`)}
              >
                <td className="px-3 py-2 tabular-nums">{fmtDate(r.cut_date)}</td>
                <td className="px-3 py-2">{r.cut_name ?? ""}</td>
                <td className="px-3 py-2">
                  {r.counterparty_name ? (
                    r.counterparty_name
                  ) : (
                    <span className="text-muted-foreground">не выбран</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.planned_qty ?? 0}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                  Нет кроев без счетов по текущим фильтрам.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
