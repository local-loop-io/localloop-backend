import { pool } from './pool';

export type CityRecord = {
  slug: string;
  name: string;
  country: string | null;
  center: { type: string; coordinates: [number, number] } | null;
  created_at: string;
};

export async function listCities() {
  const result = await pool.query<{
    slug: string;
    name: string;
    country: string | null;
    center: string | null;
    created_at: string;
  }>(
    `SELECT slug, name, country, ST_AsGeoJSON(center) AS center, created_at
     FROM cities
     ORDER BY created_at DESC;`
  );

  return result.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    center: row.center ? JSON.parse(row.center) : null,
    created_at: row.created_at,
  }));
}

export async function getCity(slug: string) {
  const result = await pool.query<{
    slug: string;
    name: string;
    country: string | null;
    center: string | null;
    created_at: string;
  }>(
    `SELECT slug, name, country, ST_AsGeoJSON(center) AS center, created_at
     FROM cities
     WHERE slug = $1;`,
    [slug]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    slug: row.slug,
    name: row.name,
    country: row.country,
    center: row.center ? JSON.parse(row.center) : null,
    created_at: row.created_at,
  };
}
