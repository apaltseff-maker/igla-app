import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type LinePayload = {
  id: string | null;
  deleted: boolean;
  line_type: string;
  title: string | null;
  uom: string | null;
  qty: number | null;
  unit_price: number;
  inventory_item_id: string | null;
  service_template_id: string | null;
  product_id: string | null;
  color: string | null;
  planned_qty: number | null;
  final_qty: number | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  const invoice_id = body?.invoice_id as string | undefined;
  const lines = (body?.lines as LinePayload[] | undefined) ?? [];

  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id обязателен" }, { status: 400 });
  }

  // Get org_id
  const { data: profile, error: eProf } = await supabase
    .from("profiles")
    .select("org_id")
    .single();

  if (eProf || !profile?.org_id) {
    return NextResponse.json({ error: "Не удалось определить org_id" }, { status: 401 });
  }
  const org_id = profile.org_id as string;

  // Verify invoice belongs to org
  const { data: invoice, error: eInv } = await supabase
    .from("invoices")
    .select("id, org_id, status")
    .eq("id", invoice_id)
    .single();

  if (eInv || !invoice) {
    return NextResponse.json({ error: "Счёт не найден" }, { status: 404 });
  }
  if (invoice.org_id !== org_id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Process lines
  const toDelete: string[] = [];
  const toUpdate: { id: string; data: Record<string, any> }[] = [];
  const toInsert: Record<string, any>[] = [];

  for (const l of lines) {
    if (l.deleted && l.id) {
      toDelete.push(l.id);
      continue;
    }

    // Calculate amount based on line type
    let amount: number | null = null;
    let planned_amount: number | null = null;
    let final_amount: number | null = null;

    if (l.line_type === "work") {
      planned_amount = Math.round((l.planned_qty ?? 0) * (l.unit_price ?? 0) * 100) / 100;
      final_amount = Math.round((l.final_qty ?? 0) * (l.unit_price ?? 0) * 100) / 100;
    } else {
      amount = Math.round((l.qty ?? 0) * (l.unit_price ?? 0) * 100) / 100;
    }

    const lineData = {
      line_type: l.line_type,
      title: l.title,
      uom: l.uom,
      qty: l.qty,
      unit_price: l.unit_price,
      amount,
      inventory_item_id: l.inventory_item_id,
      service_template_id: l.service_template_id,
      product_id: l.product_id,
      color: l.color,
      planned_qty: l.planned_qty,
      final_qty: l.final_qty,
      planned_amount,
      final_amount,
    };

    if (l.id) {
      toUpdate.push({ id: l.id, data: lineData });
    } else if (!l.deleted) {
      toInsert.push({
        ...lineData,
        org_id,
        invoice_id,
      });
    }
  }

  // Execute deletes
  if (toDelete.length > 0) {
    // Get deleted lines to restore inventory
    const { data: deletedLines } = await supabase
      .from("invoice_lines")
      .select("id, line_type, inventory_item_id, qty")
      .in("id", toDelete)
      .eq("org_id", org_id);

    const { error: eDel } = await supabase
      .from("invoice_lines")
      .delete()
      .in("id", toDelete)
      .eq("org_id", org_id);

    if (eDel) {
      return NextResponse.json({ error: eDel.message }, { status: 500 });
    }

    // Restore inventory for deleted inventory lines
    for (const line of deletedLines ?? []) {
      if (line.line_type === "inventory" && line.inventory_item_id && line.qty && line.qty > 0) {
        const { error: eMov } = await supabase.from("inventory_movements").insert({
          org_id,
          item_id: line.inventory_item_id,
          reason: "return_from_invoice",
          qty_delta: Math.abs(Number(line.qty)), // positive for return
          unit_cost: null,
        });

        if (!eMov) {
          await supabase.rpc("inventory_apply_delta", {
            p_org_id: org_id,
            p_item_id: line.inventory_item_id,
            p_qty: Math.abs(Number(line.qty)),
            p_unit_cost: null,
          });
        }
      }
    }
  }

  // Execute updates
  for (const u of toUpdate) {
    // Get old line data for inventory lines to calculate delta
    let oldQty: number | null = null;
    let oldItemId: string | null = null;
    if (u.data.line_type === "inventory" && u.data.inventory_item_id) {
      const { data: oldLine } = await supabase
        .from("invoice_lines")
        .select("qty, inventory_item_id")
        .eq("id", u.id)
        .eq("org_id", org_id)
        .single();
      oldQty = oldLine?.qty ? Number(oldLine.qty) : null;
      oldItemId = oldLine?.inventory_item_id ?? null;
    }

    const { error: eUpd } = await supabase
      .from("invoice_lines")
      .update(u.data)
      .eq("id", u.id)
      .eq("org_id", org_id);

    if (eUpd) {
      return NextResponse.json({ error: eUpd.message }, { status: 500 });
    }

    // Handle inventory delta for updated inventory lines
    if (u.data.line_type === "inventory" && u.data.inventory_item_id && oldItemId) {
      const newQty = u.data.qty ? Number(u.data.qty) : 0;
      const delta = newQty - (oldQty ?? 0);

      if (delta !== 0 && Math.abs(delta) > 0.001) {
        // Item changed - restore old, deduct new
        if (oldItemId !== u.data.inventory_item_id) {
          if (oldQty && oldQty > 0) {
            await supabase.from("inventory_movements").insert({
              org_id,
              item_id: oldItemId,
              reason: "return_from_invoice",
              qty_delta: oldQty,
              unit_cost: null,
            });
            await supabase.rpc("inventory_apply_delta", {
              p_org_id: org_id,
              p_item_id: oldItemId,
              p_qty: oldQty,
              p_unit_cost: null,
            });
          }
          if (newQty > 0) {
            await supabase.from("inventory_movements").insert({
              org_id,
              item_id: u.data.inventory_item_id,
              reason: "issue_to_invoice",
              qty_delta: -newQty,
              unit_cost: null,
            });
            await supabase.rpc("inventory_apply_delta", {
              p_org_id: org_id,
              p_item_id: u.data.inventory_item_id,
              p_qty: -newQty,
              p_unit_cost: null,
            });
          }
        } else {
          // Same item, qty changed
          const { error: eMov } = await supabase.from("inventory_movements").insert({
            org_id,
            item_id: u.data.inventory_item_id,
            reason: delta > 0 ? "return_from_invoice" : "issue_to_invoice",
            qty_delta: -delta, // negative if increased (more deducted), positive if decreased (returned)
            unit_cost: null,
          });

          if (!eMov) {
            await supabase.rpc("inventory_apply_delta", {
              p_org_id: org_id,
              p_item_id: u.data.inventory_item_id,
              p_qty: -delta,
              p_unit_cost: null,
            });
          }
        }
      }
    }
  }

  // Execute inserts
  if (toInsert.length > 0) {
    const { error: eIns } = await supabase.from("invoice_lines").insert(toInsert);

    if (eIns) {
      return NextResponse.json({ error: eIns.message }, { status: 500 });
    }

    // Handle inventory deduction for new inventory lines
    for (const line of toInsert) {
      if (line.line_type === "inventory" && line.inventory_item_id && line.qty && line.qty > 0) {
        // Create movement: issue_to_invoice
        const { error: eMov } = await supabase.from("inventory_movements").insert({
          org_id,
          item_id: line.inventory_item_id,
          reason: "issue_to_invoice",
          qty_delta: -Math.abs(Number(line.qty)), // negative for deduction
          unit_cost: null,
        });

        if (eMov) {
          // Log error but don't fail the whole operation
          console.error("Failed to create inventory movement:", eMov.message);
        } else {
          // Update balance via RPC
          const { error: eBalance } = await supabase.rpc("inventory_apply_delta", {
            p_org_id: org_id,
            p_item_id: line.inventory_item_id,
            p_qty: -Math.abs(Number(line.qty)),
            p_unit_cost: null,
          });

          if (eBalance) {
            console.error("Failed to update inventory balance:", eBalance.message);
          }
        }
      }
    }
  }

  // Recalculate invoice totals
  const { data: allLines } = await supabase
    .from("invoice_lines")
    .select("line_type, planned_amount, final_amount, qty, unit_price, amount")
    .eq("invoice_id", invoice_id)
    .eq("org_id", org_id);

  let planned_total = 0;
  let final_total = 0;
  let other_total = 0;

  for (const l of allLines ?? []) {
    if (l.line_type === "work") {
      planned_total += Number(l.planned_amount ?? 0);
      final_total += Number(l.final_amount ?? 0);
    } else {
      const amt = Number(l.amount ?? 0) || (Number(l.qty ?? 0) * Number(l.unit_price ?? 0));
      other_total += amt;
    }
  }

  const new_planned = Math.round((planned_total + other_total) * 100) / 100;
  const new_final = Math.round((final_total + other_total) * 100) / 100;

  // Use planned or final based on invoice.basis
  const current = invoice.status === "waiting_payment" ? new_planned : new_final;

  const { error: eInvUpd } = await supabase
    .from("invoices")
    .update({
      planned_amount: new_planned,
      final_amount: new_final,
      current_amount: current,
    })
    .eq("id", invoice_id)
    .eq("org_id", org_id);

  if (eInvUpd) {
    return NextResponse.json({ error: eInvUpd.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
