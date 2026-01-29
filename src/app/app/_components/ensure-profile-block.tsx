'use client';

import { useState } from 'react';

export function EnsureProfileBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/ensure', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || res.statusText || 'Ошибка');
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-2">{title}</h1>
      <p className="text-sm text-muted mb-4">{description}</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? 'Создаём…' : 'Создать организацию'}
      </button>
      {error && (
        <p className="text-sm text-red-600 mt-3">{error}</p>
      )}
      <p className="text-xs text-muted mt-4">
        Если не срабатывает, в Supabase SQL Editor выполните миграцию{' '}
        <code className="bg-muted px-1 rounded">20250129_ensure_my_profile_rpc.sql</code>.
      </p>
    </main>
  );
}
