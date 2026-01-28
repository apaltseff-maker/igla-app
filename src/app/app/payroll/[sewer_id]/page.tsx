import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRUDate } from "@/lib/format";

export default async function PayrollDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sewer_id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { sewer_id } = await params;
  const sp = await searchParams;
  const from = sp.from!;
  const to = sp.to!;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data, error } = await supabase.rpc("payroll_details", {
    p_from: from,
    p_to: to,
    p_sewer_id: sewer_id,
  });

  // имя швеи
  const { data: sewer } = await supabase
    .from("employees")
    .select("code, full_name")
    .eq("id", sewer_id)
    .single();

  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  return (
    <main className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {sewer?.code ? `${sewer.code} — ` : ""}{sewer?.full_name ?? "Швея"}
          </h1>
          <div className="text-sm text-muted">Период: {formatRUDate(from)} — {formatRUDate(to)}</div>
        </div>
        <Link className="text-accent hover:underline text-sm" href={`/app/payroll?from=${from}&to=${to}`}>← Назад</Link>
      </div>

      {error && <div className="text-sm text-danger">{error.message}</div>}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <colgroup>
            <col />                        {/* Артикул (резиновая) */}
            <col className="w-[100px]" />  {/* Расценка */}
            <col className="w-[100px]" />  {/* Закрыто */}
            <col className="w-[120px]" />  {/* Сумма */}
          </colgroup>
          <thead className="bg-bg">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Артикул / цвет / размер</th>
              <th className="px-3 py-2 text-right font-semibold">Расценка</th>
              <th className="px-3 py-2 text-right font-semibold">Закрыто (шт)</th>
              <th className="px-3 py-2 text-right font-semibold">Сумма</th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {(data ?? []).map((r: any, idx: number) => (
              <tr key={idx} className="border-t border-border hover:bg-bg/50">
                <td className="px-3 py-2 truncate" title={`${r.item_cut_name} / ${r.color ?? ""} / ${r.size ?? ""}`}>
                  {r.item_cut_name} / {r.color ?? ""} / {r.size ?? ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.rate ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.qty_closed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.amount ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>Нет данных за период</td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-bg border-t border-border">
            <tr>
              <td className="px-3 py-2 font-semibold" colSpan={3}>Итого</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-accent">{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
