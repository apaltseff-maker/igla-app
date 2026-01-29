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

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', userData.user.id)
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
    const employees = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;

      const code = String(row[0] || '').trim();
      const full_name = String(row[1] || '').trim();
      const roleRaw = String(row[2] || '').trim().toLowerCase();

      if (!code || !full_name || !roleRaw) {
        errors.push(`Строка ${i + 1}: пропущены обязательные поля`);
        continue;
      }

      const validRoles = ['admin', 'cutter', 'packer', 'sewer'];
      const roleMap: Record<string, string> = {
        швея: 'sewer',
        закройщик: 'cutter',
        закрой: 'cutter',
        упаковщик: 'packer',
        упакавщик: 'packer',
        админ: 'admin',
        администратор: 'admin',
        конструктор: 'cutter',
        технолог: 'cutter',
        'конструктор/технолог': 'cutter',
        утюжница: 'packer',
      };
      const role = roleMap[roleRaw] || (validRoles.includes(roleRaw) ? roleRaw : '');

      if (!role) {
        errors.push(`Строка ${i + 1}: неверная роль "${roleRaw}" (допустимо: ${validRoles.join(', ')} или: швея, закройщик, упаковщик, админ)`);
        continue;
      }

      employees.push({
        org_id: profile.org_id,
        code,
        full_name,
        role,
        active: true,
      });
    }

    // Убираем дубликаты по code (в одном файле не должно быть двух строк с одним кодом)
    const byCode = new Map<string, { org_id: string; code: string; full_name: string; role: string; active: boolean }>();
    for (const e of employees) {
      byCode.set(e.code, e);
    }
    const uniqueEmployees = Array.from(byCode.values());

    if (uniqueEmployees.length === 0) {
      return NextResponse.json({ 
        error: 'Нет валидных данных для загрузки',
        details: errors 
      }, { status: 400 });
    }

    // Upsert: при совпадении (org_id, code) обновляем ФИО/роль/активность
    const { data: inserted, error: insertError } = await supabase
      .from('employees')
      .upsert(uniqueEmployees, { onConflict: 'org_id,code', ignoreDuplicates: false })
      .select();

    if (insertError) {
      return NextResponse.json({ 
        error: insertError.message,
        details: errors.length > 0 ? errors : undefined
      }, { status: 400 });
    }

    const dupCount = employees.length - uniqueEmployees.length;
    if (dupCount > 0) {
      errors.push(`В файле ${dupCount} дублей по коду — учтена последняя строка по каждому коду.`);
    }
    return NextResponse.json({
      success: true,
      imported: inserted?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error uploading employees:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
