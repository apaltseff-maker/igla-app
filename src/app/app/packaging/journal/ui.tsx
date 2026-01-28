"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  event_id: string;
  ts: string;
  packed_qty: number;
  defect_qty: number;
  rate_override: number | null;

  bundle_no: string;
  color: string;

  cut_id: string;
  product_id: string;
  product_display: string;
  product_base_rate: number | null;

  sewer_employee_id: string | null;
  sewer_code: string | null;
  sewer_name: string | null;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function PackagingJournalClient() {
  const router = useRouter();

  const [dateFrom, setDateFrom] = useState(() => isoDate(new Date(Date.now() - 7 * 864e5)));
  const [dateTo, setDateTo] = useState(() => isoDate(new Date(Date.now() + 1 * 864e5)));
  const [bundleNo, setBundleNo] = useState("");
  const [sewerEmployeeId, setSewerEmployeeId] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (dateFrom) sp.set("date_from", dateFrom);
    if (dateTo) sp.set("date_to", dateTo);
    if (bundleNo.trim()) sp.set("bundle_no", bundleNo.trim());
    if (sewerEmployeeId) sp.set("sewer_employee_id", sewerEmployeeId);
    sp.set("limit", "200");
    return sp.toString();
  }, [dateFrom, dateTo, bundleNo, sewerEmployeeId]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/packaging/journal?${query}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Не удалось загрузить журнал");
      setRows(j.rows ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function deleteEvent(eventId: string) {
    if (!confirm("Удалить запись упаковки? Она исчезнет из факта и из расчёта ЗП.")) return;
    const res = await fetch("/api/packaging/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j?.error ?? "Ошибка удаления");
      return;
    }
    await load();
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <label className="text-[12px]">
          <div className="text-muted-foreground mb-1">С</div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-full rounded-md border border-border px-2 text-[13px]" />
        </label>
        <label className="text-[12px]">
          <div className="text-muted-foreground mb-1">По</div>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-full rounded-md border border-border px-2 text-[13px]" />
        </label>
        <label className="text-[12px]">
          <div className="text-muted-foreground mb-1">Пачка (bundle_no)</div>
          <input value={bundleNo} onChange={(e) => setBundleNo(e.target.value)}
            placeholder="например 12345"
            className="h-9 w-full rounded-md border border-border px-2 text-[13px]" />
        </label>
        <label className="text-[12px]">
          <div className="text-muted-foreground mb-1">Швея (ID)</div>
          <input value={sewerEmployeeId} onChange={(e) => setSewerEmployeeId(e.target.value)}
            placeholder="пока ID"
            className="h-9 w-full rounded-md border border-border px-2 text-[13px]" />
        </label>
      </div>

      {err ? <div className="mt-3 text-[12px] text-red-600">{err}</div> : null}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3">Время</th>
              <th className="text-left py-2 pr-3">Пачка</th>
              <th className="text-left py-2 pr-3">Модель</th>
              <th className="text-left py-2 pr-3">Цвет</th>
              <th className="text-left py-2 pr-3">Швея</th>
              <th className="text-right py-2 pr-3">Упак.</th>
              <th className="text-right py-2 pr-3">Брак</th>
              <th className="text-right py-2 pr-3">Ставка</th>
              <th className="text-right py-2 pr-3">Сумма</th>
              <th className="text-right py-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-4 text-muted-foreground">Загрузка…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-4 text-muted-foreground">Нет записей</td></tr>
            ) : (
              rows.map((r) => {
                const rate = r.rate_override ?? r.product_base_rate ?? 0;
                const amount = (r.packed_qty ?? 0) * Number(rate || 0);
                return (
                  <tr key={r.event_id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-2 pr-3">{new Date(r.ts).toLocaleString()}</td>
                    <td className="py-2 pr-3">{r.bundle_no}</td>
                    <td className="py-2 pr-3">{r.product_display}</td>
                    <td className="py-2 pr-3">{r.color}</td>
                    <td className="py-2 pr-3">
                      {r.sewer_name ? `${r.sewer_name}${r.sewer_code ? ` (${r.sewer_code})` : ""}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">{r.packed_qty}</td>
                    <td className="py-2 pr-3 text-right">{r.defect_qty}</td>
                    <td className="py-2 pr-3 text-right">{rate ? String(rate) : "—"}</td>
                    <td className="py-2 pr-3 text-right">{amount ? amount.toFixed(0) : "0"}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => deleteEvent(r.event_id)}
                        className="h-7 px-2 rounded-md border border-border text-[12px] hover:bg-muted/50"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        Удаление убирает запись из факта и из расчёта ЗП.
      </div>
    </div>
  );
}
