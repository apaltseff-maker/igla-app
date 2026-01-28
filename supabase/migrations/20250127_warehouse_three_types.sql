-- Migration: Warehouse with 3 types (Fabrics, Notions, Packaging)
-- Purpose: Replace single inventory with 3 separate warehouse types
-- Multi-tenant: org_id enforced

-- ============================================
-- 1. CATALOG TABLES
-- ============================================

-- Fabrics catalog
CREATE TABLE IF NOT EXISTS warehouse_fabrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, -- название ткани
  color text, -- цвет
  width_cm numeric, -- ширина (см)
  density text, -- плотность
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name, color) -- уникальность по org+name+color
);

-- Notions catalog
CREATE TABLE IF NOT EXISTS warehouse_notions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, -- название фурнитуры
  uom text NOT NULL DEFAULT 'шт', -- единица измерения
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Packaging catalog
CREATE TABLE IF NOT EXISTS warehouse_packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, -- название упаковки
  uom text NOT NULL DEFAULT 'шт', -- единица измерения
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

-- ============================================
-- 2. MOVEMENTS TABLE (unified for all types)
-- ============================================

CREATE TYPE warehouse_type AS ENUM ('fabric', 'notion', 'packaging');
CREATE TYPE movement_reason AS ENUM ('receipt', 'issue', 'adjustment', 'return');

CREATE TABLE IF NOT EXISTS warehouse_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_type warehouse_type NOT NULL,
  
  -- Foreign keys (one of three)
  fabric_id uuid REFERENCES warehouse_fabrics(id) ON DELETE CASCADE,
  notion_id uuid REFERENCES warehouse_notions(id) ON DELETE CASCADE,
  packaging_id uuid REFERENCES warehouse_packaging(id) ON DELETE CASCADE,
  
  reason movement_reason NOT NULL DEFAULT 'receipt',
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Fabric-specific fields
  rolls_delta numeric, -- изменение рулонов (для ткани)
  meters_delta numeric, -- изменение метража (для ткани)
  total_cost numeric, -- общая сумма
  cost_per_meter numeric, -- цена за метр (computed: total_cost/meters_delta)
  
  -- Notion/Packaging fields
  qty_delta numeric, -- изменение количества
  unit_cost numeric, -- цена за единицу
  
  -- Notes
  notes text,
  
  -- Constraint: exactly one FK must be set
  CONSTRAINT check_single_item CHECK (
    (warehouse_type = 'fabric' AND fabric_id IS NOT NULL AND notion_id IS NULL AND packaging_id IS NULL) OR
    (warehouse_type = 'notion' AND notion_id IS NOT NULL AND fabric_id IS NULL AND packaging_id IS NULL) OR
    (warehouse_type = 'packaging' AND packaging_id IS NOT NULL AND fabric_id IS NULL AND notion_id IS NULL)
  )
);

-- ============================================
-- 3. BALANCES TABLE (computed/updated)
-- ============================================

CREATE TABLE IF NOT EXISTS warehouse_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_type warehouse_type NOT NULL,
  
  -- Foreign keys (one of three)
  fabric_id uuid REFERENCES warehouse_fabrics(id) ON DELETE CASCADE,
  notion_id uuid REFERENCES warehouse_notions(id) ON DELETE CASCADE,
  packaging_id uuid REFERENCES warehouse_packaging(id) ON DELETE CASCADE,
  
  -- Fabric balances
  rolls_on_hand numeric DEFAULT 0,
  meters_on_hand numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  avg_cost_per_meter numeric, -- computed
  
  -- Notion/Packaging balances
  qty_on_hand numeric DEFAULT 0,
  avg_unit_cost numeric,
  
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: exactly one FK must be set
  CONSTRAINT check_single_item_balance CHECK (
    (warehouse_type = 'fabric' AND fabric_id IS NOT NULL AND notion_id IS NULL AND packaging_id IS NULL) OR
    (warehouse_type = 'notion' AND notion_id IS NOT NULL AND fabric_id IS NULL AND packaging_id IS NULL) OR
    (warehouse_type = 'packaging' AND packaging_id IS NOT NULL AND fabric_id IS NULL AND notion_id IS NULL)
  ),
  -- Unique per item
  UNIQUE(org_id, warehouse_type, COALESCE(fabric_id, notion_id, packaging_id))
);

-- ============================================
-- 4. INDEXES
-- ============================================

