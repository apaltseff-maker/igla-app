'use client';

import { useMemo, useState } from 'react';

type Product = { id: string; display: string };

export function ProductAutocomplete({
  products,
  name = 'product_id',
  defaultProductId = '',
}: {
  products: Product[];
  name?: string;
  defaultProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(defaultProductId);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return []; // ВАЖНО: список только после 1-й буквы
    return products
      .filter((p) => p.display.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, query]);

  return (
    <div className="relative">
      {/* скрытое поле, которое реально отправится в server action */}
      <input type="hidden" name={name} value={selectedId} />

      <input
        className="w-full border rounded px-3 py-2"
        value={selected ? selected.display : query}
        onChange={(e) => {
          setSelectedId(''); // сброс выбора
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // небольшая задержка, чтобы успеть кликнуть по пункту
          setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Начни вводить модель (Лекси...)"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-64 overflow-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelectedId(p.id);
                setQuery('');
                setOpen(false);
              }}
            >
              {p.display}
            </button>
          ))}
        </div>
      )}

      {!selectedId && query.trim().length >= 1 && open && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow px-3 py-2 text-sm text-gray-500">
          Нет совпадений. Добавь модель через &quot;Нет модели? Добавить&quot;.
        </div>
      )}
    </div>
  );
}
