"use client";

import { useState, useEffect, useMemo } from "react";

type WarehouseType = "fabric" | "notion" | "packaging";

type Fabric = {
  id: string;
  name: string;
  color: string | null;
  width_cm: number | null;
  density: string | null;
  balance: {
    rolls_on_hand: number;
    meters_on_hand: number;
    total_cost: number;
    avg_cost_per_meter: number | null;
  } | null;
};

type Movement = {
  id: string;
  warehouse_type: WarehouseType;
  reason: string;
  movement_date: string;
  rolls_delta: number | null;
  meters_delta: number | null;
  qty_delta: number | null;
  total_cost: number | null;
  cost_per_meter: number | null;
  unit_cost: number | null;
  notes: string | null;
  warehouse_fabrics: { name: string; color: string | null } | null;
  warehouse_notions: { name: string; uom: string } | null;
  warehouse_packaging: { name: string; uom: string } | null;
};

export default function InventoryClient() {
  const [activeTab, setActiveTab] = useState<WarehouseType>("fabric");
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Form states for receipt
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptFabricId, setReceiptFabricId] = useState("");
  const [receiptRolls, setReceiptRolls] = useState("");
  const [receiptMeters, setReceiptMeters] = useState("");
  const [receiptCost, setReceiptCost] = useState("");

  // Form states for adding new fabric
  const [showAddFabric, setShowAddFabric] = useState(false);
  const [newFabricName, setNewFabricName] = useState("");
  const [newFabricColor, setNewFabricColor] = useState("");
  const [newFabricWidth, setNewFabricWidth] = useState("");
  const [newFabricDensity, setNewFabricDensity] = useState("");
  const [addingFabric, setAddingFabric] = useState(false);

  // Search filter state
  const [q, setQ] = useState("");
  const qNorm = q.trim().toLowerCase();

  useEffect(() => {
    loadData();
    setQ(""); // Reset search when switching tabs
  }, [activeTab]);

  // Filter movements by fabric name, color, and operation
  const filteredMovements = useMemo(() => {
    if (!qNorm) return movements;

    return movements.filter((m) => {
      const name = (m.warehouse_fabrics?.name ?? "").toLowerCase();
      const color = (m.warehouse_fabrics?.color ?? "").toLowerCase();
      const op = (m.reason ?? "").toLowerCase();
      return name.includes(qNorm) || color.includes(qNorm) || op.includes(qNorm);
    });
  }, [movements, qNorm]);

  // Filter balances (fabrics) by name and color
  const filteredFabrics = useMemo(() => {
    if (!qNorm) return fabrics;

    return fabrics.filter((f) => {
      const name = (f.name ?? "").toLowerCase();
      const color = (f.color ?? "").toLowerCase();
      return name.includes(qNorm) || color.includes(qNorm);
    });
  }, [fabrics, qNorm]);

  async function loadData() {
    setLoading(true);
    setErr(null);
    try {
      // Load fabrics (for now, only fabric tab)
      if (activeTab === "fabric") {
        const res = await fetch("/api/warehouse/fabrics/list");
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? "Ошибка загрузки");
        setFabrics(j.fabrics || []);

        // Load movements
        const movRes = await fetch("/api/warehouse/movements/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warehouse_type: "fabric" }),
        });
        const movJ = await movRes.json();
        if (!movRes.ok) throw new Error(movJ?.error ?? "Ошибка загрузки журнала");
        setMovements(movJ.movements || []);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function createFabric(name: string, color?: string, width_cm?: number, density?: string) {
    const res = await fetch("/api/warehouse/fabrics/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, width_cm, density }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error ?? "Ошибка создания");
    return j.fabric;
  }

  async function handleAddFabric() {
    if (!newFabricName.trim()) {
      setErr("Название ткани обязательно");
      return;
    }

    setAddingFabric(true);
    setErr(null);
    try {
      const fabric = await createFabric(
        newFabricName.trim(),
        newFabricColor.trim() || undefined,
        newFabricWidth ? Number(newFabricWidth) : undefined,
        newFabricDensity.trim() || undefined
      );

      // Reload fabrics list
      await loadData();

      // Select the new fabric
      setReceiptFabricId(fabric.id);

      // Close modal and reset form
      setShowAddFabric(false);
      setNewFabricName("");
      setNewFabricColor("");
      setNewFabricWidth("");
      setNewFabricDensity("");
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка создания ткани");
    } finally {
      setAddingFabric(false);
    }
  }

  async function createReceipt() {
    if (!receiptFabricId || !receiptRolls) {
      setErr("Выберите ткань и укажите количество рулонов");
      return;
    }

    const rolls = Number(receiptRolls);
    const meters = receiptMeters ? Number(receiptMeters) : undefined;
    const cost = receiptCost ? Number(receiptCost) : undefined;

    if (!rolls || rolls <= 0) {
      setErr("Количество рулонов должно быть > 0");
      return;
    }

    try {
      const res = await fetch("/api/warehouse/movements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_type: "fabric",
          item_id: receiptFabricId,
          reason: "receipt",
          rolls_delta: rolls,
          meters_delta: meters,
          total_cost: cost,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Ошибка оформления прихода");

      setShowReceipt(false);
      setReceiptFabricId("");
      setReceiptRolls("");
      setReceiptMeters("");
      setReceiptCost("");
      await loadData();
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    }
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold">Склад</h1>
          <div className="text-[13px] text-muted-foreground mt-1">
            Ткань / Фурнитура / Упаковка
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("fabric")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "fabric"
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ткань
        </button>
        <button
          onClick={() => setActiveTab("notion")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "notion"
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Фурнитура
        </button>
        <button
          onClick={() => setActiveTab("packaging")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "packaging"
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Упаковка
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {err}
        </div>
      )}

      {/* Fabric Tab Content */}
      {activeTab === "fabric" && (
        <div className="space-y-6">
          {/* Search Filter */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск: ткань / цвет / операция…"
              className="h-9 w-full max-w-md rounded-md border border-border px-3 text-sm"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted/50 whitespace-nowrap"
              >
                Сброс
              </button>
            )}
          </div>

          {/* Receipt Form */}
          <div className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Приход ткани</h2>
              <button
                onClick={() => setShowReceipt(!showReceipt)}
                className="h-9 px-4 rounded-md bg-black text-white text-[13px] hover:bg-black/90"
              >
                {showReceipt ? "Скрыть" : "+ Приход"}
              </button>
            </div>

            {showReceipt && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ткань *</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 h-9 rounded-md border border-border px-3 text-sm"
                      value={receiptFabricId}
                      onChange={(e) => setReceiptFabricId(e.target.value)}
                    >
                      <option value="">Выберите ткань</option>
                      {fabrics.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} {f.color ? `(${f.color})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddFabric(true)}
                      className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted/50 whitespace-nowrap"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Рулоны *</label>
                  <input
                    type="number"
                    className="w-full h-9 rounded-md border border-border px-3 text-sm"
                    value={receiptRolls}
                    onChange={(e) => setReceiptRolls(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Метраж (м)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-9 rounded-md border border-border px-3 text-sm"
                    value={receiptMeters}
                    onChange={(e) => setReceiptMeters(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Сумма (руб)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-9 rounded-md border border-border px-3 text-sm"
                    value={receiptCost}
                    onChange={(e) => setReceiptCost(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-2 flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowReceipt(false);
                      setReceiptFabricId("");
                      setReceiptRolls("");
                      setReceiptMeters("");
                      setReceiptCost("");
                    }}
                    className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted/50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={createReceipt}
                    className="h-9 px-4 rounded-md bg-black text-white text-sm hover:bg-black/90"
                  >
                    Оформить приход
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Balances Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">Остатки</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr>
                  <th className="px-3 py-2 text-left">Ткань</th>
                  <th className="px-3 py-2 text-right">Рулоны</th>
                  <th className="px-3 py-2 text-right">Метраж (м)</th>
                  <th className="px-3 py-2 text-right">Сумма</th>
                  <th className="px-3 py-2 text-right">Цена/м</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Загрузка...
                    </td>
                  </tr>
                ) : filteredFabrics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      {q ? "Ничего не найдено" : "Нет тканей на складе"}
                    </td>
                  </tr>
                ) : (
                  filteredFabrics.map((f) => (
                    <tr key={f.id} className="border-t border-border hover:bg-muted/50">
                      <td className="px-3 py-2">
                        {f.name} {f.color && <span className="text-muted-foreground">({f.color})</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {f.balance?.rolls_on_hand ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {f.balance?.meters_on_hand ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {f.balance?.total_cost ? `${f.balance.total_cost.toFixed(2)} ₽` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {f.balance?.avg_cost_per_meter
                          ? `${f.balance.avg_cost_per_meter.toFixed(2)} ₽/м`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Journal Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 font-semibold text-sm">Журнал операций</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr>
                  <th className="px-3 py-2 text-left">Дата</th>
                  <th className="px-3 py-2 text-left">Ткань</th>
                  <th className="px-3 py-2 text-left">Операция</th>
                  <th className="px-3 py-2 text-right">Рулоны</th>
                  <th className="px-3 py-2 text-right">Метраж</th>
                  <th className="px-3 py-2 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      {q ? "Ничего не найдено" : "Нет операций"}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/50">
                      <td className="px-3 py-2">{m.movement_date}</td>
                      <td className="px-3 py-2">
                        {m.warehouse_fabrics?.name} {m.warehouse_fabrics?.color && `(${m.warehouse_fabrics.color})`}
                      </td>
                      <td className="px-3 py-2">
                        {m.reason === "receipt" ? "Приход" : m.reason === "issue" ? "Списание" : "Корректировка"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.rolls_delta ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.meters_delta ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {m.total_cost ? `${m.total_cost.toFixed(2)} ₽` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notion/Packaging tabs - placeholder */}
      {(activeTab === "notion" || activeTab === "packaging") && (
        <div className="text-center py-12 text-muted-foreground">
          В разработке
        </div>
      )}

      {/* Add Fabric Modal */}
      {showAddFabric && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-card">
            <h2 className="text-lg font-semibold mb-4">Добавить ткань</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Название ткани *
                </label>
                <input
                  type="text"
                  className="w-full h-9 rounded-md border border-border px-3 text-sm"
                  value={newFabricName}
                  onChange={(e) => setNewFabricName(e.target.value)}
                  placeholder="Например: Кулирка"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Цвет
                </label>
                <input
                  type="text"
                  className="w-full h-9 rounded-md border border-border px-3 text-sm"
                  value={newFabricColor}
                  onChange={(e) => setNewFabricColor(e.target.value)}
                  placeholder="Например: черный"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Ширина (см)
                </label>
                <input
                  type="number"
                  className="w-full h-9 rounded-md border border-border px-3 text-sm"
                  value={newFabricWidth}
                  onChange={(e) => setNewFabricWidth(e.target.value)}
                  placeholder="Например: 180"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Плотность
                </label>
                <input
                  type="text"
                  className="w-full h-9 rounded-md border border-border px-3 text-sm"
                  value={newFabricDensity}
                  onChange={(e) => setNewFabricDensity(e.target.value)}
                  placeholder="Например: 200"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddFabric(false);
                  setNewFabricName("");
                  setNewFabricColor("");
                  setNewFabricWidth("");
                  setNewFabricDensity("");
                  setErr(null);
                }}
                disabled={addingFabric}
                className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted/50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleAddFabric}
                disabled={addingFabric || !newFabricName.trim()}
                className="h-9 px-4 rounded-md bg-black text-white text-sm hover:bg-black/90 disabled:opacity-50"
              >
                {addingFabric ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
