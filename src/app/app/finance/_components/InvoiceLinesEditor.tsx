"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type InvoiceLine = {
  id: string;
  line_type: string;
  product_id: string | null;
  color: string | null;
  title: string | null;
  uom: string | null;
  qty: number | null;
  unit_price: number;
  amount: number | null;
  planned_qty: number | null;
  final_qty: number | null;
  planned_amount: number | null;
  final_amount: number | null;
  inventory_item_id: string | null;
  service_template_id: string | null;
  product_display?: string;
};

type ServiceTemplate = {
  id: string;
  code: string;
  name: string;
  uom: string;
  recommended_unit_price: number | null;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  uom: string;
  recommended_sale_price: number | null;
};

type LocalLine = InvoiceLine & {
  _key: string;
  _isNew?: boolean;
  _deleted?: boolean;
};

function n2(v: number) {
  return Math.round(v * 100) / 100;
}

type InvoiceLinesEditorProps = {
  invoiceId: string;
  orgId: string;
  mode?: "full" | "extrasOnly";
  onTotalsChanged?: (totals: { current_amount: number }) => void;
};

export function InvoiceLinesEditor({ invoiceId, orgId, mode = "full", onTotalsChanged }: InvoiceLinesEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Inventory picker modal
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [invSearch, setInvSearch] = useState("");

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load invoice lines, service templates, inventory items
        const [linesRes, templatesRes, itemsRes] = await Promise.all([
          fetch(`/api/invoices/lines?invoice_id=${invoiceId}`),
          fetch(`/api/service-templates?org_id=${orgId}`),
          fetch(`/api/inventory-items?org_id=${orgId}`),
        ]);

        if (!linesRes.ok) throw new Error("Не удалось загрузить строки");
        if (!templatesRes.ok) throw new Error("Не удалось загрузить шаблоны услуг");
        if (!itemsRes.ok) throw new Error("Не удалось загрузить материалы");

        const linesData = await linesRes.json();
        const templatesData = await templatesRes.json();
        const itemsData = await itemsRes.json();

        const loadedLines: InvoiceLine[] = linesData.lines ?? [];
        setLines(loadedLines.map((l, i) => ({ ...l, _key: l.id || `init-${i}` })));
        setServiceTemplates(templatesData.templates ?? []);
        setInventoryItems(itemsData.items ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId, orgId]);

  // Calculate totals
  const visibleLines = useMemo(() => lines.filter((l) => !l._deleted), [lines]);

  const totals = useMemo(() => {
    let workAmount = 0;
    let serviceAmount = 0;
    let inventoryAmount = 0;

    for (const l of visibleLines) {
      if (l.line_type === "work") {
        workAmount += Number(l.planned_amount ?? 0);
      } else if (l.line_type === "service") {
        const amt = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
        serviceAmount += amt;
      } else if (l.line_type === "inventory") {
        const amt = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
        inventoryAmount += amt;
      }
    }

    const total = n2(workAmount + serviceAmount + inventoryAmount);
    return {
      work: n2(workAmount),
      service: n2(serviceAmount),
      inventory: n2(inventoryAmount),
      total,
    };
  }, [visibleLines]);

  // Notify parent about totals change
  useEffect(() => {
    if (onTotalsChanged) {
      onTotalsChanged({ current_amount: totals.total });
    }
  }, [totals.total, onTotalsChanged]);

  function updateLine(key: string, updates: Partial<LocalLine>) {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, ...updates } : l))
    );
  }

  function deleteLine(key: string) {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, _deleted: true } : l))
    );
  }

  function addServiceLine(template: ServiceTemplate) {
    const newLine: LocalLine = {
      id: "",
      _key: `new-${Date.now()}`,
      _isNew: true,
      line_type: "service",
      product_id: null,
      color: null,
      title: template.name,
      uom: template.uom,
      qty: 1,
      unit_price: template.recommended_unit_price ?? 0,
      amount: template.recommended_unit_price ?? 0,
      planned_qty: null,
      final_qty: null,
      planned_amount: null,
      final_amount: null,
      inventory_item_id: null,
      service_template_id: template.id,
    };
    setLines((prev) => [...prev, newLine]);
  }

  function addInventoryLine(item: InventoryItem) {
    const newLine: LocalLine = {
      id: "",
      _key: `new-${Date.now()}`,
      _isNew: true,
      line_type: "inventory",
      product_id: null,
      color: null,
      title: item.name,
      uom: item.uom,
      qty: 1,
      unit_price: item.recommended_sale_price ?? 0,
      amount: item.recommended_sale_price ?? 0,
      planned_qty: null,
      final_qty: null,
      planned_amount: null,
      final_amount: null,
      inventory_item_id: item.id,
      service_template_id: null,
    };
    setLines((prev) => [...prev, newLine]);
    setShowInventoryPicker(false);
    setInvSearch("");
  }

  async function saveChanges() {
    setErr(null);
    setSuccess(null);
    setSaving(true);

    try {
      const payload = {
        invoice_id: invoiceId,
        lines: lines.map((l) => ({
          id: l._isNew ? null : l.id,
          deleted: l._deleted ?? false,
          line_type: l.line_type,
          title: l.title,
          uom: l.uom,
          qty: l.qty,
          unit_price: l.unit_price,
          inventory_item_id: l.inventory_item_id,
          service_template_id: l.service_template_id,
          product_id: l.product_id,
          color: l.color,
          planned_qty: l.planned_qty,
          final_qty: l.final_qty,
        })),
      };

      const res = await fetch("/api/invoices/update-lines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Ошибка сохранения");

      setSuccess("Сохранено!");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const filteredInventory = useMemo(() => {
    if (!invSearch.trim()) return inventoryItems;
    const q = invSearch.toLowerCase();
    return inventoryItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
    );
  }, [inventoryItems, invSearch]);

  // Group lines by type for display
  const workLines = visibleLines.filter((l) => l.line_type === "work");
  const serviceLines = visibleLines.filter((l) => l.line_type === "service");
  const inventoryLines = visibleLines.filter((l) => l.line_type === "inventory");

  if (loading) {
    return <div className="text-[13px] text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {err}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-700">
          {success}
        </div>
      )}

      {/* Work lines (from cut) */}
      {mode !== "extrasOnly" && workLines.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[14px] font-medium">Работы (по крою)</h2>
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Артикул</th>
                  <th className="px-3 py-2 font-medium w-[120px]">Цвет</th>
                  <th className="px-3 py-2 font-medium w-[80px] text-right">План</th>
                  <th className="px-3 py-2 font-medium w-[80px] text-right">Факт</th>
                  <th className="px-3 py-2 font-medium w-[100px] text-right">Цена</th>
                  <th className="px-3 py-2 font-medium w-[110px] text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {workLines.map((l) => (
                  <tr key={l._key} className="hover:bg-muted/50">
                    <td className="px-3 py-2">{l.product_display ?? "—"}</td>
                    <td className="px-3 py-2">{l.color || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.planned_qty ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.final_qty ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-7 w-full rounded border border-border px-2 text-[13px] text-right tabular-nums"
                        value={l.unit_price ?? ""}
                        onChange={(e) =>
                          updateLine(l._key, {
                            unit_price: Number(e.target.value.replace(",", ".")) || 0,
                            planned_amount:
                              (l.planned_qty ?? 0) *
                              (Number(e.target.value.replace(",", ".")) || 0),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {n2(Number(l.planned_amount ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right font-medium">
                    Итого работы:
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {totals.work}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium">Услуги</h2>
          <div className="flex gap-2">
            {serviceTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => addServiceLine(t)}
                className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted/50"
              >
                + {t.name}
              </button>
            ))}
          </div>
        </div>

        {serviceLines.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium w-[80px]">Ед.</th>
                  <th className="px-3 py-2 font-medium w-[80px] text-right">Кол-во</th>
                  <th className="px-3 py-2 font-medium w-[100px] text-right">Цена</th>
                  <th className="px-3 py-2 font-medium w-[110px] text-right">Сумма</th>
                  <th className="px-3 py-2 font-medium w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {serviceLines.map((l) => {
                  const amt = n2((Number(l.qty) || 0) * (Number(l.unit_price) || 0));
                  return (
                    <tr key={l._key} className="hover:bg-muted/50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="h-7 w-full rounded border border-border px-2 text-[13px]"
                          value={l.title ?? ""}
                          onChange={(e) => updateLine(l._key, { title: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{l.uom ?? "шт"}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-full rounded border border-border px-2 text-[13px] text-right tabular-nums"
                          value={l.qty ?? ""}
                          onChange={(e) =>
                            updateLine(l._key, {
                              qty: Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-full rounded border border-border px-2 text-[13px] text-right tabular-nums"
                          value={l.unit_price ?? ""}
                          onChange={(e) =>
                            updateLine(l._key, {
                              unit_price: Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{amt}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => deleteLine(l._key)}
                          className="text-red-500 hover:text-red-700 text-[16px]"
                          title="Удалить"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium">
                    Итого услуги:
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {totals.service}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">
            Нет строк услуг. Нажми кнопку выше, чтобы добавить.
          </div>
        )}
      </section>

      {/* Inventory (materials) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium">Материалы (со склада)</h2>
          <button
            onClick={() => setShowInventoryPicker(true)}
            className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted/50"
          >
            + Добавить со склада
          </button>
        </div>

        {inventoryLines.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium w-[80px]">Ед.</th>
                  <th className="px-3 py-2 font-medium w-[80px] text-right">Кол-во</th>
                  <th className="px-3 py-2 font-medium w-[100px] text-right">Цена</th>
                  <th className="px-3 py-2 font-medium w-[110px] text-right">Сумма</th>
                  <th className="px-3 py-2 font-medium w-[50px]"></th>
                </tr>
              </thead>
              <tbody>
                {inventoryLines.map((l) => {
                  const amt = n2((Number(l.qty) || 0) * (Number(l.unit_price) || 0));
                  return (
                    <tr key={l._key} className="hover:bg-muted/50">
                      <td className="px-3 py-2">{l.title ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.uom ?? "шт"}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-full rounded border border-border px-2 text-[13px] text-right tabular-nums"
                          value={l.qty ?? ""}
                          onChange={(e) =>
                            updateLine(l._key, {
                              qty: Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-7 w-full rounded border border-border px-2 text-[13px] text-right tabular-nums"
                          value={l.unit_price ?? ""}
                          onChange={(e) =>
                            updateLine(l._key, {
                              unit_price: Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{amt}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => deleteLine(l._key)}
                          className="text-red-500 hover:text-red-700 text-[16px]"
                          title="Удалить"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/20">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium">
                    Итого материалы:
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {totals.inventory}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">
            Нет материалов. Нажми кнопку выше, чтобы добавить.
          </div>
        )}
      </section>

      {/* Grand Total + Save */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-[15px]">
          <span className="text-muted-foreground">Итого по счёту:</span>{" "}
          <span className="font-semibold tabular-nums">{totals.total} ₽</span>
        </div>
        <button
          disabled={saving}
          onClick={saveChanges}
          className="h-10 px-5 rounded-md bg-black text-white text-[14px] hover:bg-black/90 disabled:opacity-50"
        >
          {saving ? "Сохраняю..." : "Сохранить изменения"}
        </button>
      </div>

      {/* Inventory Picker Modal */}
      {showInventoryPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-semibold">Выбрать со склада</div>
              <button
                onClick={() => {
                  setShowInventoryPicker(false);
                  setInvSearch("");
                }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <input
              type="text"
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              placeholder="Поиск по названию..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              autoFocus
            />

            <div className="flex-1 overflow-auto border border-border rounded-md">
              {filteredInventory.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredInventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addInventoryLine(item)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-[13px]"
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-muted-foreground text-[12px]">
                        {item.category} · {item.uom}
                        {item.recommended_sale_price
                          ? ` · ${item.recommended_sale_price} ₽`
                          : ""}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-6 text-center text-muted-foreground text-[13px]">
                  {inventoryItems.length === 0
                    ? "На складе нет номенклатуры. Добавьте в настройках."
                    : "Ничего не найдено."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
