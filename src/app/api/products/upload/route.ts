import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Получаем org_id
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('org_id, role')
      .single();

    if (profErr || !profile?.org_id) {
      return NextResponse.json({ error: 'profile/org not found' }, { status: 400 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Читаем файл
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (data.length < 2) {
      return NextResponse.json({ error: 'Файл пуст или неверный формат' }, { status: 400 });
    }

    // Пропускаем заголовок, обрабатываем данные
    const products = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 1) continue;

      // Колонки: [тип, название, расценка]. Обязательно только название. Тип берём как есть, пусто → "платье".
      const kindRaw = row.length >= 2 ? String(row[0] ?? '').trim() : '';
      const display = (row.length >= 2 ? String(row[1] ?? '').trim() : String(row[0] ?? '').trim());
      const baseRateRaw = row[2] ? String(row[2]).trim() : '';

      if (!display) {
        errors.push(`Строка ${i + 1}: пропущено обязательное поле (название)`);
        continue;
      }

      const kind = kindRaw || 'платье';

      const base_rate = baseRateRaw === '' || baseRateRaw === null || baseRateRaw === undefined
        ? null
        : Number(String(baseRateRaw).replace(',', '.'));

      if (base_rate !== null && (Number.isNaN(base_rate) || base_rate < 0)) {
        errors.push(`Строка ${i + 1}: неверная расценка "${baseRateRaw}"`);
        continue;
      }

      products.push({
        org_id: profile.org_id,
        kind,
        display,
        base_rate,
        active: true,
      });
    }

    if (products.length === 0) {
      return NextResponse.json({ 
        error: 'Нет валидных данных для загрузки',
        details: errors 
      }, { status: 400 });
    }

    // Дедупликация по (org_id, display): в файле могут быть повторы — один ключ = одна строка для upsert
    const seen = new Map<string, (typeof products)[0]>();
    for (const p of products) {
      seen.set(p.display, p);
    }
    const uniqueProducts = Array.from(seen.values());
    if (uniqueProducts.length < products.length) {
      errors.push(`В файле найдены дубликаты по названию — обработано уникальных: ${uniqueProducts.length} из ${products.length}`);
    }

    // Upsert по (org_id, display): обновляем существующие, добавляем новые
    const { data: inserted, error: insertError } = await supabase
      .from('products')
      .upsert(uniqueProducts, { onConflict: 'org_id,display', ignoreDuplicates: false })
      .select();

    if (insertError) {
      return NextResponse.json({ 
        error: insertError.message,
        details: errors.length > 0 ? errors : undefined
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      imported: inserted?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error uploading products:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
