"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRUDate } from "@/lib/format";

type NotAssignedRow = {
  cut_id: string;
  cut_name: string | null;
  cut_date: string | null;
  bundle_id: string;
  bundle_no: string;
  product_display: string;
  color: string | null;
  size: string | null;
  qty_total: number;
  assigned_total: number;
  remaining: number;
};

type WipRow = {
  sewer_employee_id: string;
  sewer_code: string;
  sewer_full_name: string;
  bundle_id: string;
  bundle_no: string;
  product_display: string;
  color: string | null;
  size: string | null;
  took_qty: number;
  closed_qty: number;
  remaining: number;
};

export default function WipReportClient({
  notAssigned,
  wip,
}: {
  notAssigned: NotAssignedRow[];
  wip: WipRow[];
}) {
  const router = useRouter();

  // Filters for "Не выдали"
  const [f1, setF1] = useState({
    cut_name: "",
    bundle_no: "",
    product: "",
    color: "",
    size: "",
  });

  // Filters for "В работе"
  const [f2, setF2] = useState({
    sewer: "",
    bundle_no: "",
    product: "",
    color: "",
    size: "",
  });

  const filteredNotAssigned = useMemo(() => {
    return notAssigned.filter((r) => {
      if (f1.cut_name && !r.cut_name?.toLowerCase().includes(f1.cut_name.toLowerCase())) return false;
      if (f1.bundle_no && !r.bundle_no.includes(f1.bundle_no)) return false;
      if (f1.product && !r.product_display.toLowerCase().includes(f1.product.toLowerCase())) return false;
      if (f1.color && !r.color?.toLowerCase().includes(f1.color.toLowerCase())) return false;
      if (f1.size && !r.size?.toLowerCase().includes(f1.size.toLowerCase())) return false;
      return true;
    });
  }, [notAssigned, f1]);

  const filteredWip = useMemo(() => {
    return wip.filter((r) => {
      const sewerStr = `${r.sewer_code} ${r.sewer_full_name}`.toLowerCase();
      if (f2.sewer && !sewerStr.includes(f2.sewer.toLowerCase())) return false;
      if (f2.bundle_no && !r.bundle_no.includes(f2.bundle_no)) return false;
      if (f2.product && !r.product_display.toLowerCase().includes(f2.product.toLowerCase())) return false;
      if (f2.color && !r.color?.toLowerCase().includes(f2.color.toLowerCase())) return false;
      if (f2.size && !r.size?.toLowerCase().includes(f2.size.toLowerCase())) return false;
      return true;
    });
  }, [wip, f2]);

  const totalNotAssigned = filteredNotAssigned.reduce((s, r) => s + r.remaining, 0);
  const totalWip = filteredWip.reduce((s, r) => s + r.remaining, 0);

  const inputClass = "h-8 rounded-lg border border-border bg-card px-2 text-xs focus:border-accent focus:ring-1 focus:ring-accent/20";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Отчёт: В работе</h1>

      {/* Таблица 1: Не выдали в работу */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Не выдали в работу</h2>
          <span className="text-sm text-muted">
            Всего: <b className="text-text">{totalNotAssigned}</b> шт в {filteredNotAssigned.length} пачках
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <colgroup>
              <col className="w-[80px]" />
              <col className="w-[100px]" />
              <col className="w-[70px]" />
              <col />
              <col className="w-[80px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[70px]" />
              <col className="w-[70px]" />
            </colgroup>
            <thead className="bg-bg">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
                <th className="px-2 py-1.5 text-left font-semibold">Крой</th>
                <th className="px-2 py-1.5 text-left font-semibold">№ пачки</th>
                <th className="px-2 py-1.5 text-left font-semibold">Артикул</th>
                <th className="px-2 py-1.5 text-left font-semibold">Цвет</th>
                <th className="px-2 py-1.5 text-left font-semibold">Размер</th>
                <th className="px-2 py-1.5 text-right font-semibold">Всего</th>
                <th className="px-2 py-1.5 text-right font-semibold">Выдано</th>
                <th className="px-2 py-1.5 text-right font-semibold">Остаток</th>
              </tr>
              <tr className="bg-bg/50">
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f1.cut_name}
                    onChange={(e) => setF1({ ...f1, cut_name: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="№"
                    value={f1.bundle_no}
                    onChange={(e) => setF1({ ...f1, bundle_no: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f1.product}
                    onChange={(e) => setF1({ ...f1, product: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f1.color}
                    onChange={(e) => setF1({ ...f1, color: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f1.size}
                    onChange={(e) => setF1({ ...f1, size: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1"></td>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filteredNotAssigned.map((r) => (
                <tr
                  key={r.bundle_id}
                  className="border-t border-border hover:bg-bg/50 cursor-pointer"
                  onClick={() => router.push(`/app/cuts/${r.cut_id}`)}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatRUDate(r.cut_date)}</td>
                  <td className="px-2 py-1.5 truncate" title={r.cut_name ?? ""}>{r.cut_name}</td>
                  <td className="px-2 py-1.5 font-semibold">{r.bundle_no}</td>
                  <td className="px-2 py-1.5 truncate" title={r.product_display}>{r.product_display}</td>
                  <td className="px-2 py-1.5 truncate">{r.color}</td>
                  <td className="px-2 py-1.5">{r.size}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.qty_total}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.assigned_total}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-accent">{r.remaining}</td>
                </tr>
              ))}
              {filteredNotAssigned.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-muted" colSpan={9}>
                    Всё выдано в работу 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Таблица 2: Что у кого в работе */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Что у кого в работе</h2>
          <span className="text-sm text-muted">
            Всего: <b className="text-text">{totalWip}</b> шт у {new Set(filteredWip.map((r) => r.sewer_employee_id)).size} швей
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[70px]" />
              <col />
              <col className="w-[80px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[70px]" />
            </colgroup>
            <thead className="bg-bg">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold">Швея</th>
                <th className="px-2 py-1.5 text-left font-semibold">№ пачки</th>
                <th className="px-2 py-1.5 text-left font-semibold">Артикул</th>
                <th className="px-2 py-1.5 text-left font-semibold">Цвет</th>
                <th className="px-2 py-1.5 text-left font-semibold">Размер</th>
                <th className="px-2 py-1.5 text-right font-semibold">Взяла</th>
                <th className="px-2 py-1.5 text-right font-semibold">Сдала</th>
                <th className="px-2 py-1.5 text-right font-semibold">Остаток</th>
              </tr>
              <tr className="bg-bg/50">
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="код или имя"
                    value={f2.sewer}
                    onChange={(e) => setF2({ ...f2, sewer: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="№"
                    value={f2.bundle_no}
                    onChange={(e) => setF2({ ...f2, bundle_no: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f2.product}
                    onChange={(e) => setF2({ ...f2, product: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f2.color}
                    onChange={(e) => setF2({ ...f2, color: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inputClass + " w-full"}
                    placeholder="фильтр"
                    value={f2.size}
                    onChange={(e) => setF2({ ...f2, size: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1"></td>
                <td className="px-2 py-1"></td>
              </tr>
            </thead>
            <tbody className="bg-card">
              {filteredWip.map((r) => (
                <tr
                  key={`${r.sewer_employee_id}-${r.bundle_id}`}
                  className="border-t border-border hover:bg-bg/50 cursor-pointer"
                  onClick={() => router.push(`/app/bundles/${r.bundle_id}`)}
                >
                  <td className="px-2 py-1.5 truncate" title={r.sewer_full_name}>
                    <span className="font-semibold">{r.sewer_code}</span> — {r.sewer_full_name}
                  </td>
                  <td className="px-2 py-1.5 font-semibold">{r.bundle_no}</td>
                  <td className="px-2 py-1.5 truncate" title={r.product_display}>{r.product_display}</td>
                  <td className="px-2 py-1.5 truncate">{r.color}</td>
                  <td className="px-2 py-1.5">{r.size}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.took_qty}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.closed_qty}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-accent">{r.remaining}</td>
                </tr>
              ))}
              {filteredWip.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-muted" colSpan={8}>
                    Все швеи сдали работу 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
