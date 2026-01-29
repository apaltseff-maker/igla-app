import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExcelUploadClient from './excel-upload-client';
import EmployeesTableClient from './employees-table-client';
import { EnsureProfileBlock } from '../_components/ensure-profile-block';

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

  async function updateEmployee(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const id = String(formData.get('id') || '').trim();
    const code = String(formData.get('code') || '').trim();
    const full_name = String(formData.get('full_name') || '').trim();
    if (!id || !code || !full_name) throw new Error('Нужны id, код и ФИО');

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Не авторизован');
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.user.id)
      .single();
    if (pErr || !profile?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    const { error } = await supabase
      .from('employees')
      .update({ code, full_name })
      .eq('id', id)
      .eq('org_id', profile.org_id);
    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/app/employees');
  }

  async function deactivateEmployee(employeeId: string) {
    'use server';
    const supabase = await createClient();
    if (!employeeId) throw new Error('Нужен id сотрудника');

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Не авторизован');
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.user.id)
      .single();
    if (pErr || !profile?.org_id) throw new Error(pErr?.message || 'Нет org_id');

    const { error } = await supabase
      .from('employees')
      .update({ active: false })
      .eq('id', employeeId)
      .eq('org_id', profile.org_id);
    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/app/employees');
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
        <div className="font-medium">Список (можно менять номер и ФИО; удаление — снятие с учёта, в ведомости по ЗП остаётся)</div>
        {error && <div className="text-sm text-red-600">{error.message}</div>}

        <EmployeesTableClient
          employees={(employees || []) as { id: string; code: string; full_name: string; role: string; active: boolean | null }[]}
          updateEmployee={updateEmployee}
          deactivateEmployee={deactivateEmployee}
        />
      </section>
    </main>
  );
}
