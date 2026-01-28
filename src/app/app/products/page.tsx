import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductsTableClient } from './ui';
import ExcelUploadClient from './excel-upload-client';

const KINDS = [
  'платье',
  'футболка',
  'свитшот',
  'лосины',
  'брюки',
  'бомбер',
  'шорты',
  'куртка',
  'костюм',
  'туника',
  'сарафан',
  'юбка',
  'худи',
  'капри',
  'джинсы',
  'топ',
  'блузка',
  'рубашка',
] as const;

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', userData.user.id)
    .single();
  
  if (profileError) {
    console.error('Profile error:', profileError);
    // Если ошибка RLS или профиль не найден - редирект на главную
    redirect('/app');
  }
  
  if (!profile) {
    console.error('Profile not found for user:', userData.user.id);
    redirect('/app');
  }
  
  if (!profile.org_id) {
    console.error('User has no org_id:', userData.user.id);
    redirect('/app');
  }
  
  if (profile.role !== 'admin') redirect('/app');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, display, kind, base_rate, active, created_at')
    .eq('org_id', profile.org_id)
    .order('active', { ascending: false })
    .order('kind', { ascending: true })
    .order('display', { ascending: true });

  async function addProduct(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const display = String(formData.get('display') || '').trim();
    const kind = String(formData.get('kind') || '').trim();
    const baseRateRaw = String(formData.get('base_rate') || '').trim();
    const base_rate = baseRateRaw === '' ? null : Number(baseRateRaw.replace(',', '.'));

    if (!display || !kind) return;
    if (base_rate !== null && (Number.isNaN(base_rate) || base_rate < 0)) {
      throw new Error('Расценка должна быть числом >= 0');
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Не авторизован');
    
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.user.id)
      .single();
    if (pErr || !profile?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    const { error } = await supabase.from('products').insert({
      org_id: profile.org_id,
      display,
      kind,
      base_rate,
      active: true,
    });

    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath('/app/products');
    redirect('/app/products');
  }

  async function deactivateProduct(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const id = String(formData.get('id') || '').trim();
    if (!id) return;

    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath('/app/products');
    redirect('/app/products');
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Изделия</h1>
        <div className="flex items-center gap-3">
          <ExcelUploadClient />
          <a className="text-sm underline" href="/app">Назад</a>
        </div>
      </div>

      <form action={addProduct} className="border rounded-lg p-4 grid gap-3 max-w-xl">
        <div className="font-medium">Добавить изделие</div>

        <label className="grid gap-1">
          <span className="text-sm">Тип изделия</span>
          <select name="kind" className="border rounded px-3 py-2" required defaultValue="футболка">
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Название модели (например: Лекси)</span>
          <input name="display" className="border rounded px-3 py-2" required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Расценка (руб/шт)</span>
          <input name="base_rate" className="border rounded px-3 py-2" inputMode="decimal" placeholder="например 120" />
        </label>

        <button className="rounded bg-black text-white py-2 w-fit px-4">Добавить</button>
      </form>

      <section className="space-y-2">
        <div className="font-medium">Список</div>
        {error && <div className="text-sm text-red-600">{error.message}</div>}

        <ProductsTableClient products={(products || []) as any} />

        <p className="text-xs text-gray-500">
          Кликните на "Модель" или "Расценка" для редактирования. Сохранение по Enter или при потере фокуса.
          <br />
          Удаление = деактивация, чтобы не ломать историю (крой/упаковка).
        </p>
      </section>
    </main>
  );
}
