-- Migration: Cut fabric usage tracking
-- Purpose: Track fabric consumption per cut (up to 10 fabrics, fractional rolls)
-- Multi-tenant: org_id enforced

CREATE TABLE IF NOT EXISTS cut_fabric_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cut_id uuid NOT NULL REFERENCES cuts(id) ON DELETE CASCADE,
  fabric_id uuid NOT NULL REFERENCES warehouse_fabrics(id) ON DELETE CASCADE,
  rolls_used numeric(10,3) NOT NULL DEFAULT 0, -- дробные рулоны (например 2.5)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, cut_id, fabric_id) -- одна запись на ткань в крое
);

-- Indexes
CREATE INDEX idx_cut_fabric_usage_cut ON cut_fabric_usage(cut_id);
CREATE INDEX idx_cut_fabric_usage_fabric ON cut_fabric_usage(fabric_id);
CREATE INDEX idx_cut_fabric_usage_org ON cut_fabric_usage(org_id);

-- RLS Policies
ALTER TABLE cut_fabric_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fabric usage in their org"
  ON cut_fabric_usage FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fabric usage in their org"
  ON cut_fabric_usage FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fabric usage in their org"
  ON cut_fabric_usage FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete fabric usage in their org"
  ON cut_fabric_usage FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON cut_fabric_usage TO authenticated;

-- Comment
COMMENT ON TABLE cut_fabric_usage IS 'Расход ткани на крой. До 10 разных тканей на крой, дробные рулоны. Multi-tenant org_id enforced.';
