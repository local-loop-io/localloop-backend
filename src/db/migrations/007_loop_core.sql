CREATE TABLE IF NOT EXISTS loop_materials (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  quantity_value NUMERIC NOT NULL,
  quantity_unit TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  current_city TEXT NOT NULL,
  available_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  quality NUMERIC,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_offers (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES loop_materials(id) ON DELETE CASCADE,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  status TEXT NOT NULL,
  quantity_value NUMERIC NOT NULL,
  quantity_unit TEXT NOT NULL,
  available_until TIMESTAMPTZ NOT NULL,
  terms TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_matches (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES loop_materials(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL REFERENCES loop_offers(id) ON DELETE CASCADE,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  status TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_transfers (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES loop_materials(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL REFERENCES loop_matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  handoff_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loop_events_created_at ON loop_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loop_events_entity ON loop_events (entity_type, entity_id);
