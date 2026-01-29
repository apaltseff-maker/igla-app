'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Админ',
  cutter: 'Закрой',
  packer: 'Упаковка',
  sewer: 'Швея',
};

type Employee = {
  id: string;
  code: string;
  full_name: string;
  role: string;
  active: boolean | null;
};

type Props = {
  employees: Employee[];
  updateEmployee: (formData: FormData) => Promise<void>;
  deactivateEmployee: (employeeId: string) => Promise<void>;
};

export default function EmployeesTableClient({
  employees,
  updateEmployee,
  deactivateEmployee,
}: Props) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('id', id);
    setSavingId(id);
    try {
      await updateEmployee(formData);
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Снять сотрудника с учёта (неактивен)? В ведомостях по ЗП он останется.')) return;
    setDeletingId(id);
    try {
      await deactivateEmployee(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="overflow-auto border rounded-lg">
      <table className="min-w-[800px] w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Код</th>
            <th className="text-left p-2">ФИО</th>
            <th className="text-left p-2">Роль</th>
            <th className="text-left p-2">Активен</th>
            <th className="text-left p-2 w-[160px]">Действия</th>
          </tr>
        </thead>
        <tbody>
          {(employees || []).map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-2">
                <form
                  id={`row-${e.id}`}
                  onSubmit={(ev) => handleSave(ev, e.id)}
                  className="inline"
                >
                  <input type="hidden" name="id" value={e.id} />
                  <input
                    name="code"
                    className="border rounded px-2 py-1 w-20"
                    defaultValue={e.code}
                    required
                  />
                </form>
              </td>
              <td className="p-2">
                <input
                  form={`row-${e.id}`}
                  name="full_name"
                  className="border rounded px-2 py-1 w-full min-w-[140px]"
                  defaultValue={e.full_name}
                  required
                />
              </td>
              <td className="p-2 whitespace-nowrap">{ROLE_LABEL[e.role] ?? e.role}</td>
              <td className="p-2">{e.active ? 'Да' : 'Нет'}</td>
              <td className="p-2 flex gap-2">
                <button
                  type="submit"
                  form={`row-${e.id}`}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                  disabled={savingId === e.id}
                >
                  {savingId === e.id ? '…' : 'Сохранить'}
                </button>
                {e.active && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    disabled={deletingId !== null}
                    onClick={() => handleDelete(e.id)}
                  >
                    {deletingId === e.id ? '…' : 'Удалить'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {employees?.length === 0 && (
            <tr>
              <td className="p-2 text-gray-500" colSpan={5}>
                Пока пусто
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
