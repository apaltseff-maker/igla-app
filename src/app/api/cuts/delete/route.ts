import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { cut_id } = (await req.json()) as { cut_id: string };
  if (!cut_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Проверяем, есть ли движение по пачкам этого кроя
  // 1) Получаем все bundle_id этого кроя
  const { data: bundles, error: bundlesErr } = await supabase
    .from('cut_bundles')
    .select('id')
    .eq('cut_id', cut_id);

  if (bundlesErr) return NextResponse.json({ error: bundlesErr.message }, { status: 400 });

  const bundleIds = (bundles || []).map((b) => b.id);

  if (bundleIds.length > 0) {
    // 2) Проверяем выдачи швеям
    const { data: assignments } = await supabase
      .from('sewing_assignments')
      .select('id')
      .in('bundle_id', bundleIds)
      .limit(1);

    if (assignments && assignments.length > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить крой: есть выдачи швеям' },
        { status: 409 }
      );
    }

    // 3) Проверяем упаковку
    const { data: packaging } = await supabase
      .from('packaging_events')
      .select('id')
      .in('bundle_id', bundleIds)
      .limit(1);

    if (packaging && packaging.length > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить крой: есть записи упаковки' },
        { status: 409 }
      );
    }
  }

  // 4) Удаляем bundle_items
  if (bundleIds.length > 0) {
    const { error: biErr } = await supabase
      .from('bundle_items')
      .delete()
      .in('bundle_id', bundleIds);
    if (biErr) return NextResponse.json({ error: biErr.message }, { status: 400 });
  }

  // 5) Удаляем cut_bundles
  const { error: cbErr } = await supabase
    .from('cut_bundles')
    .delete()
    .eq('cut_id', cut_id);
  if (cbErr) return NextResponse.json({ error: cbErr.message }, { status: 400 });

  // 6) Удаляем cut_items
  const { error: ciErr } = await supabase
    .from('cut_items')
    .delete()
    .eq('cut_id', cut_id);
  if (ciErr) return NextResponse.json({ error: ciErr.message }, { status: 400 });

  // 7) Удаляем сам крой
  const { error: cutErr } = await supabase
    .from('cuts')
    .delete()
    .eq('id', cut_id);
  if (cutErr) return NextResponse.json({ error: cutErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
