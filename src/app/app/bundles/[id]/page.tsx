import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/BackButton";

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bundleId } = await params;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // 1) Данные пачки + (на всякий) product_display из products
  const { data: bundle, error: bundleErr } = await supabase
    .from("cut_bundles")
    .select(
      `
      id, bundle_no, cut_id, cut_date, cut_name, color, size, qty_total, product_id, created_at,
      products ( display )
    `
    )
    .eq("id", bundleId)
    .single();

  if (bundleErr) {
    return (
      <main className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-semibold">Пачка</h1>
        </div>
        <div className="text-sm text-red-600">{bundleErr.message}</div>
      </main>
    );
  }

  // 2) Агрегаты по пачке
  const { data: asgRows } = await supabase
    .from("sewing_assignments")
    .select("sewer_employee_id, qty")
    .eq("bundle_id", bundleId);

  const { data: pkgRows } = await supabase
    .from("packaging_events")
    .select("sewer_employee_id, packed_qty, defect_qty")
    .eq("bundle_id", bundleId);

  // 3) Группировка по швеям
  const map = new Map<
    string,
    { sewer_employee_id: string; assigned: number; closed: number }
  >();

  for (const r of asgRows ?? []) {
    const id = r.sewer_employee_id as string;
    const cur = map.get(id) ?? { sewer_employee_id: id, assigned: 0, closed: 0 };
    cur.assigned += Number(r.qty ?? 0);
    map.set(id, cur);
  }

  for (const r of pkgRows ?? []) {
    const id = r.sewer_employee_id as string;
    const cur = map.get(id) ?? { sewer_employee_id: id, assigned: 0, closed: 0 };
    cur.closed += Number(r.packed_qty ?? 0) + Number(r.defect_qty ?? 0);
    map.set(id, cur);
  }

  const perSewer = Array.from(map.values());

  // 4) Подтянуть имена швей одним запросом
  const sewerIds = perSewer.map((x) => x.sewer_employee_id);
  const { data: sewers } = sewerIds.length
    ? await supabase
        .from("employees")
        .select("id, full_name")
        .in("id", sewerIds)
    : { data: [] as any[] };

  const nameById = new Map<string, string>(
    (sewers ?? []).map((e: any) => [e.id, e.full_name])
  );

  const assignedSum = perSewer.reduce((s, x) => s + x.assigned, 0);
  const closedSum = perSewer.reduce((s, x) => s + x.closed, 0);
  const inWorkSum = Math.max(assignedSum - closedSum, 0);

  const status =
    assignedSum === 0 ? "Не выдана" : closedSum < assignedSum ? "В работе" : "Готово";

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-2xl font-semibold">
            Пачка № {bundle.bundle_no}
          </h1>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link className="underline" href={`/app/cuts/${bundle.cut_id}`}>
            Открыть крой
          </Link>
        </div>
      </div>

      {/* Карточка пачки */}
      <div className="border rounded-lg p-4 grid gap-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div><span className="text-gray-500">Модель:</span> {(bundle.products as any)?.display ?? bundle.cut_name ?? ""}</div>
          <div><span className="text-gray-500">Цвет:</span> {bundle.color ?? ""}</div>
          <div><span className="text-gray-500">Размер:</span> {bundle.size ?? ""}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
          <div><span className="text-gray-500">В пачке:</span> {bundle.qty_total ?? 0}</div>
          <div><span className="text-gray-500">Выдано:</span> {assignedSum}</div>
          <div><span className="text-gray-500">Закрыто:</span> {closedSum}</div>
          <div><span className="text-gray-500">Статус:</span> {status}</div>
        </div>
      </div>

      {/* Таблица швей */}
      <div className="overflow-auto border rounded-lg">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Швея</th>
              <th className="text-right p-2">Взяла</th>
              <th className="text-right p-2">Закрыто</th>
              <th className="text-right p-2">В работе</th>
            </tr>
          </thead>
          <tbody>
            {perSewer.map((r) => {
              const name = nameById.get(r.sewer_employee_id) ?? r.sewer_employee_id;
              const inWork = Math.max(r.assigned - r.closed, 0);
              return (
                <tr key={r.sewer_employee_id} className="border-t">
                  <td className="p-2">{name}</td>
                  <td className="p-2 text-right tabular-nums">{r.assigned}</td>
                  <td className="p-2 text-right tabular-nums">{r.closed}</td>
                  <td className="p-2 text-right tabular-nums">{inWork}</td>
                </tr>
              );
            })}

            {perSewer.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={4}>
                  Пока никто не получил пачку в работу.
                </td>
              </tr>
            )}
          </tbody>

          {perSewer.length > 0 && (
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td className="p-2 font-medium">Итого</td>
                <td className="p-2 text-right tabular-nums font-medium">{assignedSum}</td>
                <td className="p-2 text-right tabular-nums font-medium">{closedSum}</td>
                <td className="p-2 text-right tabular-nums font-medium">{inWorkSum}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  );
}
