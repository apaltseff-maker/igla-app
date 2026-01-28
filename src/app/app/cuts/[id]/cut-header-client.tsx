"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRUDate } from "@/lib/format";

export default function CutHeaderClient({
  cut_id,
  cut_date,
  cut_name,
  cutter_employee_id,
  note,
  employees,
}: {
  cut_id: string;
  cut_date: string | null;
  cut_name: string;
  cutter_employee_id: string; // может прийти пустым, мы подстрахуем
  note: string | null;
  employees: { id: string; full_name: string }[];
}) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(cut_name ?? "");
  const [cutterId, setCutterId] = useState(cutter_employee_id ?? "");
  const [n, setN] = useState(note ?? "");

  // если вдруг cutter_employee_id пустой — выберем первого доступного
  useEffect(() => {
    if (!cutterId && employees?.length) {
      setCutterId(employees[0].id);
    }
  }, [cutterId, employees]);

  async function save() {
    if (!name.trim()) {
      alert("Название (модель) не может быть пустым");
      return;
    }
    if (!cutterId) {
      alert("Выберите закройщика");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/cuts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cut_id,
          cut_name: name,
          cutter_employee_id: cutterId,
          note: n,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body?.error || `Ошибка сохранения (status ${res.status})`);
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const cutterName =
    employees.find((e) => e.id === cutter_employee_id)?.full_name ?? "";

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-gray-600">ID кроя</div>
          <div className="text-lg font-semibold">{cut_name}</div>
          <div className="text-sm text-gray-600">
            {cut_date ? `Дата: ${formatRUDate(cut_date)}` : ""}
            {cutterName ? ` • Закройщик: ${cutterName}` : ""}
          </div>
        </div>

        <button
          className="text-sm underline disabled:opacity-50"
          onClick={() => setEditing((v) => !v)}
          disabled={saving}
        >
          {editing ? "Отмена" : "Редактировать"}
        </button>
      </div>

      {editing && (
        <div className="grid gap-2 max-w-3xl">
          <label className="grid gap-1">
            <span className="text-sm">Название (модель)</span>
            <input
              className="border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Закройщик</span>
            <select
              className="border rounded px-3 py-2"
              value={cutterId}
              onChange={(e) => setCutterId(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Примечание</span>
            <input
              className="border rounded px-3 py-2"
              value={n}
              onChange={(e) => setN(e.target.value)}
            />
          </label>

          <button
            className="rounded bg-black text-white py-2 px-4 w-fit disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      )}
    </div>
  );
}
