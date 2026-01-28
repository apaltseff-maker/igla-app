import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    console.log("PDF_ROUTE_HIT", req.url);

    const { searchParams } = new URL(req.url);
    const invoice_id = searchParams.get("invoice_id");
    
    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
    }

    console.log("PDF_IMPORTING_RENDERER");
    const { renderInvoicePdf } = await import("@/lib/pdf/render-invoice");

    console.log("PDF_RENDERING", invoice_id);
    const pdfResult = await renderInvoicePdf(invoice_id);

    let pdfBytes: Uint8Array;

    if (pdfResult instanceof Uint8Array) {
      pdfBytes = pdfResult;
    } else if (pdfResult instanceof ArrayBuffer) {
      pdfBytes = new Uint8Array(pdfResult);
    } else {
      // ReadableStream -> ArrayBuffer -> Uint8Array
      const ab = await new Response(pdfResult as ReadableStream).arrayBuffer();
      pdfBytes = new Uint8Array(ab);
    }

    console.log("PDF_SUCCESS", pdfBytes.length, "bytes");

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice_${invoice_id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("PDF_ERROR:", e);
    return NextResponse.json(
      { error: String(e?.message ?? e), stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
