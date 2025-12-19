CREATE TABLE IF NOT EXISTS interests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  role TEXT,
  country TEXT,
  city TEXT,
  website TEXT,
  email TEXT,
  message TEXT,
  share_email BOOLEAN NOT NULL DEFAULT FALSE,
  public_listing BOOLEAN NOT NULL DEFAULT TRUE,
  consent_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interests_created_at_idx ON interests (created_at DESC);
