import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  // Создаём шаблон Excel для моделей
  const templateData = [
    ['Тип изделия', 'Название модели', 'Расценка (руб/шт)'],
    ['футболка', 'Лекси', '120'],
    ['платье', 'Мэри', '250'],
    ['брюки', 'Классик', '180'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Модели');

  // Генерируем Excel файл
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template_products.xlsx"',
    },
  });
}
