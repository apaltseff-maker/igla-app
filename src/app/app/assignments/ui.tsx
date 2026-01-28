"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRUDate } from "@/lib/format";

type Sewer = { id: string; full_name: string; code: string };

type BundleLookup = {
  bundle: {
    id: string;
    bundle_no: string;
    cut_id: string;
    cut_name: string;
    color: string | null;
    size: string | null;
    qty_total: number;
  };
  assigned_total: number;
  available: number;
};

type Row = {
  assignment_id: string;
  assigned_at: string;

  cut_id: string;
  cut_doc_name: string | null;

  bundle_id: string;
  bundle_no: string;

  sewer_employee_id: string;
  sewer_code: string;
  sewer_full_name: string;

  item_cut_name: string | null;
  color: string | null;
  size: string | null;

  qty_total: number;
  assigned_qty: number;
  assigned_total_in_bundle: number;
  remaining_in_bundle: number;

  party_no: string;

  rate_final: number | null;
  base_rate: number | null;
  effective_rate: number | null;
};

function startsWithCI(a: string, b: string) {
  return a.toLowerCase().startsWith(b.toLowerCase());
}


export default function AssignmentsClient({ sewers }: { sewers: Sewer[] }) {
  const router = useRouter();

  // form
  const [bundleNo, setBundleNo] = useState("");
  const [sewerQuery, setSewerQuery] = useState(""); // ввод "12" или "ка"
  const [sewerCode, setSewerCode] = useState(sewers[0]?.code ?? "");
  const [qty, setQty] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  // lookup bundle availability
  const [lookup, setLookup] = useState<BundleLookup | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  // table rows
  const [rows, setRows] = useState<Row[]>([]);
  const [rowsErr, setRowsErr] = useState<string | null>(null);

  // excel-like filters
  const [f, setF] = useState({
    date: "",
    cut: "",
    sewer: "",
    item: "",
    qtyTotal: "",
    qtyAssigned: "",
    remaining: "",
    rate: "",
    party: "",
    bundle: "",
  });

  const filteredSewers = useMemo(() => {
    const q = sewerQuery.trim();
    if (!q) return sewers;
    return sewers.filter(
      (s) => startsWithCI(s.code, q) || startsWithCI(s.full_name, q)
    );
  }, [sewers, sewerQuery]);

  // выбрать швею по вводу: если ввели код полностью и он есть — подставим
  useEffect(() => {
    const q = sewerQuery.trim();
    if (!q) return;
    const exact = sewers.find((s) => s.code === q);
    if (exact) setSewerCode(exact.code);
  }, [sewerQuery, sewers]);

  async function loadLookup(bn: string) {
    const b = bn.trim();
    if (!b) {
      setLookup(null);
      setLookupErr(null);
      return;
    }
    setLookupBusy(true);
    setLookupErr(null);
    try {
      const res = await fetch("/api/bundles/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle_no: b }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookup(null);
        setLookupErr(body?.error || `Ошибка (status ${res.status})`);
        return;
      }
      setLookup(body as BundleLookup);
    } finally {
      setLookupBusy(false);
    }
  }

  async function loadRows(bn: string) {
    setRowsErr(null);
    const res = await fetch("/api/assignments/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle_no: bn.trim() || null }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRows([]);
      setRowsErr(body?.error || `Ошибка (status ${res.status})`);
      return;
    }
    setRows((body.rows || []) as Row[]);
  }

  // при изменении bundleNo подгружаем доступность и строки
  useEffect(() => {
    const t = setTimeout(() => {
      loadLookup(bundleNo);
      loadRows(bundleNo);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleNo]);

  async function submit() {
    if (!bundleNo.trim()) return alert("Введите № пачки");
    if (!sewerCode.trim()) return alert("Выберите/введите код швеи");
    if (!qty || qty <= 0) return alert("Введите количество > 0");

    // клиентская подсказка по лимиту (БД всё равно защитит триггером)
    if (lookup && qty > lookup.available) {
      return alert(`Нельзя выдать ${qty}. Доступно: ${lookup.available}`);
    }

    setBusy(true);
    try {
      const res = await fetch("/api/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle_no: bundleNo.trim(),
          sewer_code: sewerCode.trim(),
          qty,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return alert(body?.error || `Ошибка (status ${res.status})`);

      setQty(0);
      await loadLookup(bundleNo);
      await loadRows(bundleNo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const qDate = f.date.trim().toLowerCase();
    const qCut = f.cut.trim().toLowerCase();
    const qSewer = f.sewer.trim().toLowerCase();
    const qItem = f.item.trim().toLowerCase();
    const qQtyTotal = f.qtyTotal.trim();
    const qQtyAssigned = f.qtyAssigned.trim();
    const qRem = f.remaining.trim();
    const qParty = f.party.trim().toLowerCase();
    const qBundle = f.bundle.trim().toLowerCase();

    return rows.filter((r) => {
      const item = `${r.item_cut_name ?? ""} / ${r.color ?? ""} / ${r.size ?? ""}`.toLowerCase();

      if (qBundle && !String(r.bundle_no ?? "").toLowerCase().includes(qBundle)) return false;
      if (qDate && !formatRUDate(r.assigned_at).toLowerCase().includes(qDate)) return false;
      if (qCut && !String(r.cut_doc_name ?? "").toLowerCase().includes(qCut)) return false;
      if (qSewer && !(`${r.sewer_code} ${r.sewer_full_name}`.toLowerCase().includes(qSewer))) return false;
      if (qItem && !item.includes(qItem)) return false;

      if (qQtyTotal && !String(r.qty_total ?? "").includes(qQtyTotal)) return false;
      if (qQtyAssigned && !String(r.assigned_qty ?? "").includes(qQtyAssigned)) return false;
      if (qRem && !String(r.remaining_in_bundle ?? "").includes(qRem)) return false;

      if (qParty && !String(r.party_no ?? "").toLowerCase().includes(qParty)) return false;

      return true;
    });
  }, [rows, f]);

  async function updateRow(assignment_id: string, patch: { qty?: number; sewer_code?: string }) {
    const res = await fetch("/api/assignments/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id, ...patch }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body?.error || `Ошибка (status ${res.status})`);
      return;
    }
    await loadLookup(bundleNo);
    await loadRows(bundleNo);
    router.refresh();
  }

  async function setBundleRate(bundle_id: string, rate_final: number) {
    const res = await fetch("/api/bundles/set-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle_id, rate_final }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body?.error || `Ошибка сохранения расценки (status ${res.status})`);
      return;
    }
    await loadLookup(bundleNo);
    await loadRows(bundleNo);
    router.refresh();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Выдача швее</h1>

      {/* Форма */}
      <div className="border border-border rounded-xl p-4 bg-card shadow-soft">
        <div className="flex flex-wrap gap-3 items-end">
          {/* № пачки */}
          <label className="flex-shrink-0 grid gap-1 min-w-[140px] lg:min-w-[200px]">
            <span className="text-sm font-medium text-text">№ пачки</span>
            <input
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={bundleNo}
              onChange={(e) => setBundleNo(e.target.value)}
              placeholder="95900"
            />
          </label>

          {/* Швея с автокомплитом */}
          <div className="flex-1 min-w-[200px] grid gap-1 relative">
            <span className="text-sm font-medium text-text">Швея (код)</span>
            <div className="relative">
              <input
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                value={sewerQuery}
                onChange={(e) => setSewerQuery(e.target.value)}
                placeholder="код или имя"
              />

              {sewerQuery.trim() && filteredSewers.length > 0 && (
                <div className="absolute left-0 right-0 top-[44px] bg-card border border-border rounded-xl shadow-card z-20 max-h-56 overflow-auto">
                  {filteredSewers.slice(0, 20).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-bg text-sm"
                      onClick={() => {
                        setSewerCode(s.code);
                        setSewerQuery("");
                      }}
                    >
                      <span className="font-semibold">{s.code}</span> — {s.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Фиксированная высота под "Выбрано" чтобы не ломать сетку */}
            <div className="text-xs text-muted h-4">
              {sewerCode ? <>Выбрано: <b className="text-text">{sewerCode}</b></> : null}
            </div>
          </div>

          {/* Кол-во */}
          <label className="flex-shrink-0 grid gap-1 min-w-[100px] lg:min-w-[140px]">
            <span className="text-sm font-medium text-text">Кол-во</span>
            <input
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              type="number"
              min={0}
              value={qty || ""}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>

          {/* Кнопка */}
          <button
            type="button"
            className="flex-shrink-0 h-10 rounded-xl bg-primary text-primary-contrast font-medium text-sm px-4 disabled:opacity-50 hover:opacity-90 transition-opacity"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "..." : "Выдать"}
          </button>
        </div>

        {/* Инфо-строка под формой */}
        <div className="mt-3 pt-3 border-t border-border text-sm">
          {lookupBusy && <span className="text-muted">Загрузка…</span>}
          {!lookupBusy && lookup && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <span className="text-muted">Позиция:</span>{" "}
                <b>{lookup.bundle.cut_name}</b> / {lookup.bundle.color ?? ""} / {lookup.bundle.size ?? ""}
              </div>
              <div>
                <span className="text-muted">В пачке:</span> <b>{lookup.bundle.qty_total}</b>
              </div>
              <div>
                <span className="text-muted">Доступно:</span>{" "}
                <b className={lookup.available <= 0 ? "text-danger" : "text-success"}>{lookup.available}</b>
              </div>
            </div>
          )}
          {!lookupBusy && lookupErr && <div className="text-danger">{lookupErr}</div>}
          {!lookupBusy && !lookup && !lookupErr && (
            <span className="text-muted">Введите № пачки для проверки доступности</span>
          )}
        </div>
      </div>

      {/* Таблица (компактная) */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <colgroup>
            <col className="w-[80px]" />   {/* Дата */}
            <col className="w-[70px]" />   {/* № кроя */}
            <col className="w-[70px]" />   {/* № пачки */}
            <col className="w-[70px]" />   {/* № швеи */}
            <col />                        {/* Артикул (резиновая) */}
            <col className="w-[50px]" />   {/* В пачке */}
            <col className="w-[70px]" />   {/* Взяли */}
            <col className="w-[55px]" />   {/* Осталось */}
            <col className="w-[75px]" />   {/* Расценка */}
            <col className="w-[90px]" />   {/* Партия */}
          </colgroup>
          <thead className="bg-bg">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
              <th className="px-2 py-1.5 text-left font-semibold">Крой</th>
              <th className="px-2 py-1.5 text-left font-semibold">Пачка</th>
              <th className="px-2 py-1.5 text-left font-semibold">Швея</th>
              <th className="px-2 py-1.5 text-left font-semibold">Артикул / цвет / размер</th>
              <th className="px-2 py-1.5 text-right font-semibold">Шт</th>
              <th className="px-2 py-1.5 text-right font-semibold">Взяли</th>
              <th className="px-2 py-1.5 text-right font-semibold">Ост</th>
              <th className="px-2 py-1.5 text-right font-semibold">Ставка</th>
              <th className="px-2 py-1.5 text-left font-semibold">Партия</th>
            </tr>

            {/* фильтры */}
            <tr className="border-t border-border bg-card">
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.date} onChange={e=>setF(v=>({...v,date:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.cut} onChange={e=>setF(v=>({...v,cut:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.bundle} onChange={e=>setF(v=>({...v,bundle:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.sewer} onChange={e=>setF(v=>({...v,sewer:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.item} onChange={e=>setF(v=>({...v,item:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.qtyTotal} onChange={e=>setF(v=>({...v,qtyTotal:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.qtyAssigned} onChange={e=>setF(v=>({...v,qtyAssigned:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.remaining} onChange={e=>setF(v=>({...v,remaining:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.rate} onChange={e=>setF(v=>({...v,rate:e.target.value}))} />
              </th>
              <th className="px-1 py-1">
                <input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.party} onChange={e=>setF(v=>({...v,party:e.target.value}))} />
              </th>
            </tr>
          </thead>

          <tbody className="bg-card">
            {rowsErr && (
              <tr>
                <td colSpan={10} className="px-2 py-2 text-danger">
                  {rowsErr}
                </td>
              </tr>
            )}

            {shown.map((r) => (
              <tr key={r.assignment_id} className="border-t border-border hover:bg-bg/50">
                <td className="px-2 py-1.5 whitespace-nowrap">{formatRUDate(r.assigned_at)}</td>

                <td className="px-2 py-1.5">
                  <a className="text-accent hover:underline" href={`/app/cuts/${r.cut_id}`}>
                    {r.cut_doc_name ?? "—"}
                  </a>
                </td>

                <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.bundle_no}</td>

                <td className="px-2 py-1.5">
                  <select
                    className="h-7 w-full rounded-lg border border-border px-1 text-xs bg-card"
                    value={r.sewer_code}
                    onChange={(e) => updateRow(r.assignment_id, { sewer_code: e.target.value })}
                  >
                    {sewers.map((s) => (
                      <option key={s.id} value={s.code}>{s.code}</option>
                    ))}
                  </select>
                </td>

                <td className="px-2 py-1.5 truncate" title={`${r.item_cut_name ?? ""} / ${r.color ?? ""} / ${r.size ?? ""}`}>
                  {r.item_cut_name ?? "—"} / {r.color ?? ""} / {r.size ?? ""}
                </td>

                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.qty_total}</td>

                <td className="px-2 py-1.5 text-right">
                  <input
                    className="h-7 w-full rounded-lg border border-border px-1.5 text-xs text-right tabular-nums bg-card"
                    type="number"
                    min={0}
                    defaultValue={r.assigned_qty}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!v || v <= 0) {
                        e.target.value = String(r.assigned_qty);
                        return;
                      }
                      if (v !== r.assigned_qty) updateRow(r.assignment_id, { qty: v });
                    }}
                  />
                </td>

                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.remaining_in_bundle}</td>

                <td className="px-2 py-1.5 text-right">
                  <input
                    className="h-7 w-full rounded-lg border border-border px-1.5 text-xs text-right tabular-nums bg-card"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={r.effective_rate ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v) || v < 0) {
                        e.target.value = String(r.effective_rate ?? "");
                        return;
                      }
                      if (v !== Number(r.effective_rate ?? 0)) {
                        await setBundleRate(r.bundle_id, v);
                      }
                    }}
                  />
                </td>

                <td className="px-2 py-1.5 whitespace-nowrap">{r.party_no}</td>
              </tr>
            ))}

            {shown.length === 0 && !rowsErr && (
              <tr>
                <td colSpan={10} className="px-2 py-3 text-muted">
                  Нет выдач (или фильтры всё отфильтровали)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
