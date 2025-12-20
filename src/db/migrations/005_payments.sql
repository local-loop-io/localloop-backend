CREATE TABLE IF NOT EXISTS payment_intents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  email TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  note TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_intents_created_at_idx ON payment_intents (created_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_webhooks_created_at_idx ON payment_webhooks (created_at DESC);
