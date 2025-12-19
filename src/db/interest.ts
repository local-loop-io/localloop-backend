import { pool } from './pool';
import { config } from '../config';
import type { InterestInput } from '../validation';

export type InterestRecord = {
  id: number;
  name: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  message: string | null;
  created_at: string;
};

export async function refreshInterestSearch() {
  await pool.query('REFRESH MATERIALIZED VIEW interests_search');
}

export async function insertInterest(input: InterestInput) {
  const query = `
    INSERT INTO interests (
      name,
      organization,
      role,
      country,
      city,
      website,
      email,
      message,
      share_email,
      public_listing,
      consent_public
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)
    RETURNING id, created_at;
  `;

  const values = [
    input.name,
    input.organization ?? null,
    input.role ?? null,
    input.country ?? null,
    input.city ?? null,
    input.website ?? null,
    input.email ?? null,
    input.message ?? null,
    Boolean(input.shareEmail),
    true,
  ];

  const result = await pool.query<{ id: number; created_at: string }>(query, values);

  if (config.refreshSearchOnWrite) {
    await refreshInterestSearch();
  }

  return result.rows[0];
}

export async function listInterests(limit: number, search?: string) {
  if (search) {
    const query = `
      SELECT id, name, organization, role, country, city, website, email, message, created_at
      FROM interests_search
      WHERE document @@ plainto_tsquery('simple', $1)
      ORDER BY ts_rank(document, plainto_tsquery('simple', $1)) DESC, created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query<InterestRecord>(query, [search, limit]);
    return result.rows;
  }

  const query = `
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
      created_at
    FROM interests
    WHERE public_listing = TRUE
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const result = await pool.query<InterestRecord>(query, [limit]);
  return result.rows;
}

export async function countInterests(search?: string) {
  if (search) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM interests_search
      WHERE document @@ plainto_tsquery('simple', $1);
    `;
    const result = await pool.query<{ total: number }>(query, [search]);
    return result.rows[0]?.total ?? 0;
  }

  const result = await pool.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM interests WHERE public_listing = TRUE'
  );
  return result.rows[0]?.total ?? 0;
}
