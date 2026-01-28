'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase client не инициализирован. Проверьте переменные окружения.');
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

    // Регистрация с метаданными организации
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          org_name: orgName || 'Новое производство',
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      // Успешная регистрация - редирект на логин с сообщением
      router.push('/login?registered=true');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Регистрация</h1>

        {initError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <strong>Ошибка инициализации:</strong> {initError}
            <div className="mt-2 text-xs">
              Проверьте, что в Vercel добавлены переменные окружения и проект пересобран (Redeploy).
            </div>
          </div>
        )}

        <label className="block space-y-1">
          <div className="text-sm">Email</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm">Название организации (опционально)</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Новое производство"
          />
          <div className="text-xs text-gray-500 mt-1">
            Если не указано, будет использовано "Новое производство"
          </div>
        </label>

        <label className="block space-y-1">
          <div className="text-sm">Пароль</div>
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
          {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
        </button>

        <div className="text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-black underline">
            Войти
          </Link>
        </div>
      </form>
    </main>
  );
}
