import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const inn = (body?.inn ?? "").toString().trim();

  if (!inn) return NextResponse.json({ error: "inn is required" }, { status: 400 });

  const token = process.env.DADATA_TOKEN;
  const secret = process.env.DADATA_SECRET;

  if (!token) return NextResponse.json({ error: "DADATA_TOKEN is missing" }, { status: 500 });

  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Token ${token}`,
      ...(secret ? { "X-Secret": secret } : {}),
    },
    body: JSON.stringify({ query: inn }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: data ?? "DaData error" }, { status: 500 });

  const s = data?.suggestions?.[0];
  if (!s) return NextResponse.json({ party: null });

  const party = {
    inn: s?.data?.inn ?? "",
    kpp: s?.data?.kpp ?? "",
    ogrn: s?.data?.ogrn ?? "",
    name: s?.data?.name?.short_with_opf ?? s?.data?.name?.full_with_opf ?? s?.value ?? "",
    address: s?.data?.address?.value ?? "",
    raw: s,
  };

  return NextResponse.json({ party });
}
