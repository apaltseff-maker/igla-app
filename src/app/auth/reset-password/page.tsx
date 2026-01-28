'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [initError, setInitError] = useState<string | null>(null);
  
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create Supabase client:', error);
      setInitError(errorMessage);
      return null;
    }
  }, []);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase client не инициализирован.');
      return;
    }

    // Валидация
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);
    setError(null);

    // Обновление пароля
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    // Перенаправление на логин через 2 секунды
    setTimeout(() => {
      router.push('/login?password_reset=true');
    }, 2000);
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
          <div className="text-green-600 font-semibold">
            Пароль успешно изменён!
          </div>
          <div className="text-sm text-gray-600">
            Перенаправление на страницу входа...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Сброс пароля</h1>

        {initError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <strong>Ошибка инициализации:</strong> {initError}
          </div>
        )}

        <label className="block space-y-1">
          <div className="text-sm">Новый пароль</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <div className="text-xs text-gray-500 mt-1">
            Минимум 6 символов
          </div>
        </label>

        <label className="block space-y-1">
          <div className="text-sm">Подтвердите пароль</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        {error && !initError && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>

        <div className="text-center text-sm text-gray-600">
          <Link href="/login" className="text-black underline">
            Вернуться к входу
          </Link>
        </div>
      </form>
    </main>
  );
}
