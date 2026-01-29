import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Страница «починки» профиля: создаёт организацию и профиль с role=admin,
 * если у пользователя их нет. Затем редирект на главную или на next.
 */
export default async function FixProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const sp = await searchParams;
  const nextUrl = sp.next && sp.next.startsWith('/app') ? sp.next : '/app';

  const { data: result } = await supabase.rpc('ensure_my_profile');
  const ok = result && typeof result === 'object' && (result as { ok?: boolean }).ok;

  if (ok) redirect(nextUrl);

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-xl font-semibold mb-2">Настройка профиля</h1>
      <p className="text-sm text-muted mb-4">
        Не удалось создать организацию автоматически. Ошибка: {(result as any)?.error ?? 'неизвестно'}.
      </p>
      <a href="/app" className="text-sm text-primary hover:underline">
        Вернуться на главную
      </a>
    </main>
  );
}
