import { NextResponse } from "next/server";

// Публичный endpoint, без авторизации
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  // Вызываем backend API
  const backendUrl = process.env.BACKEND_URL || "https://clothing-crm-nx4v.onrender.com";
  
  try {
    const res = await fetch(`${backendUrl}/api/ui/finance/daily?date_from=${from}&date_to=${to}`, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    
    if (!res.ok) {
      throw new Error(`Backend API error: ${res.status}`);
    }
    
    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { 
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
        rows: [],
        stats: null,
      },
      { status: 500 }
    );
  }
}
