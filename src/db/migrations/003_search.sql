CREATE MATERIALIZED VIEW IF NOT EXISTS interests_search AS
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
  created_at,
  to_tsvector('simple', concat_ws(' ', name, organization, role, country, city, website, message)) AS document
FROM interests
WHERE public_listing = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS interests_search_id_idx ON interests_search (id);
CREATE INDEX IF NOT EXISTS interests_search_document_idx ON interests_search USING GIN (document);
