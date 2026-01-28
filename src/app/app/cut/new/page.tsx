import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default async function CutNewPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  // role check (admin or cutter can create)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', userData.user.id)
    .single();
  
  if (!profile || !profile.role || !['admin', 'cutter'].includes(profile.role)) redirect('/app');
  if (!profile.org_id) redirect('/app');

  const { data: products } = await supabase
    .from('products')
    .select('id, display')
    .eq('org_id', profile.org_id)
    .eq('active', true)
    .order('display', { ascending: true });

  const { data: cutters } = await supabase
    .from('employees')
    .select('id, code, full_name')
    .eq('org_id', profile.org_id)
    .eq('active', true)
    .eq('role', 'cutter')
    .order('code', { ascending: true });

  async function createBundle(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const cut_date = String(formData.get('cut_date') || '').trim(); // yyyy-mm-dd
    const product_id = String(formData.get('product_id') || '').trim();
    const color = String(formData.get('color') || '').trim();
    const size = String(formData.get('size') || '').trim();
    const qty_total = Number(String(formData.get('qty_total') || '').trim());
    const cut_name = String(formData.get('cut_name') || '').trim();
    const cutter_employee_id = String(formData.get('cutter_employee_id') || '').trim() || null;

    if (!product_id) throw new Error('Выбери модель');
    if (!cut_date) throw new Error('Укажи дату');
    if (!Number.isFinite(qty_total) || qty_total <= 0) throw new Error('Количество должно быть > 0');

    // org_id for insert (because org_id is NOT NULL and RLS requires it)
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Не авторизован');
    
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.user.id)
      .single();
    if (pErr || !prof?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    // generate unique bundle_no 10..99999 in this org
    let bundle_no: string | null = null;

    for (let i = 0; i < 30; i++) {
      const candidate = String(randInt(10, 99999));
      const { data: exists } = await supabase
        .from('cut_bundles')
        .select('id')
        .eq('org_id', prof.org_id)
        .eq('bundle_no', candidate)
        .maybeSingle();

      if (!exists) {
        bundle_no = candidate;
        break;
      }
    }

    if (!bundle_no) throw new Error('Не смогли подобрать уникальный номер пачки, попробуй ещё раз');

    const { error } = await supabase.from('cut_bundles').insert({
      org_id: prof.org_id,
      bundle_no,
      cut_date,
      product_id,
      color: color || null,
      size: size || null,
      qty_total,
      cut_name: cut_name || null,
      cutter_employee_id,
    });

    if (error) throw new Error(error.message);

    const { redirect } = await import('next/navigation');
    redirect(`/print/30x20?bundle=${encodeURIComponent(bundle_no)}`);
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Крой — создать пачку</h1>
        <a className="text-sm underline" href="/app">Назад</a>
      </div>

      <form action={createBundle} className="border rounded-lg p-4 grid gap-3 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm">Дата кроя</span>
          <input type="date" name="cut_date" className="border rounded px-3 py-2" defaultValue={todayStr} required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Модель</span>
          <select name="product_id" className="border rounded px-3 py-2" required defaultValue="">
            <option value="" disabled>Выбери…</option>
            {(products || []).map((p) => (
              <option key={p.id} value={p.id}>{p.display}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Цвет</span>
          <input name="color" className="border rounded px-3 py-2" placeholder="например: черный" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Размер</span>
          <input name="size" className="border rounded px-3 py-2" placeholder="например: 44" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Количество в пачке</span>
          <input name="qty_total" className="border rounded px-3 py-2" inputMode="numeric" required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Название кроя (например: 1, 2)</span>
          <input name="cut_name" className="border rounded px-3 py-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Сотрудник (закройщик)</span>
          <select name="cutter_employee_id" className="border rounded px-3 py-2" defaultValue="">
            <option value="">Не выбирать</option>
            {(cutters || []).map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.full_name}</option>
            ))}
          </select>
        </label>

        <button className="rounded bg-black text-white py-2 w-fit px-4">
          Создать и печатать 30×20
        </button>
      </form>

      <p className="text-xs text-gray-500">
        После создания откроется печать 30×20 с № пачки и строкой "модель/цвет/размер".
      </p>
    </main>
  );
}
