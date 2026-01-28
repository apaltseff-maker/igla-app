"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRUDate } from "@/lib/format";

type Preview = {
  bundle_id: string;
  bundle_no: string;
  cut_id: string;
  cut_doc_name: string;
  item_cut_name: string;
  color: string | null;
  size: string | null;
  qty_total: number;

  sewer_employee_id: string;
  sewer_code: string;
  sewer_full_name: string;

  assigned_to_sewer: number;
  closed_to_sewer: number;
  remaining_to_sewer: number;

  rate_final: number | null;
  base_rate: number | null;
};

type Row = {
  bundle_id: string;
  bundle_no: string;
  cut_id: string;
  cut_doc_name: string;
  item_cut_name: string;
  color: string | null;
  size: string | null;
  qty_total: number;

  sewer_employee_id: string;
  sewer_code: string;
  sewer_full_name: string;

  assigned_to_sewer: number;
  packed_to_sewer: number;
  defect_to_sewer: number;
  closed_to_sewer: number;
  remaining_to_sewer: number;

  party_no: string;
  last_packaged_at: string | null;
};


export default function PackagingClient() {
  const router = useRouter();

  const [partyNo, setPartyNo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [packed, setPacked] = useState<number>(0);
  const [defect, setDefect] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const [rate, setRate] = useState<number>(0);
  const [rateBusy, setRateBusy] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [rowsErr, setRowsErr] = useState<string | null>(null);

  const [f, setF] = useState({
    date: "",
    party: "",
    bundle: "",
    sewer: "",
    item: "",
    assigned: "",
    packed: "",
    defect: "",
    remaining: "",
  });

  async function loadActive() {
    setRowsErr(null);
    const res = await fetch("/api/packaging/list", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRows([]);
      setRowsErr(body?.error || `Ошибка (status ${res.status})`);
      return;
    }
    setRows((body.rows || []) as Row[]);
  }

  async function openPreview() {
    const p = partyNo.trim();
    if (!p) return alert("Введите номер партии");
    setPreviewBusy(true);
    setPreviewErr(null);
    try {
      const res = await fetch("/api/packaging/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_no: p }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreview(null);
        setPreviewErr(body?.error || `Ошибка (status ${res.status})`);
        return;
      }
      const pr = body.preview as Preview;
      setPreview(pr);
      const effective = pr.rate_final ?? pr.base_rate ?? 0;
      setRate(Number(effective));
      // подгрузим таблицу (чтобы была актуальная)
      await loadActive();
    } finally {
      setPreviewBusy(false);
    }
  }

  async function addPackaging() {
    if (!preview) return alert("Сначала нажмите \"Упаковать\"");
    if ((packed || 0) + (defect || 0) <= 0) return alert("Введите упаковано и/или брак > 0");

    setBusy(true);
    try {
      const res = await fetch("/api/packaging/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_no: partyNo.trim(),
          packed_qty: packed || 0,
          defect_qty: defect || 0,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) return alert(body?.error || `Ошибка (status ${res.status})`);

      // сброс формы — готово к следующему скану
      setPacked(0);
      setDefect(0);
      setPartyNo("");
      setPreview(null);
      setPreviewErr(null);

      // обновим таблицу
      await loadActive();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const qDate = f.date.trim().toLowerCase();
    const qParty = f.party.trim().toLowerCase();
    const qBundle = f.bundle.trim().toLowerCase();
    const qSewer = f.sewer.trim().toLowerCase();
    const qItem = f.item.trim().toLowerCase();

    return rows.filter((r) => {
      const item = `${r.item_cut_name ?? ""} / ${r.color ?? ""} / ${r.size ?? ""}`.toLowerCase();
      if (qDate && !formatRUDate(r.last_packaged_at).toLowerCase().includes(qDate)) return false;
      if (qParty && !String(r.party_no ?? "").toLowerCase().includes(qParty)) return false;
      if (qBundle && !String(r.bundle_no ?? "").toLowerCase().includes(qBundle)) return false;
      if (qSewer && !(`${r.sewer_full_name} ${r.sewer_code}`.toLowerCase().includes(qSewer))) return false;
      if (qItem && !item.includes(qItem)) return false;

      if (f.assigned.trim() && !String(r.assigned_to_sewer ?? "").includes(f.assigned.trim())) return false;
      if (f.packed.trim() && !String(r.packed_to_sewer ?? "").includes(f.packed.trim())) return false;
      if (f.defect.trim() && !String(r.defect_to_sewer ?? "").includes(f.defect.trim())) return false;
      if (f.remaining.trim() && !String(r.remaining_to_sewer ?? "").includes(f.remaining.trim())) return false;

      return true;
    });
  }, [rows, f]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Упаковка</h1>

      {/* Шаг 1: ввод партии */}
      <div className="border border-border rounded-xl p-4 bg-card shadow-soft">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 items-end">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-text">Номер партии</span>
            <input
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={partyNo}
              onChange={(e) => setPartyNo(e.target.value)}
              placeholder="123454-12"
            />
          </label>

          <button
            className="h-10 rounded-xl bg-primary text-primary-contrast font-medium text-sm px-4 disabled:opacity-50 hover:opacity-90 transition-opacity"
            onClick={openPreview}
            disabled={previewBusy}
            type="button"
          >
            {previewBusy ? "..." : "Найти"}
          </button>
        </div>

        {previewErr && <div className="mt-2 text-sm text-danger">{previewErr}</div>}

        {/* Шаг 2: карточка пачки + ввод упаковано/брак */}
        {preview && (
          <div className="mt-4 border border-border rounded-xl p-4 bg-bg/50">
            {/* Инфо о партии */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
              <div>
                <div className="text-muted text-xs">Артикул</div>
                <div className="font-semibold">{preview.item_cut_name}</div>
              </div>
              <div>
                <div className="text-muted text-xs">Цвет / Размер</div>
                <div className="font-medium">{preview.color ?? "—"} / {preview.size ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted text-xs">Швея</div>
                <div className="font-medium">{preview.sewer_code} — {preview.sewer_full_name}</div>
              </div>
              <div>
                <div className="text-muted text-xs">Осталось упаковать</div>
                <div className="font-semibold text-accent">{preview.remaining_to_sewer}</div>
              </div>
            </div>

            {/* Ввод количества */}
            <div className="grid grid-cols-2 sm:grid-cols-[140px_140px_140px_1fr] gap-3 items-end">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-text">Упаковано</span>
                <input
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                  type="number"
                  min={0}
                  value={packed || ""}
                  onChange={(e) => setPacked(Number(e.target.value))}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium text-text">Брак</span>
                <input
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                  type="number"
                  min={0}
                  value={defect || ""}
                  onChange={(e) => setDefect(Number(e.target.value))}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium text-text">Ставка</span>
                <input
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate || ""}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </label>

              <div className="flex gap-2">
                <button
                  className="h-10 rounded-xl bg-primary text-primary-contrast font-medium text-sm px-4 disabled:opacity-50 hover:opacity-90 transition-opacity"
                  onClick={addPackaging}
                  disabled={busy}
                  type="button"
                >
                  {busy ? "..." : "Добавить"}
                </button>
                <button
                  className="h-10 rounded-xl border border-border bg-card font-medium text-sm px-3 disabled:opacity-50 hover:bg-bg transition-colors text-xs"
                  type="button"
                  disabled={rateBusy}
                  onClick={async () => {
                    if (!preview) return;
                    setRateBusy(true);
                    try {
                      const res = await fetch("/api/bundles/set-rate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ bundle_id: preview.bundle_id, rate_final: rate }),
                      });
                      const resBody = await res.json().catch(() => ({}));
                      if (!res.ok) return alert(resBody?.error || `Ошибка (status ${res.status})`);
                      alert("Ставка сохранена");
                    } finally {
                      setRateBusy(false);
                    }
                  }}
                >
                  {rateBusy ? "..." : "Сохр. ставку"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Таблица активных партий */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-semibold">Активные партии (осталось &gt; 0)</div>
        <button className="text-sm underline" onClick={loadActive} type="button">
          Обновить
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <colgroup>
            <col className="w-[80px]" />   {/* Дата */}
            <col className="w-[100px]" />  {/* № партии */}
            <col className="w-[70px]" />   {/* № пачки */}
            <col className="w-[130px]" />  {/* ФИО */}
            <col />                        {/* Артикул (резиновая) */}
            <col className="w-[60px]" />   {/* Взяли */}
            <col className="w-[70px]" />   {/* Упаковано */}
            <col className="w-[55px]" />   {/* Брак */}
            <col className="w-[65px]" />   {/* Осталось */}
          </colgroup>
          <thead className="bg-bg">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
              <th className="px-2 py-1.5 text-left font-semibold">Партия</th>
              <th className="px-2 py-1.5 text-left font-semibold">Пачка</th>
              <th className="px-2 py-1.5 text-left font-semibold">Швея</th>
              <th className="px-2 py-1.5 text-left font-semibold">Артикул / цвет / размер</th>
              <th className="px-2 py-1.5 text-right font-semibold">Взяли</th>
              <th className="px-2 py-1.5 text-right font-semibold">Упак</th>
              <th className="px-2 py-1.5 text-right font-semibold">Брак</th>
              <th className="px-2 py-1.5 text-right font-semibold">Ост</th>
            </tr>

            <tr className="border-t border-border bg-card">
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.date} onChange={e=>setF(v=>({...v,date:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.party} onChange={e=>setF(v=>({...v,party:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.bundle} onChange={e=>setF(v=>({...v,bundle:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.sewer} onChange={e=>setF(v=>({...v,sewer:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.item} onChange={e=>setF(v=>({...v,item:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.assigned} onChange={e=>setF(v=>({...v,assigned:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.packed} onChange={e=>setF(v=>({...v,packed:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.defect} onChange={e=>setF(v=>({...v,defect:e.target.value}))} /></th>
              <th className="px-1 py-1"><input className="h-7 w-full rounded-lg border border-border px-1.5 text-xs" value={f.remaining} onChange={e=>setF(v=>({...v,remaining:e.target.value}))} /></th>
            </tr>
          </thead>

          <tbody className="bg-card">
            {rowsErr && (
              <tr>
                <td colSpan={9} className="px-2 py-2 text-danger">{rowsErr}</td>
              </tr>
            )}

            {shown.map((r) => (
              <tr key={r.party_no} className="border-t border-border hover:bg-bg/50">
                <td className="px-2 py-1.5 whitespace-nowrap">{formatRUDate(r.last_packaged_at)}</td>
                <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.party_no}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.bundle_no}</td>
                <td className="px-2 py-1.5 truncate" title={r.sewer_full_name}>{r.sewer_full_name}</td>
                <td className="px-2 py-1.5 truncate" title={`${r.item_cut_name ?? ""} / ${r.color ?? ""} / ${r.size ?? ""}`}>
                  {r.item_cut_name ?? "—"} / {r.color ?? ""} / {r.size ?? ""}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.assigned_to_sewer}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.packed_to_sewer}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.defect_to_sewer}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">{r.remaining_to_sewer}</td>
              </tr>
            ))}

            {shown.length === 0 && !rowsErr && (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-muted">
                  Нет активных партий (или фильтры всё скрыли). Нажми &quot;Обновить&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
