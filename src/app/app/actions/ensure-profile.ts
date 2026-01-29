'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Создаёт организацию и профиль с role=admin для текущего пользователя, если их нет.
 * Затем редирект на указанный path.
 */
export async function ensureProfileAndRedirect(redirectTo: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: result, error: rpcError } = await supabase.rpc('ensure_my_profile');

  if (rpcError) {
    console.error('ensure_my_profile RPC error:', rpcError);
    throw new Error(rpcError.message || 'Функция ensure_my_profile не найдена. Примените миграцию 20250129_ensure_my_profile_rpc.sql в Supabase.');
  }

  const ok = result && typeof result === 'object' && (result as { ok?: boolean }).ok;
  if (!ok) {
    const errMsg = (result as { error?: string })?.error ?? 'Не удалось создать профиль';
    throw new Error(errMsg);
  }

  redirect(redirectTo.startsWith('/app') ? redirectTo : '/app');
}
