import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/BackButton";
import CutsTableClient from "./table-client";

export default async function CutsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bundle?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const bundle = (sp.bundle || "").trim();
  const errorParam = sp.error;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Получаем org_id для фильтрации
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.org_id) {
    redirect('/app');
  }

  // поиск по № пачки -> редирект в крой
  if (bundle) {
    const { data: b, error } = await supabase
      .from("cut_bundles")
      .select("cut_id")
      .eq("org_id", profile.org_id)
      .eq("bundle_no", bundle)
      .maybeSingle();

    if (!error && b?.cut_id) {
      redirect(`/app/cuts/${b.cut_id}`);
    }
  }

  const { data: cuts, error: cutsErr } = await supabase.rpc(
    "cuts_list_with_stats",
    {
      p_cutter_employee_id: null,
      p_q: q || null,
    }
  );

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Крои</h1>

        <div className="flex items-center gap-3">
          <Link
            className="rounded bg-black text-white px-4 py-2 text-sm"
            href="/app/cuts/new"
          >
            Создать ID кроя
          </Link>
          <BackButton />
        </div>
      </div>

      {bundle && (
        <div className="text-sm text-gray-600">
          Если пачка не найдена — проверь номер или убедись, что пачка уже создана.
        </div>
      )}

      {errorParam === 'not_found' && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Крой не найден или нет доступа. Если только что создали крой — обновите страницу.
        </div>
      )}
      {cutsErr && <div className="text-sm text-red-600">{cutsErr.message}</div>}

      {/* Фильтры + кнопка "Искать" справа */}
      <form className="grid gap-2 max-w-4xl" action="/app/cuts" method="GET">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_auto] gap-2 items-end">
          <label className="grid gap-1">
            <span className="text-sm">Поиск по названию/примечанию</span>
            <input
              name="q"
              defaultValue={q}
              className="border rounded px-3 py-2"
              placeholder="например: лекси / ткань / 22.01"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Найти ID кроя по № пачки</span>
            <input
              name="bundle"
              defaultValue={bundle}
              className="border rounded px-3 py-2"
              placeholder="например: 12345"
              inputMode="numeric"
            />
          </label>

          <button className="rounded bg-black text-white py-2 px-4 h-[42px]" type="submit">
            Искать
          </button>
        </div>
      </form>

      <CutsTableClient cuts={((cuts as any) || []).map((c: { id: string; total_qty?: number; [k: string]: unknown }) => ({ ...c, cut_id: c.id, qty_in_cut: c.total_qty }))} />
    </main>
  );
}
