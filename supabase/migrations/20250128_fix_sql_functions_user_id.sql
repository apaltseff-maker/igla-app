-- Migration: Fix SQL functions that use profiles.user_id instead of profiles.id
-- Problem: SQL functions cuts_list_with_stats, bundles_not_assigned, sewing_wip, cut_items_with_bundle_stats
-- may reference p.user_id or profiles.user_id, but the column is actually 'id'

-- Fix cuts_list_with_stats function (if it exists)
CREATE OR REPLACE FUNCTION cuts_list_with_stats(
  p_cutter_employee_id uuid DEFAULT NULL,
  p_q text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  cut_date date,
  cut_name text,
  note text,
  cutter_employee_id uuid,
  org_id uuid,
  cut_status text,
  bundles_count bigint,
  items_count bigint,
  total_qty numeric,
  assigned_qty numeric,
  packed_qty numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get current user's org_id
  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.cut_date,
    c.cut_name,
    c.note,
    c.cutter_employee_id,
    c.org_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM cut_bundles b
        WHERE b.cut_id = c.id
        AND EXISTS (
          SELECT 1 FROM sewing_assignments a
          WHERE a.bundle_id = b.id
        )
      ) THEN 'В работе'
      WHEN EXISTS (
        SELECT 1 FROM cut_bundles b
        WHERE b.cut_id = c.id
      ) THEN 'Не выдан'
      ELSE 'Пустой'
    END::text AS cut_status,
    COUNT(DISTINCT b.id)::bigint AS bundles_count,
    COUNT(DISTINCT ci.id)::bigint AS items_count,
    COALESCE(SUM(b.qty_total), 0)::numeric AS total_qty,
    COALESCE(SUM(a.qty), 0)::numeric AS assigned_qty,
    COALESCE(SUM(pe.packed_qty), 0)::numeric AS packed_qty
  FROM cuts c
  LEFT JOIN cut_bundles b ON b.cut_id = c.id
  LEFT JOIN cut_items ci ON ci.bundle_id = b.id
  LEFT JOIN sewing_assignments a ON a.bundle_id = b.id
  LEFT JOIN packaging_events pe ON pe.bundle_id = b.id
  WHERE c.org_id = v_org_id
    AND (p_cutter_employee_id IS NULL OR c.cutter_employee_id = p_cutter_employee_id)
    AND (p_q IS NULL OR 
         c.cut_name ILIKE '%' || p_q || '%' OR 
         c.note ILIKE '%' || p_q || '%')
  GROUP BY c.id, c.cut_date, c.cut_name, c.note, c.cutter_employee_id, c.org_id
  ORDER BY c.cut_date DESC NULLS LAST, c.cut_name;
END;
$$;

