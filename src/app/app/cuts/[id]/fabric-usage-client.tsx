"use client";

import { useState, useEffect } from "react";

type Fabric = {
  id: string;
  name: string;
  color: string | null;
  width_cm: number | null;
  density: string | null;
  rolls_on_hand: number;
  meters_on_hand: number;
};

type Usage = {
  id: string;
  fabric_id: string | null;
  rolls_used: number;
  warehouse_fabrics: Fabric | null;
};

function UsageRow({
  usage,
  fabrics,
  onUpdate,
  onDelete,
  onFabricChange,
}: {
  usage: Usage;
  fabrics: Fabric[];
  onUpdate: (fabricId: string, rolls: number) => Promise<void>;
  onDelete: () => void;
  onFabricChange?: (usageId: string, fabricId: string) => void;
}) {
  const [rollsValue, setRollsValue] = useState(usage.rolls_used.toString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRollsValue(usage.rolls_used.toString());
  }, [usage.rolls_used]);

  const selectedFabric = usage.warehouse_fabrics || fabrics.find((f) => f.id === usage.fabric_id);
  const rollsAvailable = selectedFabric?.rolls_on_hand ?? 0;
  const metersAvailable = selectedFabric?.meters_on_hand ?? 0;
  const rollsNum = Number(rollsValue);
  const exceedsAvailable = selectedFabric && rollsNum > rollsAvailable;

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        {usage.warehouse_fabrics ? (
          <div>
            <div>
              {usage.warehouse_fabrics.name}
              {usage.warehouse_fabrics.color && (
                <span className="text-muted-foreground"> ({usage.warehouse_fabrics.color})</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Доступно: {rollsAvailable.toFixed(3)} рул.
              {metersAvailable > 0 && ` (${metersAvailable.toFixed(2)} м)`}
            </div>
          </div>
        ) : (
          <div>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={usage.fabric_id || ""}
              onChange={(e) => {
                const newFabricId = e.target.value;
                if (newFabricId && onFabricChange) {
                  onFabricChange(usage.id, newFabricId);
                }
              }}
            >
              <option value="">Выберите ткань</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.color ? `(${f.color})` : ""} — {f.rolls_on_hand.toFixed(3)} рул.
                  {f.meters_on_hand > 0 && ` (${f.meters_on_hand.toFixed(2)} м)`}
                </option>
              ))}
            </select>
            {selectedFabric && (
              <div className="text-xs text-muted-foreground mt-1">
                Доступно: {rollsAvailable.toFixed(3)} рул.
                {metersAvailable > 0 && ` (${metersAvailable.toFixed(2)} м)`}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <div>
          <input
            type="number"
            step="0.001"
            className={`w-full border rounded px-2 py-1 text-sm text-right tabular-nums ${
              exceedsAvailable ? "border-red-500 bg-red-50" : ""
            }`}
            value={rollsValue}
            onChange={(e) => setRollsValue(e.target.value)}
            onBlur={async () => {
              const rolls = Number(rollsValue);
              if (rolls !== usage.rolls_used && usage.fabric_id) {
                setSaving(true);
                await onUpdate(usage.fabric_id, rolls);
                setSaving(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setRollsValue(usage.rolls_used.toString());
                e.currentTarget.blur();
              }
            }}
            disabled={saving || !usage.fabric_id || !selectedFabric}
            placeholder="0"
          />
          {exceedsAvailable && selectedFabric && (
            <div className="text-xs text-red-600 mt-1">
              Превышает доступное: {rollsAvailable.toFixed(3)} рул.
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-800 text-sm"
          disabled={saving}
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export default function FabricUsageClient({ cutId }: { cutId: string }) {
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [cutId]);

  async function loadData() {
    setLoading(true);
    setErr(null);
    try {
      // Load fabrics with balances (only fabrics with stock > 0)
      const fabRes = await fetch("/api/warehouse/fabrics/with-balances");
      const fabJ = await fabRes.json();
      if (!fabRes.ok) throw new Error(fabJ?.error ?? "Ошибка загрузки тканей");
      setFabrics(fabJ.fabrics || []);

      // Load usage
      const usageRes = await fetch(`/api/cuts/fabric-usage?cut_id=${cutId}`);
      const usageJ = await usageRes.json();
      if (!usageRes.ok) throw new Error(usageJ?.error ?? "Ошибка загрузки расхода");
      setUsage(usageJ.usage || []);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function saveUsage(fabricId: string | null, rolls: number) {
    if (!fabricId) {
      setErr("Выберите ткань");
      return;
    }

    if (!Number.isFinite(rolls) || rolls < 0) {
      setErr("Количество рулонов должно быть >= 0");
      return;
    }

    // Validate against available stock
    const fabric = fabrics.find((f) => f.id === fabricId);
    if (fabric && rolls > fabric.rolls_on_hand) {
      setErr(`Превышает доступное количество (${fabric.rolls_on_hand.toFixed(3)} рул.)`);
      return;
    }

    try {
      const res = await fetch("/api/cuts/fabric-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cut_id: cutId,
          fabric_id: fabricId,
          rolls_used: rolls,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Ошибка сохранения");

      await loadData();
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    }
  }

  async function deleteUsage(usageId: string) {
    try {
      const res = await fetch(`/api/cuts/fabric-usage?usage_id=${usageId}`, {
        method: "DELETE",
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Ошибка удаления");

      await loadData();
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка");
    }
  }

  function addRow() {
    if (usage.length >= 10) {
      setErr("Максимум 10 разных тканей на крой");
      return;
    }

    if (fabrics.length === 0) {
      setErr("Нет тканей с остатками на складе. Добавьте ткани в склад.");
      return;
    }

    // Add empty row with fabric_id = null (user will select from dropdown)
    setUsage([
      ...usage,
      {
        id: `temp-${Date.now()}`,
        fabric_id: null,
        rolls_used: 0,
        warehouse_fabrics: null,
      },
    ]);
  }

  const usedFabricIds = new Set(usage.map((u) => u.fabric_id).filter((id): id is string => id !== null));
  const availableFabrics = fabrics.filter((f) => !usedFabricIds.has(f.id));

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Расход ткани</h3>
        {usage.length < 10 && (
          <button
            onClick={addRow}
            disabled={availableFabrics.length === 0}
            className="h-8 px-3 rounded-md border border-border text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Добавить ткань
          </button>
        )}
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {availableFabrics.length === 0 && fabrics.length === 0 && !loading && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          Справочник тканей пуст. Сначала добавьте ткани в <a href="/app/inventory" className="underline">склад</a>.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      ) : usage.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Расход ткани не указан. {availableFabrics.length > 0 && "Нажмите \"+ Добавить ткань\" для добавления."}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/20">
            <tr>
              <th className="px-3 py-2 text-left">Ткань</th>
              <th className="px-3 py-2 text-right w-32">Рулоны</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {usage.map((u) => (
              <UsageRow
                key={u.id}
                usage={u}
                fabrics={fabrics}
                onUpdate={(fabricId, rolls) => saveUsage(fabricId || null, rolls)}
                onDelete={() => {
                  if (u.id.startsWith("temp-")) {
                    setUsage(usage.filter((item) => item.id !== u.id));
                  } else {
                    deleteUsage(u.id);
                  }
                }}
                onFabricChange={(usageId, fabricId) => {
                  const newFabric = fabrics.find((f) => f.id === fabricId);
                  if (newFabric) {
                    setUsage(
                      usage.map((item) =>
                        item.id === usageId
                          ? { ...item, fabric_id: fabricId, warehouse_fabrics: newFabric }
                          : item
                      )
                    );
                    // Auto-save with 0 rolls
                    saveUsage(fabricId, 0);
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      )}

      {usage.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Можно указать до 10 разных тканей. Дробные рулоны поддерживаются (например, 2.5).
        </div>
      )}
    </div>
  );
}
