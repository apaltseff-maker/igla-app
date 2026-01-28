-- Migration: Fix RLS policies that use profiles.user_id instead of profiles.id
-- Problem: profiles table uses 'id' column (not 'user_id'), but RLS policies reference user_id

-- Fix cut_fabric_usage RLS policies
DROP POLICY IF EXISTS "Users can view fabric usage in their org" ON cut_fabric_usage;
DROP POLICY IF EXISTS "Users can insert fabric usage in their org" ON cut_fabric_usage;
DROP POLICY IF EXISTS "Users can update fabric usage in their org" ON cut_fabric_usage;
DROP POLICY IF EXISTS "Users can delete fabric usage in their org" ON cut_fabric_usage;

CREATE POLICY "Users can view fabric usage in their org"
  ON cut_fabric_usage FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert fabric usage in their org"
  ON cut_fabric_usage FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update fabric usage in their org"
  ON cut_fabric_usage FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete fabric usage in their org"
  ON cut_fabric_usage FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- Fix warehouse RLS policies (if they exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all warehouse policies that use user_id
  FOR r IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'warehouse_%'
    AND (qual::text LIKE '%user_id%' OR with_check::text LIKE '%user_id%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Recreate warehouse policies with correct id reference
-- warehouse_fabrics
DROP POLICY IF EXISTS "Users can view fabrics in their org" ON warehouse_fabrics;
DROP POLICY IF EXISTS "Users can insert fabrics in their org" ON warehouse_fabrics;
DROP POLICY IF EXISTS "Users can update fabrics in their org" ON warehouse_fabrics;
DROP POLICY IF EXISTS "Users can delete fabrics in their org" ON warehouse_fabrics;

CREATE POLICY "Users can view fabrics in their org"
  ON warehouse_fabrics FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert fabrics in their org"
  ON warehouse_fabrics FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update fabrics in their org"
  ON warehouse_fabrics FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete fabrics in their org"
  ON warehouse_fabrics FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- warehouse_notions
DROP POLICY IF EXISTS "Users can view notions in their org" ON warehouse_notions;
DROP POLICY IF EXISTS "Users can insert notions in their org" ON warehouse_notions;
DROP POLICY IF EXISTS "Users can update notions in their org" ON warehouse_notions;
DROP POLICY IF EXISTS "Users can delete notions in their org" ON warehouse_notions;

CREATE POLICY "Users can view notions in their org"
  ON warehouse_notions FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert notions in their org"
  ON warehouse_notions FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update notions in their org"
  ON warehouse_notions FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete notions in their org"
  ON warehouse_notions FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- warehouse_packaging
DROP POLICY IF EXISTS "Users can view packaging in their org" ON warehouse_packaging;
DROP POLICY IF EXISTS "Users can insert packaging in their org" ON warehouse_packaging;
DROP POLICY IF EXISTS "Users can update packaging in their org" ON warehouse_packaging;
DROP POLICY IF EXISTS "Users can delete packaging in their org" ON warehouse_packaging;

CREATE POLICY "Users can view packaging in their org"
  ON warehouse_packaging FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert packaging in their org"
  ON warehouse_packaging FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update packaging in their org"
  ON warehouse_packaging FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete packaging in their org"
  ON warehouse_packaging FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- warehouse_movements
DROP POLICY IF EXISTS "Users can view movements in their org" ON warehouse_movements;
DROP POLICY IF EXISTS "Users can insert movements in their org" ON warehouse_movements;
DROP POLICY IF EXISTS "Users can update movements in their org" ON warehouse_movements;
DROP POLICY IF EXISTS "Users can delete movements in their org" ON warehouse_movements;

CREATE POLICY "Users can view movements in their org"
  ON warehouse_movements FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert movements in their org"
  ON warehouse_movements FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update movements in their org"
  ON warehouse_movements FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete movements in their org"
  ON warehouse_movements FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- warehouse_balances
DROP POLICY IF EXISTS "Users can view balances in their org" ON warehouse_balances;
DROP POLICY IF EXISTS "Users can insert balances in their org" ON warehouse_balances;
DROP POLICY IF EXISTS "Users can update balances in their org" ON warehouse_balances;
DROP POLICY IF EXISTS "Users can delete balances in their org" ON warehouse_balances;

CREATE POLICY "Users can view balances in their org"
  ON warehouse_balances FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert balances in their org"
  ON warehouse_balances FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update balances in their org"
  ON warehouse_balances FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete balances in their org"
  ON warehouse_balances FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
