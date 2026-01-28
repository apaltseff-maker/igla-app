import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const q = (body?.q ?? "").toString().trim();

  if (!q) return NextResponse.json({ suggestions: [] });

  const token = process.env.DADATA_TOKEN;
  const secret = process.env.DADATA_SECRET;

  if (!token) return NextResponse.json({ error: "DADATA_TOKEN is missing" }, { status: 500 });

  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party", {
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

  // Возвращаем упрощённо: inn + name + raw
  const suggestions =
    (data?.suggestions ?? []).map((s: any) => ({
      value: s?.value ?? "",
      inn: s?.data?.inn ?? "",
      kpp: s?.data?.kpp ?? "",
      ogrn: s?.data?.ogrn ?? "",
      name: s?.data?.name?.short_with_opf ?? s?.data?.name?.full_with_opf ?? s?.value ?? "",
      address: s?.data?.address?.value ?? "",
      raw: s,
    })) ?? [];

  return NextResponse.json({ suggestions });
}
