import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/BackButton';
import ClientImpl from './table-client';
import CutHeaderClient from './cut-header-client';
import FabricUsageClient from './fabric-usage-client';

export default async function CutDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ product_id?: string; color?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const cutId = id;

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: cut, error: cutErr } = await supabase
    .from('cuts')
    .select('id, cut_date, cut_name, note, cutter_employee_id')
    .eq('id', cutId)
    .single();

  if (cutErr) throw new Error(cutErr.message);

  // Список закройщиков для шапки
  const { data: cutters } = await supabase
    .from('employees')
    .select('id, full_name')
    .eq('active', true)
    .eq('role', 'cutter')
    .order('full_name', { ascending: true });

  const { data: products } = await supabase
    .from('products')
    .select('id, display')
    .eq('active', true)
    .order('display', { ascending: true });

  // Позиции + пачки + агрегаты выдачи/упаковки по пачке
  const { data: items, error: itemsErr } = await supabase.rpc('cut_items_with_bundle_stats', { p_cut_id: cutId });

  if (itemsErr) {
    throw new Error(itemsErr.message);
  }

  const lastProductId = sp.product_id ?? '';
  const lastColor = sp.color ?? '';

  async function quickAddProduct(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const display = String(formData.get('display') || '').trim();
    const kind = String(formData.get('kind') || '').trim();

    if (!display || !kind) return;

    const { data: prof, error: pErr } = await supabase.from('profiles').select('org_id').single();
    if (pErr || !prof?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    const { data, error } = await supabase
      .from('products')
      .insert({ org_id: prof.org_id, display, kind, active: true })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const { redirect } = await import('next/navigation');
    redirect(`/app/cuts/${cutId}?product_id=${encodeURIComponent(data.id)}`);
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Крой</h1>
        <div className="flex gap-3 items-center">
          <a className="text-sm underline" href="/app/cuts">Список кроев</a>
          <BackButton />
        </div>
      </div>

      {/* Шапка кроя с редактированием */}
      <CutHeaderClient
        cut_id={cut.id}
        cut_date={cut.cut_date}
        cut_name={cut.cut_name ?? ''}
        cutter_employee_id={cut.cutter_employee_id ?? ''}
        note={cut.note}
        employees={(cutters ?? []) as { id: string; full_name: string }[]}
      />

      {/* Расход ткани */}
      <FabricUsageClient cutId={cutId} />

      {/* Быстро добавить модель (ОТДЕЛЬНО, не внутри другой формы) */}
      <details className="border rounded p-4 max-w-xl">
        <summary className="cursor-pointer text-sm underline">Нет модели? Добавить</summary>
        <form action={quickAddProduct} className="mt-3 grid gap-2">
          <select name="kind" className="border rounded px-3 py-2" required defaultValue="футболка">
            {[
              'платье','футболка','свитшот','лосины','брюки','бомбер','шорты','куртка','костюм','туника',
              'сарафан','юбка','худи','капри','джинсы','топ','блузка','рубашка',
            ].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <input
            name="display"
            className="border rounded px-3 py-2"
            placeholder="Название модели (Лекси)"
            required
          />

          <button className="rounded bg-black text-white py-2 w-fit px-4">
            Добавить модель
          </button>
        </form>
      </details>

      {/* Добавить позицию (client-табличка ниже будет править инлайном) */}
      <ClientImpl
        cutId={cutId}
        products={(products || []) as { id: string; display: string }[]}
        initialProductId={lastProductId}
        initialColor={lastColor}
        initialItems={(items || []) as any[]}
      />
    </main>
  );
}
