import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // найдём bundle_id
  const { data: item, error: itemErr } = await supabase
    .from('cut_items')
    .select('bundle_id')
    .eq('id', id)
    .single();

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 400 });

  const bundleId = item.bundle_id as string | null;

  if (bundleId) {
    const { data: a } = await supabase.from('sewing_assignments').select('id').eq('bundle_id', bundleId).limit(1);
    if (a && a.length > 0) return NextResponse.json({ error: 'has_assignments' }, { status: 400 });

    const { data: p } = await supabase.from('packaging_events').select('id').eq('bundle_id', bundleId).limit(1);
    if (p && p.length > 0) return NextResponse.json({ error: 'has_packaging' }, { status: 400 });
  }

  // удаляем позицию
  const { error: delErr } = await supabase.from('cut_items').delete().eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // если была пачка — удалим пачку (bundle_items каскадом)
  if (bundleId) {
    const { error: bErr } = await supabase.from('cut_bundles').delete().eq('id', bundleId);
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
