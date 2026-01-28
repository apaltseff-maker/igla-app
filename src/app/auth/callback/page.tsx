'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();
      
      // Handle hash-based tokens from email links (#access_token=...)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type'); // 'recovery' or 'signup'

        if (accessToken && refreshToken) {
          try {
            // Set the session
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('Error setting session:', sessionError);
              setError(sessionError.message);
              setLoading(false);
              setTimeout(() => {
                router.push(`/login?error=${encodeURIComponent(sessionError.message)}`);
              }, 2000);
              return;
            }

            // Handle different types
            if (type === 'recovery') {
              // Password reset - redirect to password reset page
              router.push('/auth/reset-password');
              return;
            } else if (type === 'signup') {
              // Email confirmation - redirect to login with success message
              router.push('/login?confirmed=true');
              return;
            } else {
              // Generic success - redirect to app
              router.push('/app');
              return;
            }
          } catch (err) {
            console.error('Error in callback:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
            setTimeout(() => {
              router.push('/login?error=callback_failed');
            }, 2000);
            return;
          }
        }
      }

      // Handle code-based OAuth (if used)
      const code = searchParams.get('code');
      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Error exchanging code for session:', exchangeError);
            setError(exchangeError.message);
            setLoading(false);
            setTimeout(() => {
              router.push(`/login?error=${encodeURIComponent(exchangeError.message)}`);
            }, 2000);
            return;
          }

          const next = searchParams.get('next') || '/app';
          router.push(next);
          return;
        } catch (err) {
          console.error('Error exchanging code:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
          setTimeout(() => {
            router.push('/login?error=code_exchange_failed');
          }, 2000);
          return;
        }
      }

      // No valid token or code
      setError('Invalid callback - no token or code found');
      setLoading(false);
      setTimeout(() => {
        router.push('/login?error=invalid_callback');
      }, 2000);
    }

    handleCallback();
  }, [router, searchParams]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
          <div>Обработка...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded-lg p-6">
          <div className="text-red-600">Ошибка: {error}</div>
          <div className="text-sm text-gray-600">Перенаправление на страницу входа...</div>
        </div>
      </main>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 border rounded-lg p-6 text-center">
          <div>Загрузка...</div>
        </div>
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
