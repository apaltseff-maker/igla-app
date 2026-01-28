import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { cut_id, product_id, color, size, qty } = body as {
    cut_id: string;
    product_id: string;
    color?: string;
    size?: string;
    qty: number;
  };

  if (!cut_id || !product_id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: 'qty_invalid' }, { status: 400 });

  const { data: prof } = await supabase.from('profiles').select('org_id').single();
  if (!prof?.org_id) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  // cut_date и cutter_employee_id из cuts
  const { data: cut } = await supabase
    .from('cuts')
    .select('cut_date, cutter_employee_id')
    .eq('id', cut_id)
    .single();
  if (!cut?.cut_date) return NextResponse.json({ error: 'cut_not_found' }, { status: 400 });

  // product.display для cut_name (артикул)
  const { data: product } = await supabase
    .from('products')
    .select('display')
    .eq('id', product_id)
    .single();
  const cut_name = product?.display || null;

  // генерим уникальный номер пачки в рамках org
  let bundle_no: string | null = null;
  for (let t = 0; t < 60; t++) {
    const cand = String(randInt(10, 99999));
    const { data: exists } = await supabase
      .from('cut_bundles')
      .select('id')
      .eq('org_id', prof.org_id)
      .eq('bundle_no', cand)
      .maybeSingle();
    if (!exists) { bundle_no = cand; break; }
  }
  if (!bundle_no) return NextResponse.json({ error: 'bundle_no_failed' }, { status: 400 });

  // 1) создаём пачку (с заполненными cut_name/color/size/cutter)
  const { data: bundle, error: bErr } = await supabase
    .from('cut_bundles')
    .insert({
      org_id: prof.org_id,
      cut_id,
      bundle_no,
      cut_date: cut.cut_date,
      cutter_employee_id: cut.cutter_employee_id || null,
      product_id,
      cut_name,
      color: color || null,
      size: size || null,
      qty_total: qty,
      is_mixed: false,
    })
    .select('id')
    .single();

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 });

  // 2) создаём позицию
  const { data: item, error: iErr } = await supabase
    .from('cut_items')
    .insert({
      org_id: prof.org_id,
      cut_id,
      product_id,
      color: color || null,
      size: size || null,
      qty,
      waste_qty: 0,
      bundle_id: bundle.id,
    })
    .select('id')
    .single();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });

  // 3) связываем состав пачки
  const { error: biErr } = await supabase.from('bundle_items').insert({
    org_id: prof.org_id,
    bundle_id: bundle.id,
    cut_item_id: item.id,
    qty,
  });

  if (biErr) return NextResponse.json({ error: biErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, item_id: item.id, bundle_no });
}
