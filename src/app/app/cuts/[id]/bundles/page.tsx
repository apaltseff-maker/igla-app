import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/BackButton';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default async function CutBundlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cutId = id;

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: cut, error: cutErr } = await supabase
    .from('cuts')
    .select('id, cut_date, cut_name')
    .eq('id', cutId)
    .single();
  if (cutErr) throw new Error(cutErr.message);

  const { data: items } = await supabase
    .from('cut_items')
    .select('id, qty, color, size, products(display)')
    .eq('cut_id', cutId)
    .order('created_at', { ascending: true });

  // existing bundles for this cut with bundle_items info
  const { data: bundles } = await supabase
    .from('cut_bundles')
    .select('id, bundle_no, qty_total, created_at, bundle_items(qty, cut_items(color, size, products(display)))')
    .eq('cut_id', cutId)
    .order('created_at', { ascending: true });

  async function generateBundles() {
    'use server';
    const supabase = await createClient();

    const { data: prof } = await supabase.from('profiles').select('org_id').single();
    if (!prof?.org_id) throw new Error('Нет org_id');

    // pull items again on server
    const { data: items, error: itemsErr } = await supabase
      .from('cut_items')
      .select('id, qty')
      .eq('cut_id', cutId);

    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) throw new Error('Нет позиций кроя');

    // check which items already have bundles (via bundle_items)
    const { data: existing } = await supabase
      .from('bundle_items')
      .select('cut_item_id, cut_bundles(id)')
      .in('cut_item_id', items.map((x) => x.id));

    const already = new Set<string>((existing || []).map((x: any) => x.cut_item_id));

    for (const it of items as any[]) {
      if (already.has(it.id)) continue; // don't duplicate

      // generate unique bundle_no
      let bundle_no: string | null = null;
      for (let t = 0; t < 40; t++) {
        const cand = String(randInt(10, 99999));
        const { data: exists } = await supabase
          .from('cut_bundles')
          .select('id')
          .eq('org_id', prof.org_id)
          .eq('bundle_no', cand)
          .maybeSingle();

        if (!exists) {
          bundle_no = cand;
          break;
        }
      }
      if (!bundle_no) throw new Error('Не смогли подобрать уникальный номер пачки');

      // create bundle
      const { data: b, error: bErr } = await supabase
        .from('cut_bundles')
        .insert({
          org_id: prof.org_id,
          bundle_no,
          cut_id: cutId,
          qty_total: it.qty,
          product_id: (await supabase.from('cut_items').select('product_id').eq('id', it.id).single()).data?.product_id,
          cut_date: (await supabase.from('cuts').select('cut_date').eq('id', cutId).single()).data?.cut_date,
          is_mixed: false,
        })
        .select('id')
        .single();

      if (bErr) throw new Error(bErr.message);

      // link bundle to item
      const { error: biErr } = await supabase.from('bundle_items').insert({
        org_id: prof.org_id,
        bundle_id: b.id,
        cut_item_id: it.id,
        qty: it.qty,
      });

      if (biErr) throw new Error(biErr.message);
    }

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath(`/app/cuts/${cutId}/bundles`);
    redirect(`/app/cuts/${cutId}/bundles`);
  }

  async function updateBundleQty(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const bundle_id = String(formData.get('bundle_id') || '').trim();
    const qty_total = Number(String(formData.get('qty_total') || '').trim());

    if (!bundle_id) return;
    if (!Number.isFinite(qty_total) || qty_total <= 0) throw new Error('Кол-во должно быть > 0');

    // запрет, если есть выдача или упаковка
    const { data: a } = await supabase.from('sewing_assignments').select('id').eq('bundle_id', bundle_id).limit(1);
    if (a && a.length > 0) throw new Error('Нельзя менять пачку: уже была выдача швее');

    const { data: p } = await supabase.from('packaging_events').select('id').eq('bundle_id', bundle_id).limit(1);
    if (p && p.length > 0) throw new Error('Нельзя менять пачку: уже была упаковка');

    // обновим qty_total
    const { error: bErr } = await supabase.from('cut_bundles').update({ qty_total }).eq('id', bundle_id);
    if (bErr) throw new Error(bErr.message);

    // и qty в bundle_items (у нас для обычных пачек 1 строка)
    const { data: bi } = await supabase.from('bundle_items').select('id').eq('bundle_id', bundle_id);
    if (bi && bi.length === 1) {
      const { error: biErr } = await supabase.from('bundle_items').update({ qty: qty_total }).eq('id', bi[0].id);
      if (biErr) throw new Error(biErr.message);
    } else {
      throw new Error('Пачка смешанная или повреждена: нельзя автоматически поменять количество');
    }

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath(`/app/cuts/${cutId}/bundles`);
    redirect(`/app/cuts/${cutId}/bundles`);
  }

  async function deleteBundle(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const bundle_id = String(formData.get('bundle_id') || '').trim();
    if (!bundle_id) return;

    const { data: a } = await supabase.from('sewing_assignments').select('id').eq('bundle_id', bundle_id).limit(1);
    if (a && a.length > 0) throw new Error('Нельзя удалить пачку: уже была выдача швее');

    const { data: p } = await supabase.from('packaging_events').select('id').eq('bundle_id', bundle_id).limit(1);
    if (p && p.length > 0) throw new Error('Нельзя удалить пачку: уже была упаковка');

    // удаляем bundle_items сначала
    const { error: biDelErr } = await supabase.from('bundle_items').delete().eq('bundle_id', bundle_id);
    if (biDelErr) throw new Error(biDelErr.message);

    // удаляем пачку
    const { error } = await supabase.from('cut_bundles').delete().eq('id', bundle_id);
    if (error) throw new Error(error.message);

    const { revalidatePath } = await import('next/cache');
    const { redirect } = await import('next/navigation');
    revalidatePath(`/app/cuts/${cutId}/bundles`);
    redirect(`/app/cuts/${cutId}/bundles`);
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Пачки кроя</h1>
          <div className="text-sm text-gray-600">
            Крой: {cut.cut_date} {cut.cut_name ? `• ${cut.cut_name}` : ''}
          </div>
        </div>
        <div className="flex gap-3">
          <a className="text-sm underline" href={`/app/cuts/${cutId}`}>Позиции</a>
          <BackButton />
        </div>
      </div>

      <form action={generateBundles}>
        <button className="rounded bg-black text-white py-2 px-4">
          Сгенерировать пачки (по позициям)
        </button>
      </form>

      <section className="space-y-2">
        <div className="font-medium">Список пачек</div>
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">№</th>
                <th className="text-left p-2">Строка</th>
                <th className="text-left p-2">Кол-во</th>
                <th className="text-left p-2">Печать</th>
                <th className="text-left p-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {(bundles || []).map((b: any) => {
                const bi = (b.bundle_items || [])[0];
                const model = bi?.cut_items?.products?.display ?? '';
                const color = bi?.cut_items?.color ?? '';
                const size = bi?.cut_items?.size ?? '';
                const line2 = [model, color, size].filter(Boolean).join('/');

                return (
                  <tr key={b.id} className="border-t align-top">
                    <td className="p-2 font-semibold">{b.bundle_no}</td>
                    <td className="p-2">{line2}</td>
                    <td className="p-2">{b.qty_total}</td>
                    <td className="p-2">
                      <a className="underline" href={`/print/30x20?bundle=${encodeURIComponent(b.bundle_no)}`} target="_blank">
                        30×20
                      </a>
                    </td>
                    <td className="p-2">
                      <details className="inline-block">
                        <summary className="cursor-pointer underline text-sm">Правка</summary>
                        <div className="mt-2 border rounded p-3 bg-white w-[300px] grid gap-2">
                          <form action={updateBundleQty} className="grid gap-2">
                            <input type="hidden" name="bundle_id" value={b.id} />
                            <label className="grid gap-1">
                              <span className="text-xs">Кол-во в пачке</span>
                              <input name="qty_total" className="border rounded px-2 py-1" defaultValue={b.qty_total} inputMode="numeric" />
                            </label>
                            <button className="rounded bg-black text-white py-1.5">Сохранить</button>
                          </form>

                          <form action={deleteBundle}>
                            <input type="hidden" name="bundle_id" value={b.id} />
                            <button className="rounded border py-1.5 w-full">Удалить пачку</button>
                          </form>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {(!bundles || bundles.length === 0) && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={5}>Пачек пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="font-medium">Позиции (для контроля)</div>
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-[820px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Модель</th>
                <th className="text-left p-2">Цвет</th>
                <th className="text-left p-2">Размер</th>
                <th className="text-left p-2">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.products?.display ?? ''}</td>
                  <td className="p-2">{it.color ?? ''}</td>
                  <td className="p-2">{it.size ?? ''}</td>
                  <td className="p-2">{it.qty}</td>
                </tr>
              ))}
              {(!items || items.length === 0) && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={4}>Нет позиций</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
