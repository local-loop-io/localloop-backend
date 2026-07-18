-- 012_loop_search_columns.sql
-- Core-DP local search (MaterialDNA/ProductDNA) orders results deterministically by
-- updated_at then id. Materials/products have no update path in this profile (they are
-- immutable once registered), so updated_at is set once at insert time and mirrors
-- created_at; it exists as a distinct column so a future update path has somewhere to
-- write without changing the ordering contract's shape.
ALTER TABLE loop_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE loop_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE loop_materials SET updated_at = created_at WHERE updated_at IS DISTINCT FROM created_at;
UPDATE loop_products SET updated_at = created_at WHERE updated_at IS DISTINCT FROM created_at;

CREATE INDEX IF NOT EXISTS idx_loop_materials_search ON loop_materials (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_loop_products_search ON loop_products (updated_at, id);
