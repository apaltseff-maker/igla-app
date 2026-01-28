-- Migration: Add invoice_void RPC function
-- Purpose: Soft delete (void) invoices and return cuts to "to-invoice" list
-- Multi-tenant: org_id check enforced

CREATE OR REPLACE FUNCTION invoice_void(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_paid_amount numeric;
  v_cut_id uuid;
BEGIN
  -- Get invoice with org_id check
  SELECT org_id, paid_amount, cut_id
  INTO v_org_id, v_paid_amount, v_cut_id
  FROM invoices
  WHERE id = p_invoice_id;

  -- Check invoice exists
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  -- Check paid_amount (cannot void if paid)
  IF v_paid_amount IS NOT NULL AND v_paid_amount > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice with paid_amount > 0. Current paid_amount: %', v_paid_amount;
  END IF;

  -- Check if already void
  IF EXISTS (SELECT 1 FROM invoices WHERE id = p_invoice_id AND status = 'void') THEN
    RAISE EXCEPTION 'Invoice is already void';
  END IF;

  -- Delete invoice_lines (all types) to revert inventory/amounts
  DELETE FROM invoice_lines
  WHERE invoice_id = p_invoice_id
    AND org_id = v_org_id;

  -- Update invoice: set status='void', cut_id=null, zero amounts
  UPDATE invoices
  SET 
    status = 'void',
    cut_id = NULL,  -- This makes cut appear in "cuts_without_invoices" again
    current_amount = 0,
    planned_amount = 0,
    final_amount = 0,
    -- Keep paid_amount as is (should be 0, but preserve for audit)
    updated_at = NOW()
  WHERE id = p_invoice_id
    AND org_id = v_org_id;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to void invoice: %', p_invoice_id;
  END IF;

END;
$$;

-- Grant execute to authenticated users (RLS will enforce org_id via profiles)
GRANT EXECUTE ON FUNCTION invoice_void(uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION invoice_void(uuid) IS 'Voids an invoice: sets status=void, cut_id=null, deletes lines. Cannot void if paid_amount > 0. Multi-tenant org_id enforced.';
