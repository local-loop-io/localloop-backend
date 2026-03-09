-- Performance indexes for loop entity read endpoints
CREATE INDEX IF NOT EXISTS idx_loop_materials_created_at ON loop_materials (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_materials_category ON loop_materials (category);
CREATE INDEX IF NOT EXISTS idx_loop_materials_current_city ON loop_materials (current_city);

CREATE INDEX IF NOT EXISTS idx_loop_products_created_at ON loop_products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_products_category ON loop_products (product_category);
CREATE INDEX IF NOT EXISTS idx_loop_products_current_city ON loop_products (current_city);

CREATE INDEX IF NOT EXISTS idx_loop_offers_created_at ON loop_offers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_offers_status ON loop_offers (status);
CREATE INDEX IF NOT EXISTS idx_loop_offers_cities ON loop_offers (from_city, to_city);
CREATE INDEX IF NOT EXISTS idx_loop_offers_material_id ON loop_offers (material_id);
CREATE INDEX IF NOT EXISTS idx_loop_offers_product_id ON loop_offers (product_id);

CREATE INDEX IF NOT EXISTS idx_loop_matches_created_at ON loop_matches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_matches_offer_id ON loop_matches (offer_id);
CREATE INDEX IF NOT EXISTS idx_loop_matches_status ON loop_matches (status);

CREATE INDEX IF NOT EXISTS idx_loop_transfers_created_at ON loop_transfers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_transfers_match_id ON loop_transfers (match_id);
CREATE INDEX IF NOT EXISTS idx_loop_transfers_status ON loop_transfers (status);
