import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: result, error: rpcError } = await supabase.rpc('ensure_my_profile');

  if (rpcError) {
    console.error('[profile/ensure] RPC error:', rpcError);
    return NextResponse.json(
      { error: rpcError.message || 'ensure_my_profile не найден. Примените миграцию 20250129_ensure_my_profile_rpc.sql' },
      { status: 500 }
    );
  }

  const ok = result && typeof result === 'object' && (result as { ok?: boolean }).ok;
  if (!ok) {
    const errMsg = (result as { error?: string })?.error ?? 'Не удалось создать профиль';
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
