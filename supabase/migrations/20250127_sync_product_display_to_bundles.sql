-- Migration: Sync product.display to cut_bundles.cut_name when product is renamed
-- Purpose: When product.display changes, update all related cut_bundles.cut_name
-- Multi-tenant: org_id enforced via RLS

CREATE OR REPLACE FUNCTION sync_product_display_to_bundles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update cut_bundles.cut_name for all bundles with this product_id
  UPDATE cut_bundles
  SET cut_name = NEW.display
  WHERE product_id = NEW.id
    AND org_id = NEW.org_id
    AND (cut_name IS DISTINCT FROM NEW.display);
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_product_display_to_bundles ON products;
CREATE TRIGGER trigger_sync_product_display_to_bundles
  AFTER UPDATE OF display ON products
  FOR EACH ROW
  WHEN (OLD.display IS DISTINCT FROM NEW.display)
  EXECUTE FUNCTION sync_product_display_to_bundles();

-- Comment
COMMENT ON FUNCTION sync_product_display_to_bundles() IS 'Syncs product.display to cut_bundles.cut_name when product name changes. Multi-tenant org_id enforced.';
