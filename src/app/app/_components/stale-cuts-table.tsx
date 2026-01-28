"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type StaleCut = {
  cut_id: string;
  cut_date: string | null;
  cutter_name: string | null;
  cut_name: string | null;
  qty_in_cut: number | null;
  cut_status: string | null;
};

type Props = {
  cuts: StaleCut[];
  staleDays: number;
};

export function StaleCutsTable({ cuts, staleDays }: Props) {
  const router = useRouter();

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Давно накроили, но не выдали в работу</div>
          <div className="text-sm text-gray-600">
            Крои со статусом &quot;Не выдан&quot; старше {staleDays} дней
          </div>
        </div>
        <Link
          className="text-sm text-amber-700 hover:underline font-medium"
          href="/app/cuts?status=not_assigned&older_than_days=2"
        >
          Перейти в крои →
        </Link>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Дата</th>
              <th className="text-left p-2">Закройщик</th>
              <th className="text-left p-2">Название</th>
              <th className="text-right p-2">Кол-во</th>
              <th className="text-left p-2">Статус</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {cuts.map((c) => (
              <tr
                key={c.cut_id}
                className="border-t cursor-pointer hover:bg-amber-50/60 transition"
                onClick={() => router.push(`/app/cuts/${c.cut_id}`)}
              >
                <td className="p-2 whitespace-nowrap">{c.cut_date ?? ""}</td>
                <td className="p-2">{c.cutter_name ?? ""}</td>
                <td className="p-2">{c.cut_name ?? ""}</td>
                <td className="p-2 text-right tabular-nums">{c.qty_in_cut ?? 0}</td>
                <td className="p-2">{c.cut_status ?? ""}</td>
                <td className="p-2">
                  <Link
                    className="text-amber-700 hover:underline"
                    href={`/app/cuts/${c.cut_id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}

            {cuts.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  Таких кроев нет — отлично.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
