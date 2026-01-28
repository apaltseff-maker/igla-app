import { createClient } from '@/lib/supabase/server';

export default async function Print30x20Page({
  searchParams,
}: {
  searchParams: Promise<{ bundle?: string }>;
}) {
  const { bundle } = await searchParams;
  const bundleNo = String(bundle || '').trim();

  if (!bundleNo) {
    return <div style={{ padding: 16 }}>Missing bundle</div>;
  }

  const supabase = await createClient();

  // Получаем пачку
  const { data: bundleRow } = await supabase
    .from('cut_bundles')
    .select('id, bundle_no, product_id, products(display)')
    .eq('bundle_no', bundleNo)
    .maybeSingle();

  // Получаем позицию (cut_items) связанную с пачкой для color/size
  let color = '';
  let size = '';
  
  if (bundleRow?.id) {
    const { data: itemRow } = await supabase
      .from('cut_items')
      .select('color, size')
      .eq('bundle_id', bundleRow.id)
      .maybeSingle();
    
    color = itemRow?.color ?? '';
    size = itemRow?.size ?? '';
  }

  const model = (bundleRow as any)?.products?.display ?? '';
  const line2 = [model, color, size].filter(Boolean).join('/');

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Label 30x20</title>
        <style>{`
          @page { size: 30mm 20mm; margin: 0; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .wrap { width: 30mm; height: 20mm; padding: 1mm; box-sizing: border-box; }
          .l1 { font-size: 12pt; font-weight: 700; line-height: 1.0; white-space: nowrap; }
          .l2 { font-size: 7pt; line-height: 1.05; margin-top: 1mm; overflow: hidden; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="l1">№ {bundleNo}</div>
          <div className="l2">{line2}</div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.onload = () => window.print();`,
          }}
        />
      </body>
    </html>
  );
}
