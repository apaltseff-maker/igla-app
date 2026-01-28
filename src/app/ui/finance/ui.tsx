"use client";

import { useEffect, useState } from "react";
import { formatRUDate } from "@/lib/format";

type FinanceRow = {
  day: string;
  nm_id: number;
  qty: number;
  retail_amount: number;
  ppvz_for_pay: number;
  delivery_rub: number;
  penalty: number;
  additional_payment: number;
  storage_fee: number;
};

type FinanceStats = {
  total_qty: number;
  total_retail: number;
  total_ppvz: number;
  total_delivery: number;
  total_penalty: number;
  total_additional: number;
  total_storage: number;
};

function formatMoney(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(kopecks / 100);
}

export default function FinanceClient() {
  const [data, setData] = useState<FinanceRow[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ui/finance?from=${dateFrom}&to=${dateTo}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.rows || []);
      setStats(json.stats || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const net_profit = stats
    ? stats.total_ppvz -
      stats.total_delivery -
      stats.total_penalty +
      stats.total_additional -
      stats.total_storage
    : 0;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Финансы WB</h1>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border rounded"
          />
          <span className="self-center">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border rounded"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Загрузка..." : "Обновить"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Продано (шт)</div>
            <div className="text-2xl font-bold">{stats.total_qty.toLocaleString("ru")}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Выручка</div>
            <div className="text-2xl font-bold">{formatMoney(stats.total_retail)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">К перечислению</div>
            <div className="text-2xl font-bold">{formatMoney(stats.total_ppvz)}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Чистая прибыль</div>
            <div className={`text-2xl font-bold ${net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(net_profit)}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left border">День</th>
              <th className="px-3 py-2 text-left border">nm_id</th>
              <th className="px-3 py-2 text-right border">Кол-во</th>
              <th className="px-3 py-2 text-right border">Выручка</th>
              <th className="px-3 py-2 text-right border">К перечислению</th>
              <th className="px-3 py-2 text-right border">Доставка</th>
              <th className="px-3 py-2 text-right border">Штраф</th>
              <th className="px-3 py-2 text-right border">Доплата</th>
              <th className="px-3 py-2 text-right border">Хранение</th>
              <th className="px-3 py-2 text-right border">Прибыль</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const profit =
                row.ppvz_for_pay -
                row.delivery_rub -
                row.penalty +
                row.additional_payment -
                row.storage_fee;
              return (
                <tr key={`${row.day}-${row.nm_id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{formatRUDate(row.day)}</td>
                  <td className="px-3 py-2 border font-mono text-sm">{row.nm_id}</td>
                  <td className="px-3 py-2 border text-right">{row.qty.toLocaleString("ru")}</td>
                  <td className="px-3 py-2 border text-right">{formatMoney(row.retail_amount)}</td>
                  <td className="px-3 py-2 border text-right">{formatMoney(row.ppvz_for_pay)}</td>
                  <td className="px-3 py-2 border text-right text-red-600">
                    -{formatMoney(row.delivery_rub)}
                  </td>
                  <td className="px-3 py-2 border text-right text-red-600">
                    -{formatMoney(row.penalty)}
                  </td>
                  <td className="px-3 py-2 border text-right text-green-600">
                    +{formatMoney(row.additional_payment)}
                  </td>
                  <td className="px-3 py-2 border text-right text-red-600">
                    -{formatMoney(row.storage_fee)}
                  </td>
                  <td className={`px-3 py-2 border text-right font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(profit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-8">Нет данных за выбранный период</div>
      )}
    </main>
  );
}