CREATE INDEX idx_warehouse_fabrics_org ON warehouse_fabrics(org_id);
CREATE INDEX idx_warehouse_notions_org ON warehouse_notions(org_id);
CREATE INDEX idx_warehouse_packaging_org ON warehouse_packaging(org_id);

CREATE INDEX idx_warehouse_movements_org_type ON warehouse_movements(org_id, warehouse_type);
CREATE INDEX idx_warehouse_movements_fabric ON warehouse_movements(fabric_id) WHERE fabric_id IS NOT NULL;
CREATE INDEX idx_warehouse_movements_notion ON warehouse_movements(notion_id) WHERE notion_id IS NOT NULL;
CREATE INDEX idx_warehouse_movements_packaging ON warehouse_movements(packaging_id) WHERE packaging_id IS NOT NULL;
CREATE INDEX idx_warehouse_movements_date ON warehouse_movements(movement_date);

CREATE INDEX idx_warehouse_balances_org_type ON warehouse_balances(org_id, warehouse_type);
CREATE INDEX idx_warehouse_balances_fabric ON warehouse_balances(fabric_id) WHERE fabric_id IS NOT NULL;
CREATE INDEX idx_warehouse_balances_notion ON warehouse_balances(notion_id) WHERE notion_id IS NOT NULL;
CREATE INDEX idx_warehouse_balances_packaging ON warehouse_balances(packaging_id) WHERE packaging_id IS NOT NULL;

-- ============================================
-- 5. RPC: Update balance after movement
-- ============================================

