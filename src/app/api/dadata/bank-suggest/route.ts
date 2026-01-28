import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const q = (body?.q ?? "").toString().trim();

  if (!q) return NextResponse.json({ suggestions: [] });

  const token = process.env.DADATA_TOKEN;
  const secret = process.env.DADATA_SECRET;

  if (!token) return NextResponse.json({ error: "DADATA_TOKEN is missing" }, { status: 500 });

  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/bank", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Token ${token}`,
      ...(secret ? { "X-Secret": secret } : {}),
    },
    body: JSON.stringify({ query: q, count: 5 }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: data ?? "DaData error" }, { status: 500 });

  const suggestions =
    (data?.suggestions ?? []).map((s: any) => ({
      value: s?.value ?? "",
      bic: s?.data?.bic ?? "",
      name: s?.data?.name?.payment ?? s?.value ?? "",
      corr_account: s?.data?.correspondent_account ?? "",
      raw: s,
    })) ?? [];

  return NextResponse.json({ suggestions });
}
