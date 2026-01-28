"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceLinesEditor } from "../../_components/InvoiceLinesEditor";

type CutInfo = {
  id: string;
  cut_name: string;
  cut_date: string | null;
  counterparty_id: string | null;
};

type Counterparty = { id: string; name: string };

type PreviewRow = {
  product_id: string;
  product_display: string;
  color: string;
  planned_qty: number;
  final_qty: number;
  defect_qty: number;
  suggested_price: number | null;
};

type PartySuggestion = {
  inn: string;
  name: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function n2(v: number) {
  return Math.round(v * 100) / 100;
}

export function CreateInvoiceClient({
  cut,
  preview,
  counterparties: initialCounterparties,
  orgId,
}: {
  cut: CutInfo;
  preview: PreviewRow[];
  counterparties: Counterparty[];
  orgId: string;
}) {
  const router = useRouter();

  const [counterparties, setCounterparties] = useState<Counterparty[]>(initialCounterparties);
  const [counterpartyId, setCounterpartyId] = useState<string>(cut.counterparty_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [draftInvoiceId, setDraftInvoiceId] = useState<string | null>(null);
  const [draftCreating, setDraftCreating] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [cpName, setCpName] = useState("");
  const [cpInn, setCpInn] = useState("");
  const [cpSug, setCpSug] = useState<PartySuggestion[]>([]);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);

  // цены по ключу product_id|color
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of preview) {
      const key = `${r.product_id}||${r.color ?? ""}`;
      map[key] = r.suggested_price != null ? String(r.suggested_price) : "";
    }
    return map;
  });

  const rows = useMemo(() => {
    return preview.map((r) => {
      const key = `${r.product_id}||${r.color ?? ""}`;
      const priceStr = prices[key] ?? "";
      const price = priceStr ? Number(priceStr.replace(",", ".")) : 0;
      const plannedAmount = n2((r.planned_qty ?? 0) * (isFinite(price) ? price : 0));
      const finalAmount = n2((r.final_qty ?? 0) * (isFinite(price) ? price : 0));
      return { ...r, key, priceStr, price, plannedAmount, finalAmount };
    });
  }, [preview, prices]);

  const totalPlanned = useMemo(() => rows.reduce((s, r) => s + r.plannedAmount, 0), [rows]);
  const totalFinal = useMemo(() => rows.reduce((s, r) => s + r.finalAmount, 0), [rows]);
  const totalPlannedQty = useMemo(() => rows.reduce((s, r) => s + (r.planned_qty ?? 0), 0), [rows]);
  const totalFinalQty = useMemo(() => rows.reduce((s, r) => s + (r.final_qty ?? 0), 0), [rows]);
  const totalDefect = useMemo(() => rows.reduce((s, r) => s + (r.defect_qty ?? 0), 0), [rows]);

  // DaData party suggest
  let cpTimer: any = (globalThis as any).__cpTimer;

  async function partySuggest(q: string) {
    const res = await fetch("/api/dadata/party-suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q }),
    });
    const j = await res.json();
    setCpSug(
      (j?.suggestions ?? []).map((s: any) => ({
        inn: s.inn,
        name: s.name,
        kpp: s.kpp,
        ogrn: s.ogrn,
        address: s.address,
      }))
    );
  }

  function onCpInnChange(v: string) {
    setCpInn(v);
    setCpOpen(true);
    clearTimeout(cpTimer);
    (globalThis as any).__cpTimer = setTimeout(() => {
      if (v.trim().length >= 2) partySuggest(v);
      else setCpSug([]);
    }, 350);
  }

  async function createCounterparty() {
    const name = cpName.trim();
    if (!name) {
      setErr("Введите название контрагента.");
      return;
    }

    setCpSaving(true);
    try {
      const res = await fetch("/api/counterparties/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, inn: cpInn.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Не удалось создать");

      // Add to list and select
      const newCp = { id: j.counterparty.id, name: j.counterparty.name };
      setCounterparties((prev) => [...prev, newCp]);
      setCounterpartyId(newCp.id);

      // Close modal
      setModalOpen(false);
      setCpName("");
      setCpInn("");
      setCpSug([]);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    } finally {
      setCpSaving(false);
    }
  }

  async function saveCounterpartyToCut() {
    if (!counterpartyId) return;
    await fetch("/api/cuts/set-counterparty", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cut_id: cut.id, counterparty_id: counterpartyId }),
    });
  }

  async function createInvoiceInternal({ redirect }: { redirect: boolean }) {
    setErr(null);

    if (!counterpartyId) {
      setErr("Выбери контрагента.");
      return null;
    }

    const payloadPrices = rows
      .filter((r) => r.planned_qty > 0)
      .map((r) => ({
        product_id: r.product_id,
        color: r.color ?? "",
        unit_price: r.price,
      }));

    const missing = payloadPrices.find((p) => !p.unit_price || p.unit_price <= 0);
    if (missing) {
      setErr("Заполни расценку (цена > 0) для всех строк.");
      return null;
    }

    setSaving(true);
    try {
      await saveCounterpartyToCut();

      const res = await fetch("/api/invoices/create-from-cut", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cut_id: cut.id,
          counterparty_id: counterpartyId,
          prices: payloadPrices,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Не удалось создать счёт");

      const id = j.invoice_id as string | undefined;
      if (!id) throw new Error("API не вернул invoice_id");

      setInvoiceId(id);

      if (redirect) {
        router.push(`/app/finance/invoices/${id}`);
      }

      return id;
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createInvoice() {
    // старое поведение кнопки "Выставить счёт" — можно оставить редирект
    await createInvoiceInternal({ redirect: true });
  }

  // НОВОЕ: для добавления услуг/склада на этой же странице
  async function ensureInvoiceId(): Promise<string | null> {
    if (invoiceId) return invoiceId;
    // создаём БЕЗ редиректа
    return await createInvoiceInternal({ redirect: false });
  }

  // Для черновика счёта (без валидации цен)
  async function ensureDraftInvoiceId(): Promise<string | null> {
    if (draftInvoiceId) return draftInvoiceId;

    setDraftCreating(true);
    setErr(null);
    try {
      // ВАЖНО: НЕ требуем заполнения цен.
      // prices можем отправить пустым массивом или теми строками, где цена уже введена.
      const payloadPrices = rows
        .filter((r) => r.price && r.price > 0) // только что есть
        .map((r) => ({
          product_id: r.product_id,
          color: r.color ?? "",
          unit_price: r.price,
        }));

      // контрагент можно отправить если выбран, иначе null
      const res = await fetch("/api/invoices/create-from-cut", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cut_id: cut.id,
          counterparty_id: counterpartyId || null,
          prices: payloadPrices,
          allow_incomplete_prices: true,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Не удалось создать черновик счёта");

      const id = j.invoice_id as string | undefined;
      if (!id) throw new Error("API не вернул invoice_id");

      setDraftInvoiceId(id);
      return id;
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
      return null;
    } finally {
      setDraftCreating(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] text-muted-foreground">Выставление счёта</div>
          <h1 className="text-[20px] font-semibold">
            {cut.cut_name} <span className="text-muted-foreground font-normal">({fmtDate(cut.cut_date)})</span>
          </h1>
        </div>

        <button
          onClick={() => router.back()}
          className="h-9 px-3 rounded-md border border-border text-[13px] hover:bg-muted/50"
        >
          Назад
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <div className="text-[12px] text-muted-foreground">Контрагент</div>
          <div className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-border px-3 text-[13px] bg-white"
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
            >
              <option value="">— выбрать —</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-9 px-3 rounded-md border border-border text-[13px] hover:bg-muted/50 whitespace-nowrap"
            >
              + Добавить
            </button>
          </div>
        </div>

        <div className="md:col-span-2 flex gap-3 items-end justify-end">
          <div className="text-[13px] text-muted-foreground">
            План: <span className="text-foreground tabular-nums">{totalPlannedQty}</span> шт ·{" "}
            <span className="text-foreground tabular-nums">{n2(totalPlanned)}</span>
            <br />
            Факт: <span className="text-foreground tabular-nums">{totalFinalQty}</span> шт ·{" "}
            <span className="text-foreground tabular-nums">{n2(totalFinal)}</span>{" "}
            <span className="text-muted-foreground">(брак: {totalDefect})</span>
          </div>

          <button
            disabled={saving}
            onClick={createInvoice}
            className="h-9 px-4 rounded-md bg-black text-white text-[13px] hover:bg-black/90 disabled:opacity-50"
          >
            {saving ? "Создаю..." : "Выставить счёт"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {err}
        </div>
      ) : null}

      <div className="border border-border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Артикул</th>
              <th className="px-3 py-2 font-medium w-[140px]">Цвет</th>
              <th className="px-3 py-2 font-medium w-[90px] text-right">План</th>
              <th className="px-3 py-2 font-medium w-[90px] text-right">Факт</th>
              <th className="px-3 py-2 font-medium w-[120px] text-right">Цена</th>
              <th className="px-3 py-2 font-medium w-[130px] text-right">Сумма (план)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-muted/50 transition">
                <td className="px-3 py-2">{r.product_display}</td>
                <td className="px-3 py-2">{r.color || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.planned_qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.final_qty}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    className="h-8 w-full rounded-md border border-border px-2 text-[13px] text-right tabular-nums"
                    value={r.priceStr}
                    onChange={(e) =>
                      setPrices((m) => ({ ...m, [r.key]: e.target.value }))
                    }
                    placeholder="0"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{n2(r.plannedAmount)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                  Нет строк для счёта (проверь, есть ли пачки в этом крое).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Services and Inventory Editor */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] font-medium">Услуги и материалы</div>

          {!draftInvoiceId ? (
            <button
              disabled={draftCreating}
              onClick={async () => {
                await ensureDraftInvoiceId();
              }}
              className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted/50 disabled:opacity-50"
            >
              {draftCreating ? "Создаю..." : "Начать добавлять"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-muted-foreground">
                Черновик: <span className="font-mono text-foreground">{draftInvoiceId.slice(0, 8)}...</span>
              </div>
              <button
                onClick={() => router.push(`/app/finance/invoices/${draftInvoiceId}`)}
                className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted/50"
              >
                Открыть счёт
              </button>
            </div>
          )}
        </div>

        {draftInvoiceId ? (
          <InvoiceLinesEditor invoiceId={draftInvoiceId} orgId={orgId} mode="extrasOnly" />
        ) : (
          <div className="text-[12px] text-muted-foreground">
            Можно добавить услуги и материалы до заполнения цен по работам. Нажми "Начать добавлять".
          </div>
        )}
      </div>

      {/* Modal: Add Counterparty */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-semibold">Добавить контрагента</div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <label className="block space-y-1">
              <div className="text-[12px] text-muted-foreground">Название</div>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
                value={cpName}
                onChange={(e) => setCpName(e.target.value)}
                placeholder="ИП Иванов / ООО Ромашка"
              />
            </label>

            <div className="relative">
              <div className="text-[12px] text-muted-foreground mb-1">ИНН (необязательно, с подсказками)</div>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
                value={cpInn}
                onChange={(e) => onCpInnChange(e.target.value)}
                onFocus={() => setCpOpen(true)}
                onBlur={() => setTimeout(() => setCpOpen(false), 150)}
                placeholder="Введи ИНН или название"
              />
              {cpOpen && cpSug.length > 0 ? (
                <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-white shadow max-h-48 overflow-auto">
                  {cpSug.map((s) => (
                    <button
                      type="button"
                      key={`${s.inn}-${s.name}`}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted/50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCpInn(s.inn);
                        setCpName(s.name);
                        setCpOpen(false);
                      }}
                    >
                      <div className="font-medium">{s.inn}</div>
                      <div className="text-muted-foreground truncate">{s.name}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 rounded-md border border-border text-[13px] hover:bg-muted/50"
              >
                Отмена
              </button>
              <button
                disabled={cpSaving}
                onClick={createCounterparty}
                className="h-9 px-4 rounded-md bg-black text-white text-[13px] hover:bg-black/90 disabled:opacity-50"
              >
                {cpSaving ? "Сохраняю..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
