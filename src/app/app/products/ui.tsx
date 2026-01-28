"use client";

import { useState } from "react";

type Product = {
  id: string;
  display: string;
  kind: string;
  base_rate: number | null;
  active: boolean;
  created_at: string;
};

type RowState = {
  saving: boolean;
  saved: boolean;
  error: string | null;
};

type FieldValues = {
  display: string;
  base_rate: string;
};

export function ProductsTableClient({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValues>>(() => {
    const initial: Record<string, FieldValues> = {};
    initialProducts.forEach((p) => {
      initial[p.id] = {
        display: p.display,
        base_rate: p.base_rate?.toString() ?? "",
      };
    });
    return initial;
  });

  async function updateProduct(productId: string, field: "display" | "base_rate", value: string | number) {
    // Validate and prepare value for API
    let apiValue: string | number | null;
    
    if (field === "display") {
      const trimmed = String(value).trim();
      if (!trimmed) {
        setRowStates((prev) => ({
          ...prev,
          [productId]: { saving: false, saved: false, error: "Название не может быть пустым" },
        }));
        return;
      }
      apiValue = trimmed;
    } else if (field === "base_rate") {
      const num = typeof value === "string" ? Number(value.replace(",", ".")) : value;
      if (!Number.isFinite(num) || num < 0) {
        setRowStates((prev) => ({
          ...prev,
          [productId]: { saving: false, saved: false, error: "Расценка должна быть >= 0" },
        }));
        return;
      }
      apiValue = num === 0 ? null : num;
    } else {
      apiValue = value;
    }

    // Set saving state
    setRowStates((prev) => ({
      ...prev,
      [productId]: { saving: true, saved: false, error: null },
    }));

    try {
      const res = await fetch("/api/products/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          [field]: apiValue,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error || `Ошибка (status ${res.status})`);
      }

      // Update local state
      const updatedProduct = products.find((p) => p.id === productId);
      if (updatedProduct) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, [field]: apiValue } : p))
        );
        // Update field values
        setFieldValues((prev) => ({
          ...prev,
          [productId]: {
            ...prev[productId],
            [field]: field === "base_rate" ? (apiValue === null ? "" : String(apiValue)) : String(apiValue),
          },
        }));
      }

      // Show saved state
      setRowStates((prev) => ({
        ...prev,
        [productId]: { saving: false, saved: true, error: null },
      }));

      // Clear saved state after 2 seconds
      setTimeout(() => {
        setRowStates((prev) => {
          const next = { ...prev };
          if (next[productId]?.saved) {
            next[productId] = { saving: false, saved: false, error: null };
          }
          return next;
        });
      }, 2000);
    } catch (err) {
      setRowStates((prev) => ({
        ...prev,
        [productId]: {
          saving: false,
          saved: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }

  return (
    <div className="overflow-auto border rounded-lg">
      <table className="min-w-[920px] w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Тип</th>
            <th className="text-left p-2">Модель</th>
            <th className="text-left p-2">Расценка</th>
            <th className="text-left p-2">Активно</th>
            <th className="text-left p-2">Действия</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const state = rowStates[p.id] || { saving: false, saved: false, error: null };
            const values = fieldValues[p.id] || { display: p.display, base_rate: p.base_rate?.toString() ?? "" };

            return (
              <tr
                key={p.id}
                className={`border-t align-top ${state.saving ? "opacity-60" : ""} ${
                  state.saved ? "bg-green-50/50" : ""
                }`}
              >
                <td className="p-2">{p.kind ?? ""}</td>

                {/* Inline editable display */}
                <td className="p-2">
                  <input
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-accent focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                    value={values.display}
                    onChange={(e) => {
                      setFieldValues((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], display: e.target.value },
                      }));
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== p.display) {
                        updateProduct(p.id, "display", e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        setFieldValues((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], display: p.display },
                        }));
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={state.saving}
                  />
                </td>

                {/* Inline editable base_rate */}
                <td className="p-2">
                  <input
                    className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-accent focus:ring-1 focus:ring-accent rounded px-1 py-0.5 text-right tabular-nums"
                    type="text"
                    inputMode="decimal"
                    value={values.base_rate}
                    onChange={(e) => {
                      setFieldValues((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], base_rate: e.target.value },
                      }));
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value.trim();
                      const oldValue = p.base_rate?.toString() ?? "";
                      if (newValue !== oldValue) {
                        updateProduct(p.id, "base_rate", newValue);
                      } else {
                        setFieldValues((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], base_rate: oldValue },
                        }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        const oldValue = p.base_rate?.toString() ?? "";
                        setFieldValues((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], base_rate: oldValue },
                        }));
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={state.saving}
                    placeholder="—"
                  />
                </td>

                <td className="p-2">{p.active ? "Да" : "Нет"}</td>

                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {state.saving && <span className="text-xs text-muted-foreground">Сохранение...</span>}
                    {state.saved && <span className="text-xs text-green-600">✓ Сохранено</span>}
                    {state.error && (
                      <span className="text-xs text-red-600" title={state.error}>
                        ⚠ Ошибка
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {products.length === 0 && (
            <tr>
              <td className="p-2 text-gray-500" colSpan={5}>
                Пока пусто
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
