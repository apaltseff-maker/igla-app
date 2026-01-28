'use client';

import { useState, useMemo, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initError, setInitError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for registered, confirmed, password_reset params
  const registeredParam = searchParams.get('registered');
  const confirmedParam = searchParams.get('confirmed');
  const passwordResetParam = searchParams.get('password_reset');
  const [confirmed, setConfirmed] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  
  if (registeredParam === 'true' && !registered) {
    setRegistered(true);
  }
  
  if (confirmedParam === 'true' && !confirmed) {
    setConfirmed(true);
  }
  
  if (passwordResetParam === 'true' && !passwordReset) {
    setPasswordReset(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase client не инициализирован. Проверьте переменные окружения.');
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/app');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Вход</h1>

        <label className="block space-y-1">
          <div className="text-sm">Email</div>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <div className="text-sm">Пароль</div>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {registered && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
            Регистрация успешна! Проверьте email для подтверждения (если требуется) и войдите.
          </div>
        )}

        {confirmed && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
            Email подтверждён! Теперь вы можете войти.
          </div>
        )}

        {passwordReset && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
            Пароль успешно изменён! Войдите с новым паролем.
          </div>
        )}

        {initError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <strong>Ошибка инициализации:</strong> {initError}
            <div className="mt-2 text-xs">
              Проверьте, что в Vercel добавлены переменные окружения и проект пересобран (Redeploy).
            </div>
          </div>
        )}
        {error && !initError && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Входим…' : 'Войти'}
        </button>

        <div className="text-center text-sm text-gray-600">
          Нет аккаунта?{' '}
          <Link href="/signup" className="text-black underline">
            Зарегистрироваться
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm border rounded-lg p-6">
          <div className="text-center">Загрузка...</div>
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}

