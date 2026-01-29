import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "./_components/kpi-card";
import { StaleCutsTable } from "./_components/stale-cuts-table";

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const revalidate = 30;

export default async function AppHomePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  // Получаем org_id для фильтрации
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.org_id) {
    // Если нет org_id - показываем пустую страницу или редирект
    return (
      <main className="p-6">
        <div className="text-red-600">
          У вас нет организации. Обратитесь к администратору.
        </div>
      </main>
    );
  }

  // 1) Крои со статусами
  const { data: cuts, error: cutsErr } = await supabase.rpc("cuts_list_with_stats", {
    p_cutter_employee_id: null,
    p_q: null,
  });

  const list = (cuts as any[]) || [];

  // Виджет: давно накроили, но не выдали
  const staleDays = 2;
  const staleDate = daysAgoISO(staleDays);

  const staleNotAssigned = list
    .filter((c) => c.cut_status === "Не выдан")
    .filter((c) => (c.cut_date ?? "9999-12-31") <= staleDate)
    .slice(0, 10);

  const staleCount = list
    .filter((c) => c.cut_status === "Не выдан")
    .filter((c) => (c.cut_date ?? "9999-12-31") <= staleDate).length;

  // Тестовые метрики
  const last7 = daysAgoISO(7);
  const cuts7d = list.filter((c) => (c.cut_date ?? "0000-01-01") >= last7).length;

  const inWorkCuts = list.filter((c) => c.cut_status === "В работе").length;

  // Упаковано за сегодня (прямой запрос по packaging_events)
  const today = new Date().toISOString().slice(0, 10);
  const { data: packRows } = await supabase
    .from("packaging_events")
    .select("packed_qty, defect_qty, packaged_at")
    .eq("org_id", profile.org_id)
    .gte("packaged_at", `${today}T00:00:00.000Z`)
    .lt("packaged_at", `${today}T23:59:59.999Z`);

  const packedToday = (packRows ?? []).reduce((s: number, r: any) => s + Number(r.packed_qty ?? 0), 0);
  const defectToday = (packRows ?? []).reduce((s: number, r: any) => s + Number(r.defect_qty ?? 0), 0);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Портал</h1>
          <div className="text-sm text-gray-600">Сводка по цеху</div>
        </div>

        <div className="flex gap-2">
          <Link className="rounded bg-black text-white px-4 py-2 text-sm" href="/app/cuts/new">
            Создать ID кроя
          </Link>
          <Link className="rounded border px-4 py-2 text-sm" href="/app/assignments">
            Выдача швее
          </Link>
          <Link className="rounded border px-4 py-2 text-sm" href="/app/packaging">
            Упаковка
          </Link>
        </div>
      </div>

      {cutsErr && (
        <div className="text-sm text-red-600">
          Ошибка загрузки кроев: {cutsErr.message}
        </div>
      )}

      {/* Метрики (кликабельные виджеты) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard
          title="Кроев за 7 дней"
          value={cuts7d}
          hint="Открыть крои"
          href="/app/cuts?range=7d"
        />
        <KpiCard
          title="Кроев в работе"
          value={inWorkCuts}
          hint="Выдано → закрыто"
          href="/app/cuts?status=in_work"
        />
        <KpiCard
          title="Упаковано сегодня"
          value={packedToday}
          hint={`Брак: ${defectToday}`}
          href="/app/packaging?date=today"
        />
        <KpiCard
          title="Давно накроили, не выдали"
          value={staleCount}
          hint={`старше ${staleDays} дн.`}
          href="/app/cuts?status=not_assigned&older_than_days=2"
        />
      </div>

      {/* Главный виджет */}
      <StaleCutsTable cuts={staleNotAssigned} staleDays={staleDays} />
    </main>
  );
}
