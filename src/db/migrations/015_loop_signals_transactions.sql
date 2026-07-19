-- SPEC §6 / §8.1: LoopSignal configuration published by this node.
-- Single-row table: a node publishes exactly one active signal configuration.
CREATE TABLE IF NOT EXISTS loop_signal_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signals JSONB NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lab seed values mirror the example in SPECIFICATION §6.1. Categories are
-- constrained by the canonical loopsignal.schema.json (additionalProperties:
-- false), so only canonical category keys may be used here.
INSERT INTO loop_signal_config (id, signals, valid_from, valid_until)
VALUES (
  1,
  '{
    "plastic-pet": 0.30,
    "plastic-hdpe": 0.25,
    "metal-aluminum": 0.15,
    "organic-food": 0.40,
    "glass-clear": 0.10,
    "paper-clean": 0.05,
    "ewaste-phones": 0.35,
    "default": 0.05
  }'::jsonb,
  '2026-01-01T00:00:00Z',
  '2027-12-31T23:59:59Z'
)
ON CONFLICT (id) DO NOTHING;

-- SPEC §8.1: material transactions settled (or settling) through this node.
-- Status values and transitions follow SPEC §3.6.
CREATE TABLE IF NOT EXISTS loop_transactions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'completed', 'cancelled', 'disputed')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loop_transactions_status ON loop_transactions (status);