-- Fix bundles_not_assigned function (if it exists)
CREATE OR REPLACE FUNCTION bundles_not_assigned()
RETURNS TABLE (
  id uuid,
  org_id uuid,
  bundle_no text,
  cut_id uuid,
  cut_date date,
  cut_name text,
  color text,
  size text,
  qty_total numeric,
  assigned_qty numeric,
  remaining_qty numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get current user's org_id
  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    b.id,
    b.org_id,
    b.bundle_no,
    b.cut_id,
    b.cut_date,
    b.cut_name,
    b.color,
    b.size,
    b.qty_total,
    COALESCE(SUM(a.qty), 0)::numeric AS assigned_qty,
    (b.qty_total - COALESCE(SUM(a.qty), 0))::numeric AS remaining_qty
  FROM cut_bundles b
  LEFT JOIN sewing_assignments a ON a.bundle_id = b.id
  WHERE b.org_id = v_org_id
    AND NOT EXISTS (
      SELECT 1 FROM sewing_assignments a2
      WHERE a2.bundle_id = b.id
    )
  GROUP BY b.id, b.org_id, b.bundle_no, b.cut_id, b.cut_date, b.cut_name, b.color, b.size, b.qty_total
  HAVING (b.qty_total - COALESCE(SUM(a.qty), 0)) > 0
  ORDER BY b.cut_date DESC NULLS LAST, b.bundle_no;
END;
$$;

-- Fix sewing_wip function (if it exists)
CREATE OR REPLACE FUNCTION sewing_wip()
RETURNS TABLE (
  id uuid,
  org_id uuid,
  bundle_id uuid,
  bundle_no text,
  cut_name text,
  color text,
  size text,
  sewer_employee_id uuid,
  sewer_code text,
  sewer_name text,
  assigned_qty numeric,
  packed_qty numeric,
  remaining_qty numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get current user's org_id
  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    b.org_id,
    a.bundle_id,
    b.bundle_no,
    b.cut_name,
    b.color,
    b.size,
    a.sewer_employee_id,
    e.code AS sewer_code,
    e.full_name AS sewer_name,
    a.qty AS assigned_qty,
    COALESCE(SUM(pe.packed_qty), 0)::numeric AS packed_qty,
    (a.qty - COALESCE(SUM(pe.packed_qty), 0))::numeric AS remaining_qty
  FROM sewing_assignments a
  INNER JOIN cut_bundles b ON b.id = a.bundle_id
  INNER JOIN employees e ON e.id = a.sewer_employee_id
  LEFT JOIN packaging_events pe ON pe.bundle_id = a.bundle_id AND pe.sewer_employee_id = a.sewer_employee_id
  WHERE b.org_id = v_org_id
  GROUP BY a.id, b.org_id, a.bundle_id, b.bundle_no, b.cut_name, b.color, b.size, 
           a.sewer_employee_id, e.code, e.full_name, a.qty
  HAVING (a.qty - COALESCE(SUM(pe.packed_qty), 0)) > 0
  ORDER BY b.cut_date DESC NULLS LAST, e.code;
END;
$$;

-- Fix cut_items_with_bundle_stats function (if it exists)
CREATE OR REPLACE FUNCTION cut_items_with_bundle_stats(p_cut_id uuid)
RETURNS TABLE (
  id uuid,
  bundle_id uuid,
  bundle_no text,
  product_id uuid,
  product_display text,
  color text,
  size text,
  qty numeric,
  assigned_qty numeric,
  packed_qty numeric,
  remaining_qty numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get current user's org_id
  SELECT org_id INTO v_org_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Verify cut belongs to user's org
  IF NOT EXISTS (
    SELECT 1 FROM cuts
    WHERE id = p_cut_id AND org_id = v_org_id
  ) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ci.id,
    ci.bundle_id,
    b.bundle_no,
    ci.product_id,
    COALESCE(p.display, b.cut_name) AS product_display,
    ci.color,
    ci.size,
    ci.qty,
    COALESCE(SUM(a.qty), 0)::numeric AS assigned_qty,
    COALESCE(SUM(pe.packed_qty), 0)::numeric AS packed_qty,
    (ci.qty - COALESCE(SUM(a.qty), 0) + COALESCE(SUM(pe.packed_qty), 0))::numeric AS remaining_qty
  FROM cut_items ci
  INNER JOIN cut_bundles b ON b.id = ci.bundle_id
  LEFT JOIN products p ON p.id = ci.product_id
  LEFT JOIN sewing_assignments a ON a.bundle_id = b.id
  LEFT JOIN packaging_events pe ON pe.bundle_id = b.id AND pe.sewer_employee_id = a.sewer_employee_id
  WHERE b.cut_id = p_cut_id
  GROUP BY ci.id, ci.bundle_id, b.bundle_no, ci.product_id, p.display, b.cut_name, ci.color, ci.size, ci.qty
  ORDER BY b.bundle_no, ci.color, ci.size;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cuts_list_with_stats(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION bundles_not_assigned() TO authenticated;
GRANT EXECUTE ON FUNCTION sewing_wip() TO authenticated;
GRANT EXECUTE ON FUNCTION cut_items_with_bundle_stats(uuid) TO authenticated;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
