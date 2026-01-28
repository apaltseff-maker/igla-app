import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import "./fonts";

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Roboto" },
  h1: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row" },
  col: { flexDirection: "column" },
  box: { borderWidth: 1, borderColor: "#000", padding: 6 },
  table: { borderWidth: 1, borderColor: "#000" },
  th: { fontWeight: 700 },
  td: {},
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: "#000" },
});

function money(v: number) {
  return v.toFixed(2).replace(".", ",");
}

type InvoiceData = {
  id: string;
  issue_date: string;
  cut_name: string;
  cut_date: string | null;
  basis: string;
  current_amount: number;
};

type Supplier = {
  portal_name: string;
  legal_name: string;
  legal_inn: string;
  legal_kpp: string;
  legal_address: string;
  bank_name: string;
  bank_bik: string;
  bank_corr_account: string;
  bank_account: string;
};

type Buyer = {
  name: string;
  inn: string;
  kpp: string;
  address: string;
};

type Line = {
  n: number;
  item: string;
  qty: number;
  unit_price: number;
  amount: number;
};

type Props = {
  invoice: InvoiceData;
  supplier: Supplier;
  buyer: Buyer;
  lines: Line[];
};

export function InvoicePdf({ invoice, supplier, buyer, lines }: Props) {
  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Счет на оплату</Text>

        <View style={[s.box, { marginBottom: 10 }]}>
          <Text>Поставщик (Исполнитель): {supplier.legal_name || supplier.portal_name}</Text>
          <Text>ИНН {supplier.legal_inn} КПП {supplier.legal_kpp}</Text>
          <Text>Адрес: {supplier.legal_address}</Text>
          <Text>Банк: {supplier.bank_name}</Text>
          <Text>БИК: {supplier.bank_bik}  к/с: {supplier.bank_corr_account}</Text>
          <Text>р/с: {supplier.bank_account}</Text>
        </View>

        <View style={[s.box, { marginBottom: 10 }]}>
          <Text>Покупатель (Заказчик): {buyer.name}</Text>
          {buyer.inn ? <Text>ИНН {buyer.inn}{buyer.kpp ? ` КПП ${buyer.kpp}` : ""}</Text> : null}
          {buyer.address ? <Text>Адрес: {buyer.address}</Text> : null}
        </View>

        <Text style={{ marginBottom: 6 }}>
          Счет № {String(invoice.id).slice(0, 8)} от {invoice.issue_date}
        </Text>
        <Text style={{ marginBottom: 10 }}>
          Основание: {invoice.cut_name} ({invoice.cut_date ?? ""})
        </Text>

        <View style={[s.table, { marginBottom: 10 }]}>
          <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: "#000" }]}>
            <Text style={[s.cell, s.th, { width: 24 }]}>№</Text>
            <Text style={[s.cell, s.th, { flex: 1 }]}>Товары (работы, услуги)</Text>
            <Text style={[s.cell, s.th, { width: 60, textAlign: "right" }]}>Кол-во</Text>
            <Text style={[s.cell, s.th, { width: 70, textAlign: "right" }]}>Цена</Text>
            <Text style={[{ padding: 4, width: 80, textAlign: "right" }]}>Сумма</Text>
          </View>

          {lines.map((l) => (
            <View key={l.n} style={[s.row, { borderBottomWidth: 1, borderBottomColor: "#000" }]}>
              <Text style={[s.cell, { width: 24 }]}>{l.n}</Text>
              <Text style={[s.cell, { flex: 1 }]}>{l.item}</Text>
              <Text style={[s.cell, { width: 60, textAlign: "right" }]}>{l.qty}</Text>
              <Text style={[s.cell, { width: 70, textAlign: "right" }]}>{money(l.unit_price)}</Text>
              <Text style={[{ padding: 4, width: 80, textAlign: "right" }]}>{money(l.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text>Итого: {money(total)}</Text>
          <Text>Всего к оплате: {money(total)}</Text>
        </View>
      </Page>
    </Document>
  );
}
