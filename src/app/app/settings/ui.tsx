"use client";

import { useMemo, useState } from "react";

type OrgSettings = {
  portal_name: string;
  legal_inn: string | null;
  legal_name: string | null;
  legal_kpp: string | null;
  legal_ogrn: string | null;
  legal_address: string | null;
  bank_name: string | null;
  bank_bik: string | null;
  bank_account: string | null;
  bank_corr_account: string | null;
  label_format: string;
};

type CounterpartyRow = { id: string; name: string; inn: string | null; active: boolean };

type PartySuggestion = {
  inn: string;
  name: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
};

type BankSuggestion = {
  bic: string;
  name: string;
  corr_account?: string;
};

function debounceSleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function SettingsClient({
  orgId,
  initialSettings,
  initialCounterparties,
}: {
  orgId: string;
  initialSettings: any | null;
  initialCounterparties: CounterpartyRow[];
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<OrgSettings>(() => ({
    portal_name: initialSettings?.portal_name ?? "",
    legal_inn: initialSettings?.legal_inn ?? null,
    legal_name: initialSettings?.legal_name ?? null,
    legal_kpp: initialSettings?.legal_kpp ?? null,
    legal_ogrn: initialSettings?.legal_ogrn ?? null,
    legal_address: initialSettings?.legal_address ?? null,
    bank_name: initialSettings?.bank_name ?? null,
    bank_bik: initialSettings?.bank_bik ?? null,
    bank_account: initialSettings?.bank_account ?? null,
    bank_corr_account: initialSettings?.bank_corr_account ?? null,
    label_format: initialSettings?.label_format ?? "30x20",
  }));

  // --- DaData party suggest ---
  const [innQuery, setInnQuery] = useState(settings.legal_inn ?? "");
  const [partySug, setPartySug] = useState<PartySuggestion[]>([]);
  const [partyOpen, setPartyOpen] = useState(false);

  // --- DaData bank suggest ---
  const [bikQuery, setBikQuery] = useState(settings.bank_bik ?? "");
  const [bankSug, setBankSug] = useState<BankSuggestion[]>([]);
  const [bankOpen, setBankOpen] = useState(false);

  // counterparties table
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>(initialCounterparties);
  const [cpName, setCpName] = useState("");
  const [cpInn, setCpInn] = useState("");
  const [cpSug, setCpSug] = useState<PartySuggestion[]>([]);
  const [cpOpen, setCpOpen] = useState(false);

  async function partySuggest(q: string, forCounterparty: boolean) {
    const res = await fetch("/api/dadata/party-suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q }),
    });
    const j = await res.json();
    const list = (j?.suggestions ?? []).map((s: any) => ({
      inn: s.inn,
      name: s.name,
      kpp: s.kpp,
      ogrn: s.ogrn,
      address: s.address,
    }));
    if (forCounterparty) setCpSug(list);
    else setPartySug(list);
  }

  async function bankSuggest(q: string) {
    const res = await fetch("/api/dadata/bank-suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q }),
    });
    const j = await res.json();
    setBankSug(
      (j?.suggestions ?? []).map((s: any) => ({
        bic: s.bic,
        name: s.name,
        corr_account: s.corr_account,
      }))
    );
  }

  // debounce handlers (простые, без внешних libs)
  let innTimer: any = (globalThis as any).__innTimer;
  let bikTimer: any = (globalThis as any).__bikTimer;
  let cpTimer: any = (globalThis as any).__cpTimer;

  async function onInnChange(v: string) {
    setInnQuery(v);
    setPartyOpen(true);
    clearTimeout(innTimer);
    (globalThis as any).__innTimer = setTimeout(() => {
      if (v.trim().length >= 2) partySuggest(v, false);
      else setPartySug([]);
    }, 350);
  }

  async function onBikChange(v: string) {
    setBikQuery(v);
    setBankOpen(true);
    clearTimeout(bikTimer);
    (globalThis as any).__bikTimer = setTimeout(() => {
      if (v.trim().length >= 2) bankSuggest(v);
      else setBankSug([]);
    }, 350);
  }

  async function onCpInnOrNameChange(v: string) {
    setCpInn(v);
    setCpOpen(true);
    clearTimeout(cpTimer);
    (globalThis as any).__cpTimer = setTimeout(() => {
      if (v.trim().length >= 2) partySuggest(v, true);
      else setCpSug([]);
    }, 350);
  }

  function applyPartyToOrg(s: PartySuggestion) {
    setSettings((x) => ({
      ...x,
      legal_inn: s.inn || null,
      legal_name: s.name || null,
      legal_kpp: s.kpp || null,
      legal_ogrn: s.ogrn || null,
      legal_address: s.address || null,
    }));
    setInnQuery(s.inn);
    setPartyOpen(false);
  }

  function applyBankToOrg(s: BankSuggestion) {
    setSettings((x) => ({
      ...x,
      bank_bik: s.bic || null,
      bank_name: s.name || null,
      bank_corr_account: s.corr_account || null,
    }));
    setBikQuery(s.bic);
    setBankOpen(false);
  }

  async function saveSettings() {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/org/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...settings,
          legal_inn: (settings.legal_inn ?? innQuery.trim()) || null,
          bank_bik: (settings.bank_bik ?? bikQuery.trim()) || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Ошибка сохранения");
      setMsg("Сохранено");
      await debounceSleep(900);
      setMsg(null);
    } catch (e: any) {
      setMsg(e?.message ?? "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function createCounterpartyFromManualOrInn() {
    setMsg(null);
    const name = cpName.trim();
    if (!name) {
      setMsg("Введите название контрагента (можно просто текст).");
      return;
    }

    const res = await fetch("/api/counterparties/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, inn: cpInn.trim() || null }),
    });

    const j = await res.json();
    if (!res.ok) {
      setMsg(j?.error ?? "Не удалось создать контрагента");
      return;
    }

    setCounterparties((prev) => [j.counterparty, ...prev]);
    setCpName("");
    setCpInn("");
    setCpSug([]);
    setCpOpen(false);
  }

  const labelOptions = useMemo(
    () => [
      { value: "30x20", label: "30×20" },
      { value: "58x40", label: "58×40" },
    ],
    []
  );

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">Настройки</h1>
          <div className="text-[13px] text-muted-foreground">Производство, юрлицо, банк, печать и контрагенты.</div>
        </div>

        <button
          disabled={saving}
          onClick={saveSettings}
          className="h-9 px-4 rounded-md bg-black text-white text-[13px] hover:bg-black/90 disabled:opacity-50"
        >
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>

      {msg ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13px]">{msg}</div>
      ) : null}

      {/* Производство */}
      <section className="border border-border rounded-xl bg-white p-4 space-y-3">
        <div className="text-[14px] font-medium">Производство</div>
        <label className="space-y-1 block max-w-[520px]">
          <div className="text-[12px] text-muted-foreground">Название на портале</div>
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
            value={settings.portal_name}
            onChange={(e) => setSettings((x) => ({ ...x, portal_name: e.target.value }))}
            placeholder="Например: Золотая игла"
          />
        </label>
      </section>

      {/* Юрлицо */}
      <section className="border border-border rounded-xl bg-white p-4 space-y-3">
        <div className="text-[14px] font-medium">Юрлицо</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[900px]">
          <div className="relative">
            <div className="text-[12px] text-muted-foreground mb-1">ИНН (подсказки)</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={innQuery}
              onChange={(e) => onInnChange(e.target.value)}
              onFocus={() => setPartyOpen(true)}
              onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
              placeholder="Начни вводить ИНН или название"
            />

            {partyOpen && partySug.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white shadow">
                {partySug.map((s) => (
                  <button
                    type="button"
                    key={`${s.inn}-${s.name}`}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted/50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyPartyToOrg(s)}
                  >
                    <div className="font-medium">{s.inn}</div>
                    <div className="text-muted-foreground">{s.name}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">Название юрлица</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.legal_name ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, legal_name: e.target.value || null }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">КПП</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.legal_kpp ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, legal_kpp: e.target.value || null }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">ОГРН</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.legal_ogrn ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, legal_ogrn: e.target.value || null }))}
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-[12px] text-muted-foreground">Адрес</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.legal_address ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, legal_address: e.target.value || null }))}
            />
          </label>
        </div>
      </section>

      {/* Банк */}
      <section className="border border-border rounded-xl bg-white p-4 space-y-3">
        <div className="text-[14px] font-medium">Банк</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[900px]">
          <div className="relative">
            <div className="text-[12px] text-muted-foreground mb-1">БИК (подсказки)</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={bikQuery}
              onChange={(e) => onBikChange(e.target.value)}
              onFocus={() => setBankOpen(true)}
              onBlur={() => setTimeout(() => setBankOpen(false), 150)}
              placeholder="Начни вводить БИК или банк"
            />

            {bankOpen && bankSug.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white shadow">
                {bankSug.map((s) => (
                  <button
                    type="button"
                    key={`${s.bic}-${s.name}`}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted/50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyBankToOrg(s)}
                  >
                    <div className="font-medium">{s.bic}</div>
                    <div className="text-muted-foreground">{s.name}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">Банк</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.bank_name ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, bank_name: e.target.value || null }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">Расчётный счёт</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.bank_account ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, bank_account: e.target.value || null }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">Корр. счёт</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={settings.bank_corr_account ?? ""}
              onChange={(e) => setSettings((x) => ({ ...x, bank_corr_account: e.target.value || null }))}
            />
          </label>
        </div>
      </section>

      {/* Печать */}
      <section className="border border-border rounded-xl bg-white p-4 space-y-3">
        <div className="text-[14px] font-medium">Печать</div>

        <label className="space-y-1 block max-w-[240px]">
          <div className="text-[12px] text-muted-foreground">Формат этикетки по умолчанию</div>
          <select
            className="h-9 w-full rounded-md border border-border px-3 text-[13px] bg-white"
            value={settings.label_format}
            onChange={(e) => setSettings((x) => ({ ...x, label_format: e.target.value }))}
          >
            {labelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Контрагенты */}
      <section className="border border-border rounded-xl bg-white p-4 space-y-3">
        <div className="text-[14px] font-medium">Контрагенты</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="space-y-1">
            <div className="text-[12px] text-muted-foreground">Название</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={cpName}
              onChange={(e) => setCpName(e.target.value)}
              placeholder="Можно просто текст"
            />
          </label>

          <div className="relative">
            <div className="text-[12px] text-muted-foreground mb-1">ИНН (необязательно, с подсказками)</div>
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-[13px]"
              value={cpInn}
              onChange={(e) => onCpInnOrNameChange(e.target.value)}
              onFocus={() => setCpOpen(true)}
              onBlur={() => setTimeout(() => setCpOpen(false), 150)}
              placeholder="Начни вводить ИНН или название"
            />
            {cpOpen && cpSug.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white shadow">
                {cpSug.map((s) => (
                  <button
                    type="button"
                    key={`${s.inn}-${s.name}`}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted/50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCpInn(s.inn);
                      setCpName(s.name);
                      setCpOpen(false);
                    }}
                  >
                    <div className="font-medium">{s.inn}</div>
                    <div className="text-muted-foreground">{s.name}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            onClick={createCounterpartyFromManualOrInn}
            className="h-9 px-4 rounded-md border border-border text-[13px] hover:bg-muted/50"
          >
            Добавить
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px] bg-white">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium w-[160px]">ИНН</th>
                <th className="px-3 py-2 font-medium w-[120px]">Активен</th>
              </tr>
            </thead>
            <tbody>
              {counterparties.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 tabular-nums">{c.inn ?? ""}</td>
                  <td className="px-3 py-2">{c.active ? "да" : "нет"}</td>
                </tr>
              ))}
              {counterparties.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={3}>
                    Контрагентов пока нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
