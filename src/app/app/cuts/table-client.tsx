"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRUDate } from "@/lib/format";

type CutRow = {
  cut_id: string;
  cut_date: string | null;
  cutter_name: string | null;
  cut_name: string | null;
  qty_in_cut: number | null;
  cut_status: string | null;
  note: string | null;
};

export default function CutsTableClient({ cuts }: { cuts: CutRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(cut_id: string) {
    const ok = confirm(
      "Удалить этот крой? (Если есть движение — удаление будет запрещено)"
    );
    if (!ok) return;

    try {
      setDeletingId(cut_id);
      const res = await fetch("/api/cuts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cut_id }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(body?.error || `Ошибка удаления (status ${res.status})`);
        return;
      }

      router.refresh(); // обновит server data
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full text-[13px]">
        <colgroup>
          <col className="w-[80px]" />   {/* Дата */}
          <col className="w-[120px]" />  {/* Закройщик */}
          <col />                        {/* Название (резиновая) */}
          <col className="w-[65px]" />   {/* Кол-во */}
          <col className="w-[100px]" />  {/* Статус */}
          <col className="w-[150px]" />  {/* Примечание */}
          <col className="w-[70px]" />   {/* Открыть */}
          <col className="w-[70px]" />   {/* Удалить */}
        </colgroup>
        <thead className="bg-bg">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Дата</th>
            <th className="px-2 py-1.5 text-left font-semibold">Закройщик</th>
            <th className="px-2 py-1.5 text-left font-semibold">Название</th>
            <th className="px-2 py-1.5 text-right font-semibold">Шт</th>
            <th className="px-2 py-1.5 text-left font-semibold">Статус</th>
            <th className="px-2 py-1.5 text-left font-semibold">Примечание</th>
            <th className="px-2 py-1.5 text-left font-semibold"></th>
            <th className="px-2 py-1.5 text-left font-semibold"></th>
          </tr>
        </thead>

        <tbody className="bg-card">
          {(cuts || []).map((c) => (
            <tr
              key={c.cut_id}
              className="border-t border-border hover:bg-bg/50 cursor-pointer"
              onClick={() => router.push(`/app/cuts/${c.cut_id}`)}
            >
              <td className="px-2 py-1.5 whitespace-nowrap">{formatRUDate(c.cut_date)}</td>
              <td className="px-2 py-1.5 truncate" title={c.cutter_name ?? ""}>{c.cutter_name ?? ""}</td>
              <td className="px-2 py-1.5 truncate" title={c.cut_name ?? ""}>{c.cut_name ?? ""}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{c.qty_in_cut ?? 0}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{c.cut_status ?? ""}</td>
              <td className="px-2 py-1.5 truncate" title={c.note ?? ""}>{c.note ?? ""}</td>

              <td className="px-2 py-1.5">
                <button
                  className="text-accent hover:underline text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/app/cuts/${c.cut_id}`);
                  }}
                >
                  Открыть
                </button>
              </td>

              <td className="px-2 py-1.5">
                <button
                  className="text-danger hover:underline text-xs disabled:opacity-50"
                  disabled={deletingId === c.cut_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.cut_id);
                  }}
                >
                  {deletingId === c.cut_id ? "..." : "Удалить"}
                </button>
              </td>
            </tr>
          ))}

          {cuts?.length === 0 && (
            <tr>
              <td className="px-2 py-3 text-muted" colSpan={8}>
                Ничего не найдено
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
