import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/BackButton';

export default async function CutCreatePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, org_id').single();
  if (!profile?.role || !['admin', 'cutter'].includes(profile.role)) redirect('/app');

  const { data: cutters } = await supabase
    .from('employees')
    .select('id, code, full_name')
    .eq('active', true)
    .eq('role', 'cutter')
    .order('code', { ascending: true });

  async function createCut(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const cut_date = String(formData.get('cut_date') || '').trim();
    const cut_name = String(formData.get('cut_name') || '').trim();
    const note = String(formData.get('note') || '').trim();
    const cutter_employee_id = String(formData.get('cutter_employee_id') || '').trim();

    if (!cut_name) throw new Error('Название кроя обязательно');
    if (!cutter_employee_id) throw new Error('Сотрудник (закройщик) обязателен');

    const { data: prof, error: pErr } = await supabase.from('profiles').select('org_id').single();
    if (pErr || !prof?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    const { data, error } = await supabase
      .from('cuts')
      .insert({
        org_id: prof.org_id,
        cut_date: cut_date || undefined,
        cut_name,
        note: note || null,
        cutter_employee_id,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const { redirect } = await import('next/navigation');
    redirect(`/app/cuts/${data.id}`);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Крой — создать ID</h1>
        <BackButton />
      </div>

      <form action={createCut} className="border rounded-lg p-4 grid gap-3 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm">Дата кроя</span>
          <input type="date" name="cut_date" className="border rounded px-3 py-2" defaultValue={todayStr} required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Название кроя (например 1, 2) *</span>
          <input name="cut_name" className="border rounded px-3 py-2" required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Сотрудник (закройщик) *</span>
          <select name="cutter_employee_id" className="border rounded px-3 py-2" required defaultValue="">
            <option value="" disabled>Выбери…</option>
            {(cutters || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Примечание</span>
          <input name="note" className="border rounded px-3 py-2" />
        </label>

        <button className="rounded bg-black text-white py-2 w-fit px-4">Создать</button>
      </form>
    </main>
  );
}
