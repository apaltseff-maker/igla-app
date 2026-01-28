import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  // Создаём шаблон Excel для сотрудников
  const templateData = [
    ['Код', 'ФИО', 'Роль'],
    ['12', 'Иванов Иван Иванович', 'sewer'],
    ['13', 'Петрова Мария Сергеевна', 'cutter'],
    ['14', 'Сидоров Алексей Петрович', 'packer'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Сотрудники');

  // Генерируем Excel файл
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template_employees.xlsx"',
    },
  });
}
