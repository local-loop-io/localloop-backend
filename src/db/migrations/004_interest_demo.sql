ALTER TABLE interests
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

DROP MATERIALIZED VIEW IF EXISTS interests_search;

CREATE MATERIALIZED VIEW interests_search AS
SELECT
  id,
  name,
  organization,
  role,
  country,
  city,
  website,
  CASE WHEN share_email THEN email ELSE NULL END AS email,
  message,
  is_demo,
  created_at,
  to_tsvector('simple', concat_ws(' ', name, organization, role, country, city, website, message)) AS document
FROM interests
WHERE public_listing = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS interests_search_id_idx ON interests_search (id);
CREATE INDEX IF NOT EXISTS interests_search_document_idx ON interests_search USING GIN (document);
