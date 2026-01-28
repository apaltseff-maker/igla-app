'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase client не инициализирован.');
      return;
    }

    setLoading(true);
    setError(null);

    // Get the redirect URL
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback';

    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
          <div className="text-green-600 font-semibold">
            Письмо отправлено!
          </div>
          <div className="text-sm text-gray-600">
            Проверьте почту {email} и перейдите по ссылке для сброса пароля.
          </div>
          <Link href="/login" className="text-black underline text-sm">
            Вернуться к входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Восстановление пароля</h1>

        {initError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
            <strong>Ошибка инициализации:</strong> {initError}
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
          <div className="text-xs text-gray-500 mt-1">
            На этот email будет отправлена ссылка для сброса пароля
          </div>
        </label>

        {error && !initError && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Отправляем…' : 'Отправить ссылку'}
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
