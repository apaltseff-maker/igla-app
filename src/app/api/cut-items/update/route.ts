import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, patch } = body as { id: string; patch: Record<string, any> };

  if (!id || !patch) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // разрешаем менять только эти поля
  const allowed = ['color', 'size', 'qty', 'waste_qty', 'waste_reason'] as const;
  const safePatch: Record<string, any> = {};
  for (const k of allowed) if (k in patch) safePatch[k] = patch[k];

  // валидации
  if ('qty' in safePatch) {
    const q = Number(safePatch.qty);
    if (!Number.isFinite(q) || q <= 0) return NextResponse.json({ error: 'qty_invalid' }, { status: 400 });
    safePatch.qty = q;
  }
  if ('waste_qty' in safePatch) {
    const w = Number(safePatch.waste_qty);
    if (!Number.isFinite(w) || w < 0) return NextResponse.json({ error: 'waste_invalid' }, { status: 400 });
    safePatch.waste_qty = w;
  }

  const { error } = await supabase.from('cut_items').update(safePatch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
