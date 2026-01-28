'use client';

import { useMemo, useState, useRef, useEffect } from 'react';

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function statusForRow(row: any) {
  const qtyTotal = n(row.bundle_qty_total);
  const assigned = n(row.assigned_qty);
  const packed = n(row.packed_qty);
  const defect = n(row.defect_qty);
  const closed = packed + defect;

  if (assigned <= 0) return 'Не выдан швее';
  if (closed < assigned) return 'В работе';
  if (closed >= assigned && assigned >= qtyTotal && qtyTotal > 0) return 'Готово';
  return 'В работе';
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export default function ClientImpl({
  cutId,
  products,
  initialProductId,
  initialColor,
  initialItems,
}: {
  cutId: string;
  products: { id: string; display: string }[];
  initialProductId: string;
  initialColor: string;
  initialItems: any[];
}) {
  const [items, setItems] = useState<any[]>(initialItems);

  // форма добавления позиции
  const [addProductId, setAddProductId] = useState(initialProductId || '');
  const [addColor, setAddColor] = useState(initialColor || '');
  const [addSize, setAddSize] = useState('');
  const [addQty, setAddQty] = useState('');

  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => items, [items]);

  async function createItem() {
    if (!addProductId) return alert('Выбери модель');
    const qty = Number(addQty);
    if (!Number.isFinite(qty) || qty <= 0) return alert('Количество должно быть > 0');

    setBusy(true);
    try {
      await postJson('/api/cut-items/create', {
        cut_id: cutId,
        product_id: addProductId,
        color: addColor,
        size: addSize,
        qty,
      });

      // перезагрузим страницу (проще, чем собирать руками все поля/статусы)
      // но модель/цвет оставляем в состоянии
      location.href = `/app/cuts/${cutId}?product_id=${encodeURIComponent(addProductId)}&color=${encodeURIComponent(addColor)}`;
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function inlineUpdate(itemId: string, patch: Record<string, any>) {
    setBusy(true);
    try {
      await postJson('/api/cut-items/update', { id: itemId, patch });
      // простой способ: обновить страницу, чтобы подтянулись пересчёты qty_total/статусы
      location.reload();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(itemId: string) {
    if (!confirm('Удалить позицию и её пачку?')) return;
    setBusy(true);
    try {
      await postJson('/api/cut-items/delete', { id: itemId });
      location.reload();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  // Автокомплит модели
  const [productQuery, setProductQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find(p => p.id === addProductId);
  
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return products.filter(p => p.display.toLowerCase().includes(q)).slice(0, 15);
  }, [products, productQuery]);

  // Закрыть dropdown при клике снаружи
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <section className="space-y-4">
      <div className="border rounded-lg p-4 space-y-4 max-w-4xl">
        <div className="font-medium">Добавить позицию (пачка создастся сразу)</div>

        {/* Модель с автокомплитом */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm mb-1">Модель</label>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Начни вводить название..."
            value={selectedProduct ? selectedProduct.display : productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value);
              setAddProductId('');
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg max-h-60 overflow-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    setAddProductId(p.id);
                    setProductQuery('');
                    setShowDropdown(false);
                  }}
                >
                  {p.display}
                </button>
              ))}
            </div>
          )}
          {showDropdown && productQuery.length >= 1 && filteredProducts.length === 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow px-3 py-2 text-sm text-gray-500">
              Нет совпадений. Добавь модель через &quot;Нет модели? Добавить&quot;.
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">Список появится после ввода первой буквы.</p>
        </div>

        {/* Цвет, Размер, Кол-во, Кнопка — в ряд */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm mb-1">Цвет</label>
            <input 
              className="border rounded px-3 py-2 w-full" 
              value={addColor} 
              onChange={(e) => setAddColor(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Размер</label>
            <input 
              className="border rounded px-3 py-2 w-full" 
              value={addSize} 
              onChange={(e) => setAddSize(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Раскроили (шт)</label>
            <input 
              className="border rounded px-3 py-2 w-full" 
              value={addQty} 
              onChange={(e) => setAddQty(e.target.value)} 
              inputMode="numeric" 
            />
          </div>

          <div>
            <button
              type="button"
              className="rounded bg-black text-white py-2 px-4 w-full disabled:opacity-60"
              disabled={busy}
              onClick={createItem}
            >
              Добавить
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Модель</th>
              <th className="text-left p-2">Цвет</th>
              <th className="text-left p-2">Размер</th>
              <th className="text-left p-2">Раскроили</th>
              <th className="text-left p-2">Брак ткани</th>
              <th className="text-left p-2">В пачке</th>
              <th className="text-left p-2">№ пачки</th>
              <th className="text-left p-2">Печать</th>
              <th className="text-left p-2">Статус</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              // поддержка обоих вариантов имён полей из RPC
              const itemId = r.id || r.cut_item_id;
              const model = r.product_display || r.product_name || '';
              const qty = n(r.qty);
              const waste = n(r.waste_qty);
              const inBundle = Math.max(0, qty - waste);
              const status = statusForRow(r);

              return (
                <tr
                  key={itemId}
                  className={`border-t align-top hover:bg-gray-50 ${r.bundle_id ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (r.bundle_id) window.location.href = `/app/bundles/${r.bundle_id}`;
                  }}
                >
                  <td className="p-2">{model}</td>
                  <td className="p-2">{r.color ?? ''}</td>
                  <td className="p-2">{r.size ?? ''}</td>

                  {/* qty inline */}
                  <EditableNumber
                    value={qty}
                    onCommit={(v) => inlineUpdate(itemId, { qty: v })}
                  />

                  {/* waste inline */}
                  <EditableNumber
                    value={waste}
                    onCommit={(v) => inlineUpdate(itemId, { waste_qty: v })}
                  />

                  <td className="p-2 font-medium">{inBundle}</td>
                  <td className="p-2 font-semibold">
                    {r.bundle_id ? (
                      <button
                        className="underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/app/bundles/${r.bundle_id}`;
                        }}
                      >
                        {r.bundle_no ?? ''}
                      </button>
                    ) : (
                      r.bundle_no ?? ''
                    )}
                  </td>
                  <td className="p-2">
                    {r.bundle_no ? (
                      <a
                        className="underline"
                        href={`/print/30x20?bundle=${encodeURIComponent(r.bundle_no)}`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Печать
                      </a>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="p-2">{status}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-red-600 font-bold px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRow(itemId);
                      }}
                      title="Удалить"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={10}>
                  Пока нет позиций
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Редактирование: кликни число → введи новое → Enter или клик вне ячейки. Удаление: × (с подтверждением).
      </p>
    </section>
  );
}

function EditableNumber({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v < 0) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    setEditing(false);
    if (v !== value) onCommit(v);
  }

  return (
    <td className="p-2">
      {!editing ? (
        <button
          type="button"
          className="underline decoration-dotted"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(String(value));
            setEditing(true);
          }}
        >
          {value}
        </button>
      ) : (
        <input
          className="border rounded px-2 py-1 w-20"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(String(value));
              setEditing(false);
            }
          }}
          autoFocus
          inputMode="numeric"
        />
      )}
    </td>
  );
}
