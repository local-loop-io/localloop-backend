import { pool } from './pool';

export type CityRecord = {
  slug: string;
  name: string;
  country: string | null;
  center: { type: string; coordinates: [number, number] } | null;
  created_at: string;
};

export type CityGeoFeature = {
  type: 'Feature';
  geometry: { type: string; coordinates: [number, number] } | null;
  properties: {
    slug: string;
    name: string;
    country: string | null;
    created_at: string;
    distance_m: number | null;
  };
};

export type CityFilters = {
  limit?: number;
  bbox?: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
  near?: {
    lon: number;
    lat: number;
    radiusKm: number;
  };
};

type QueryParts = {
  where: string;
  values: Array<string | number>;
  orderBy: string;
  distanceExpr: string;
};

const buildQueryParts = (filters: CityFilters = {}): QueryParts => {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  let orderBy = 'created_at DESC';
  let distanceExpr = 'NULL';

  if (filters.bbox) {
    const { minLon, minLat, maxLon, maxLat } = filters.bbox;
    const minLonIndex = values.push(minLon);
    const minLatIndex = values.push(minLat);
    const maxLonIndex = values.push(maxLon);
    const maxLatIndex = values.push(maxLat);
    clauses.push(
      `ST_Within(center, ST_MakeEnvelope($${minLonIndex}, $${minLatIndex}, $${maxLonIndex}, $${maxLatIndex}, 4326))`
    );
  }

  if (filters.near) {
    const { lon, lat, radiusKm } = filters.near;
    const lonIndex = values.push(lon);
    const latIndex = values.push(lat);
    const radiusIndex = values.push(radiusKm * 1000);
    const pointExpr = `ST_SetSRID(ST_MakePoint($${lonIndex}, $${latIndex}), 4326)`;
    clauses.push(
      `ST_DWithin(center::geography, ${pointExpr}::geography, $${radiusIndex})`
    );
    orderBy = `ST_Distance(center::geography, ${pointExpr}::geography) ASC`;
    distanceExpr = `ST_Distance(center::geography, ${pointExpr}::geography)`;
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    orderBy,
    distanceExpr,
  };
};

export async function listCities(filters: CityFilters = {}) {
  const { where, values, orderBy } = buildQueryParts(filters);
  const limit = filters.limit ?? 100;
  const limitIndex = values.push(limit);

  const result = await pool.query<{
    slug: string;
    name: string;
    country: string | null;
    center: string | null;
    created_at: string;
  }>(
    `SELECT slug, name, country, ST_AsGeoJSON(center) AS center, created_at
     FROM cities
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${limitIndex};`,
    values
  );

  return result.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    center: row.center ? JSON.parse(row.center) : null,
    created_at: row.created_at,
  }));
}

export async function listCitiesGeoJson(filters: CityFilters = {}) {
  const { where, values, orderBy, distanceExpr } = buildQueryParts(filters);
  const limit = filters.limit ?? 100;
  const limitIndex = values.push(limit);

  const result = await pool.query<{ feature: CityGeoFeature }>(
    `SELECT json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(center)::json,
        'properties', json_build_object(
          'slug', slug,
          'name', name,
          'country', country,
          'created_at', created_at,
          'distance_m', ${distanceExpr}
        )
      ) AS feature
     FROM cities
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${limitIndex};`,
    values
  );

  return {
    type: 'FeatureCollection' as const,
    features: result.rows.map((row) => row.feature),
  };
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
