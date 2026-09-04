-- 019_loop_search_indexes.sql
-- Indexes for filters the Core-DP local search (src/db/loop.ts runEntitySearch) actually
-- issues but 010/012 never covered:
--   * origin_city equality (010 indexed current_city only);
--   * prefix LIKE on category / product_category / id — under a non-"C" collation a plain
--     btree cannot serve `LIKE 'abc%'`, text_pattern_ops can.
-- The keyset cursor predicate is rewritten in the same release to compare
-- (updated_at, id) directly so idx_loop_*_search from 012 becomes usable for pagination.
CREATE INDEX IF NOT EXISTS idx_loop_materials_origin_city ON loop_materials (origin_city);
CREATE INDEX IF NOT EXISTS idx_loop_products_origin_city ON loop_products (origin_city);

CREATE INDEX IF NOT EXISTS idx_loop_materials_category_prefix ON loop_materials (category text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_loop_products_category_prefix ON loop_products (product_category text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_loop_materials_id_prefix ON loop_materials (id text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_loop_products_id_prefix ON loop_products (id text_pattern_ops);
