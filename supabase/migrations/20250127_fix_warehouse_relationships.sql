-- Migration: Fix warehouse relationships and add unique index
-- Purpose: Ensure FK relationship between warehouse_fabrics and warehouse_balances
--          Add case-insensitive unique constraint on fabric names
-- Multi-tenant: org_id enforced

-- ============================================
-- 1. Ensure warehouse_fabrics exists and has proper constraints
-- ============================================

-- Drop old unique constraint if exists (org_id, name, color)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_fabrics_org_id_name_color_key'
  ) THEN
    ALTER TABLE warehouse_fabrics
      DROP CONSTRAINT warehouse_fabrics_org_id_name_color_key;
  END IF;
END $$;

-- Add unique index on (org_id, lower(name)) for case-insensitive uniqueness
-- This allows same name with different colors, but prevents duplicate names (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_fabrics_org_name_lower_uq
  ON warehouse_fabrics(org_id, lower(name));

-- ============================================
-- 2. Fix warehouse_balances FK relationship
-- ============================================

-- Ensure fabric_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_balances'
      AND column_name = 'fabric_id'
  ) THEN
    ALTER TABLE public.warehouse_balances
      ADD COLUMN fabric_id uuid;
  END IF;
END $$;

-- Add FK constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_balances_fabric_id_fkey'
  ) THEN
    ALTER TABLE public.warehouse_balances
      ADD CONSTRAINT warehouse_balances_fabric_id_fkey
      FOREIGN KEY (fabric_id)
      REFERENCES public.warehouse_fabrics(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. Ensure unique index on balances (org_id, fabric_id)
-- ============================================

-- This should already exist from the main migration, but ensure it's there
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_balances_org_fabric_uq
  ON warehouse_balances(org_id, fabric_id)
  WHERE fabric_id IS NOT NULL;

-- ============================================
-- 4. Reload PostgREST schema cache
-- ============================================

-- Note: This should be run manually after migration:
-- NOTIFY pgrst, 'reload schema';

-- Comment
COMMENT ON INDEX warehouse_fabrics_org_name_lower_uq IS 'Case-insensitive unique fabric name per org';
