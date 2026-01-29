import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExcelUploadClient from './excel-upload-client';
import { EnsureProfileBlock } from '../_components/ensure-profile-block';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Админ',
  cutter: 'Закрой',
  packer: 'Упаковка',
  sewer: 'Швея',
};

export default async function EmployeesPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || !profile.org_id) {
    return (
      <EnsureProfileBlock
        title="Сотрудники"
        description="Чтобы открыть справочник, нужно создать организацию для вашего аккаунта."
      />
    );
  }

  const role = (profile.role ?? '').toString().toLowerCase();
  if (role && role !== 'admin') redirect('/app');

  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, code, full_name, role, active, created_at')
    .eq('org_id', profile.org_id)
    .order('role', { ascending: true })
    .order('code', { ascending: true });

  async function addEmployee(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const code = String(formData.get('code') || '').trim();
    const full_name = String(formData.get('full_name') || '').trim();
    const role = String(formData.get('role') || '').trim();

    if (!code || !full_name || !role) return;

    // 1) берём org_id из профиля текущего пользователя
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Не авторизован');
    
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.user.id)
      .single();

    if (pErr || !profile?.org_id) {
      throw new Error(pErr?.message || 'Не найден org_id в profiles');
    }

    // 2) вставляем сотрудника с org_id
    const { error } = await supabase.from('employees').insert({
      org_id: profile.org_id,
      code,
      full_name,
      role,
      active: true,
    });

    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath('/app/employees');
    redirect('/app/employees');
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Сотрудники</h1>
        <div className="flex items-center gap-3">
          <ExcelUploadClient />
          <a className="text-sm underline" href="/app">Назад</a>
        </div>
      </div>

      <form action={addEmployee} className="border rounded-lg p-4 grid gap-3 max-w-xl">
        <div className="font-medium">Добавить сотрудника</div>

        <label className="grid gap-1">
          <span className="text-sm">Код (№)</span>
          <input name="code" className="border rounded px-3 py-2" required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">ФИО</span>
          <input name="full_name" className="border rounded px-3 py-2" required />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Роль</span>
          <select name="role" className="border rounded px-3 py-2" required defaultValue="sewer">
            <option value="cutter">Закрой</option>
            <option value="packer">Упаковка</option>
            <option value="sewer">Швея</option>
            <option value="admin">Админ</option>
          </select>
        </label>

        <button className="rounded bg-black text-white py-2 w-fit px-4">Добавить</button>
      </form>

      <section className="space-y-2">
        <div className="font-medium">Список</div>
        {error && <div className="text-sm text-red-600">{error.message}</div>}

        <div className="overflow-auto border rounded-lg">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Код</th>
                <th className="text-left p-2">ФИО</th>
                <th className="text-left p-2">Роль</th>
                <th className="text-left p-2">Активен</th>
              </tr>
            </thead>
            <tbody>
              {(employees || []).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{e.code}</td>
                  <td className="p-2">{e.full_name}</td>
                  <td className="p-2">{ROLE_LABEL[e.role] ?? e.role}</td>
                  <td className="p-2">{e.active ? 'Да' : 'Нет'}</td>
                </tr>
              ))}
              {employees?.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={4}>Пока пусто</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