CREATE OR REPLACE FUNCTION warehouse_update_balance(
  p_org_id uuid,
  p_warehouse_type warehouse_type,
  p_item_id uuid,
  p_rolls_delta numeric DEFAULT NULL,
  p_meters_delta numeric DEFAULT NULL,
  p_qty_delta numeric DEFAULT NULL,
  p_total_cost numeric DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fabric_id uuid;
  v_notion_id uuid;
  v_packaging_id uuid;
  v_current_rolls numeric := 0;
  v_current_meters numeric := 0;
  v_current_qty numeric := 0;
  v_current_total_cost numeric := 0;
  v_new_rolls numeric;
  v_new_meters numeric;
  v_new_qty numeric;
  v_new_total_cost numeric;
  v_avg_cost_per_meter numeric;
  v_avg_unit_cost numeric;
BEGIN
  -- Set appropriate FK based on type
  IF p_warehouse_type = 'fabric' THEN
    v_fabric_id := p_item_id;
  ELSIF p_warehouse_type = 'notion' THEN
    v_notion_id := p_item_id;
  ELSIF p_warehouse_type = 'packaging' THEN
    v_packaging_id := p_item_id;
  ELSE
    RAISE EXCEPTION 'Invalid warehouse_type: %', p_warehouse_type;
  END IF;

  -- Get current balance or create new
  SELECT rolls_on_hand, meters_on_hand, qty_on_hand, total_cost
  INTO v_current_rolls, v_current_meters, v_current_qty, v_current_total_cost
  FROM warehouse_balances
  WHERE org_id = p_org_id
    AND warehouse_type = p_warehouse_type
    AND (fabric_id = v_fabric_id OR notion_id = v_notion_id OR packaging_id = v_packaging_id);

  -- Calculate new values
  IF p_warehouse_type = 'fabric' THEN
    v_new_rolls := COALESCE(v_current_rolls, 0) + COALESCE(p_rolls_delta, 0);
    v_new_meters := COALESCE(v_current_meters, 0) + COALESCE(p_meters_delta, 0);
    v_new_total_cost := COALESCE(v_current_total_cost, 0) + COALESCE(p_total_cost, 0);
    v_avg_cost_per_meter := CASE WHEN v_new_meters > 0 THEN v_new_total_cost / v_new_meters ELSE NULL END;
    
    INSERT INTO warehouse_balances (
      org_id, warehouse_type, fabric_id,
      rolls_on_hand, meters_on_hand, total_cost, avg_cost_per_meter, updated_at
    )
    VALUES (
      p_org_id, p_warehouse_type, v_fabric_id,
      v_new_rolls, v_new_meters, v_new_total_cost, v_avg_cost_per_meter, now()
    )
    ON CONFLICT (org_id, warehouse_type, fabric_id)
    DO UPDATE SET
      rolls_on_hand = v_new_rolls,
      meters_on_hand = v_new_meters,
      total_cost = v_new_total_cost,
      avg_cost_per_meter = v_avg_cost_per_meter,
      updated_at = now();
  ELSE
    -- Notion or Packaging
    v_new_qty := COALESCE(v_current_qty, 0) + COALESCE(p_qty_delta, 0);
    v_new_total_cost := COALESCE(v_current_total_cost, 0) + COALESCE(p_total_cost, 0);
    v_avg_unit_cost := CASE WHEN v_new_qty > 0 THEN v_new_total_cost / v_new_qty ELSE NULL END;
    
    IF p_warehouse_type = 'notion' THEN
      INSERT INTO warehouse_balances (
        org_id, warehouse_type, notion_id,
        qty_on_hand, total_cost, avg_unit_cost, updated_at
      )
      VALUES (
        p_org_id, p_warehouse_type, v_notion_id,
        v_new_qty, v_new_total_cost, v_avg_unit_cost, now()
      )
      ON CONFLICT (org_id, warehouse_type, notion_id)
      DO UPDATE SET
        qty_on_hand = v_new_qty,
        total_cost = v_new_total_cost,
        avg_unit_cost = v_avg_unit_cost,
        updated_at = now();
    ELSE
      INSERT INTO warehouse_balances (
        org_id, warehouse_type, packaging_id,
        qty_on_hand, total_cost, avg_unit_cost, updated_at
      )
      VALUES (
        p_org_id, p_warehouse_type, v_packaging_id,
        v_new_qty, v_new_total_cost, v_avg_unit_cost, now()
      )
      ON CONFLICT (org_id, warehouse_type, packaging_id)
      DO UPDATE SET
        qty_on_hand = v_new_qty,
        total_cost = v_new_total_cost,
        avg_unit_cost = v_avg_unit_cost,
        updated_at = now();
    END IF;
  END IF;
END;
$$;

-- ============================================
-- 6. RPC: Recalculate all balances (for corrections)
-- ============================================

CREATE OR REPLACE FUNCTION warehouse_recalculate_balance(
  p_org_id uuid,
  p_warehouse_type warehouse_type,
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fabric_id uuid;
  v_notion_id uuid;
  v_packaging_id uuid;
  v_sum_rolls numeric := 0;
  v_sum_meters numeric := 0;
  v_sum_qty numeric := 0;
  v_sum_total_cost numeric := 0;
  v_avg_cost_per_meter numeric;
  v_avg_unit_cost numeric;
BEGIN
  -- Set appropriate FK
  IF p_warehouse_type = 'fabric' THEN
    v_fabric_id := p_item_id;
  ELSIF p_warehouse_type = 'notion' THEN
    v_notion_id := p_item_id;
  ELSIF p_warehouse_type = 'packaging' THEN
    v_packaging_id := p_item_id;
  END IF;

  -- Sum all movements
  IF p_warehouse_type = 'fabric' THEN
    SELECT 
      COALESCE(SUM(rolls_delta), 0),
      COALESCE(SUM(meters_delta), 0),
      COALESCE(SUM(total_cost), 0)
    INTO v_sum_rolls, v_sum_meters, v_sum_total_cost
    FROM warehouse_movements
    WHERE org_id = p_org_id
      AND warehouse_type = 'fabric'
      AND fabric_id = v_fabric_id;
    
    v_avg_cost_per_meter := CASE WHEN v_sum_meters > 0 THEN v_sum_total_cost / v_sum_meters ELSE NULL END;
    
    INSERT INTO warehouse_balances (
      org_id, warehouse_type, fabric_id,
      rolls_on_hand, meters_on_hand, total_cost, avg_cost_per_meter, updated_at
    )
    VALUES (
      p_org_id, 'fabric', v_fabric_id,
      v_sum_rolls, v_sum_meters, v_sum_total_cost, v_avg_cost_per_meter, now()
    )
    ON CONFLICT (org_id, warehouse_type, fabric_id)
    DO UPDATE SET
      rolls_on_hand = v_sum_rolls,
      meters_on_hand = v_sum_meters,
      total_cost = v_sum_total_cost,
      avg_cost_per_meter = v_avg_cost_per_meter,
      updated_at = now();
  ELSE
    SELECT 
      COALESCE(SUM(qty_delta), 0),
      COALESCE(SUM(total_cost), 0)
    INTO v_sum_qty, v_sum_total_cost
    FROM warehouse_movements
    WHERE org_id = p_org_id
      AND warehouse_type = p_warehouse_type
      AND (notion_id = v_notion_id OR packaging_id = v_packaging_id);
    
    v_avg_unit_cost := CASE WHEN v_sum_qty > 0 THEN v_sum_total_cost / v_sum_qty ELSE NULL END;
    
    IF p_warehouse_type = 'notion' THEN
      INSERT INTO warehouse_balances (
        org_id, warehouse_type, notion_id,
        qty_on_hand, total_cost, avg_unit_cost, updated_at
      )
      VALUES (
        p_org_id, 'notion', v_notion_id,
        v_sum_qty, v_sum_total_cost, v_avg_unit_cost, now()
      )
      ON CONFLICT (org_id, warehouse_type, notion_id)
      DO UPDATE SET
        qty_on_hand = v_sum_qty,
        total_cost = v_sum_total_cost,
        avg_unit_cost = v_avg_unit_cost,
        updated_at = now();
    ELSE
      INSERT INTO warehouse_balances (
        org_id, warehouse_type, packaging_id,
        qty_on_hand, total_cost, avg_unit_cost, updated_at
      )
      VALUES (
        p_org_id, 'packaging', v_packaging_id,
        v_sum_qty, v_sum_total_cost, v_avg_unit_cost, now()
      )
      ON CONFLICT (org_id, warehouse_type, packaging_id)
      DO UPDATE SET
        qty_on_hand = v_sum_qty,
        total_cost = v_sum_total_cost,
        avg_unit_cost = v_avg_unit_cost,
        updated_at = now();
    END IF;
  END IF;
END;
$$;

-- ============================================
-- 7. RLS POLICIES (if RLS is enabled)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE warehouse_fabrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_notions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_balances ENABLE ROW LEVEL SECURITY;

-- Policies for warehouse_fabrics
CREATE POLICY "Users can view fabrics in their org"
  ON warehouse_fabrics FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fabrics in their org"
  ON warehouse_fabrics FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fabrics in their org"
  ON warehouse_fabrics FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete fabrics in their org"
  ON warehouse_fabrics FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Policies for warehouse_notions
CREATE POLICY "Users can view notions in their org"
  ON warehouse_notions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert notions in their org"
  ON warehouse_notions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update notions in their org"
  ON warehouse_notions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete notions in their org"
  ON warehouse_notions FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Policies for warehouse_packaging
CREATE POLICY "Users can view packaging in their org"
  ON warehouse_packaging FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert packaging in their org"
  ON warehouse_packaging FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update packaging in their org"
  ON warehouse_packaging FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete packaging in their org"
  ON warehouse_packaging FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Policies for warehouse_movements
CREATE POLICY "Users can view movements in their org"
  ON warehouse_movements FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert movements in their org"
  ON warehouse_movements FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update movements in their org"
  ON warehouse_movements FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete movements in their org"
  ON warehouse_movements FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Policies for warehouse_balances (read-only)
CREATE POLICY "Users can view balances in their org"
  ON warehouse_balances FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 8. GRANTS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON warehouse_fabrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warehouse_notions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warehouse_packaging TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warehouse_movements TO authenticated;
GRANT SELECT ON warehouse_balances TO authenticated;

GRANT EXECUTE ON FUNCTION warehouse_update_balance TO authenticated;
GRANT EXECUTE ON FUNCTION warehouse_recalculate_balance TO authenticated;

-- ============================================
-- 9. COMMENTS
-- ============================================

COMMENT ON TABLE warehouse_fabrics IS 'Каталог тканей';
COMMENT ON TABLE warehouse_notions IS 'Каталог фурнитуры';
COMMENT ON TABLE warehouse_packaging IS 'Каталог упаковки';
COMMENT ON TABLE warehouse_movements IS 'Журнал движений по складам (приход/списание/корректировка)';
COMMENT ON TABLE warehouse_balances IS 'Остатки по складам (вычисляемые)';

COMMENT ON FUNCTION warehouse_update_balance IS 'Обновляет остатки после движения. Multi-tenant org_id enforced.';
COMMENT ON FUNCTION warehouse_recalculate_balance IS 'Пересчитывает остатки по всем движениям (для корректировок). Multi-tenant org_id enforced.';
