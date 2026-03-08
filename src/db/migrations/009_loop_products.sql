CREATE TABLE IF NOT EXISTS loop_products (
  id TEXT PRIMARY KEY,
  product_category TEXT NOT NULL,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  quantity_value NUMERIC NOT NULL,
  quantity_unit TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  current_city TEXT NOT NULL,
  available_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offer/Match/Transfer now support product_id as alternative to material_id.
-- Add nullable product_id columns and relax material_id NOT NULL constraints.

ALTER TABLE loop_offers ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES loop_products(id) ON DELETE CASCADE;
ALTER TABLE loop_offers ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE loop_offers ADD CONSTRAINT loop_offers_subject_check CHECK (material_id IS NOT NULL OR product_id IS NOT NULL);

ALTER TABLE loop_matches ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES loop_products(id) ON DELETE CASCADE;
ALTER TABLE loop_matches ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE loop_matches ADD CONSTRAINT loop_matches_subject_check CHECK (material_id IS NOT NULL OR product_id IS NOT NULL);

ALTER TABLE loop_transfers ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES loop_products(id) ON DELETE CASCADE;
ALTER TABLE loop_transfers ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE loop_transfers ADD CONSTRAINT loop_transfers_subject_check CHECK (material_id IS NOT NULL OR product_id IS NOT NULL);
