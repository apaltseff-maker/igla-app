-- sewing_wip: ORDER BY b.cut_date but cut_date was not in GROUP BY -> error in production
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
  SELECT p.org_id INTO v_org_id
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
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
  GROUP BY a.id, b.org_id, a.bundle_id, b.bundle_no, b.cut_name, b.color, b.size, b.cut_date,
           a.sewer_employee_id, e.code, e.full_name, a.qty
  HAVING (a.qty - COALESCE(SUM(pe.packed_qty), 0)) > 0
  ORDER BY b.cut_date DESC NULLS LAST, e.code;
END;
$$;
