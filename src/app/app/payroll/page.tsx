import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRUDate } from "@/lib/format";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const revalidate = 30;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultTo = today;

  const from = sp.from ?? toISODate(defaultFrom);
  const to = sp.to ?? toISODate(defaultTo);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data, error } = await supabase.rpc("payroll_summary", {
    p_from: from,
    p_to: to,
  });

  return (
    <main className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Зарплата швей</h1>
          <div className="text-sm text-gray-600">Период: {formatRUDate(from)} — {formatRUDate(to)}</div>
        </div>
      </div>

      <form className="flex gap-2 items-end flex-wrap" action="/app/payroll" method="GET">
        <label className="grid gap-1 text-sm">
          <span>С</span>
          <input className="h-10 rounded-xl border border-border bg-card px-3 text-sm" type="date" name="from" defaultValue={from} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>По</span>
          <input className="h-10 rounded-xl border border-border bg-card px-3 text-sm" type="date" name="to" defaultValue={to} />
        </label>
        <button className="h-10 rounded-xl bg-primary text-primary-contrast px-4 text-sm font-medium" type="submit">
          Показать
        </button>
      </form>

      {error && <div className="text-sm text-danger">{error.message}</div>}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <colgroup>
            <col />                        {/* Швея (резиновая) */}
            <col className="w-[100px]" />  {/* Закрыто */}
            <col className="w-[120px]" />  {/* Сумма */}
            <col className="w-[100px]" />  {/* Открыть */}
          </colgroup>
          <thead className="bg-bg">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Швея</th>
              <th className="px-3 py-2 text-right font-semibold">Закрыто (шт)</th>
              <th className="px-3 py-2 text-right font-semibold">Сумма</th>
              <th className="px-3 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {(data ?? []).map((r: any) => (
              <tr key={r.sewer_employee_id} className="border-t border-border hover:bg-bg/50">
                <td className="px-3 py-2">{r.sewer_code} — {r.sewer_full_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.qty_closed}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{Number(r.amount ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <Link className="text-accent hover:underline text-xs" href={`/app/payroll/${r.sewer_employee_id}?from=${from}&to=${to}`}>
                    Детализация
                  </Link>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>Нет данных за период</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
