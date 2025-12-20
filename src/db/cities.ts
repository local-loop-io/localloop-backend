import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

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
  where: Prisma.Sql;
  orderBy: Prisma.Sql;
  distanceExpr: Prisma.Sql;
};

const buildQueryParts = (filters: CityFilters = {}): QueryParts => {
  const clauses: Prisma.Sql[] = [];
  let orderBy = Prisma.sql`ORDER BY created_at DESC`;
  let distanceExpr = Prisma.sql`NULL`;

  if (filters.bbox) {
    const { minLon, minLat, maxLon, maxLat } = filters.bbox;
    clauses.push(
      Prisma.sql`ST_Within(center, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326))`
    );
  }

  if (filters.near) {
    const { lon, lat, radiusKm } = filters.near;
    const pointExpr = Prisma.sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
    clauses.push(
      Prisma.sql`ST_DWithin(center::geography, ${pointExpr}::geography, ${radiusKm * 1000})`
    );
    distanceExpr = Prisma.sql`ST_Distance(center::geography, ${pointExpr}::geography)`;
    orderBy = Prisma.sql`ORDER BY ${distanceExpr} ASC`;
  }

  return {
    where: clauses.length
      ? Prisma.sql`WHERE ${Prisma.join(clauses, Prisma.raw(' AND '))}`
      : Prisma.empty,
    orderBy,
    distanceExpr,
  };
};

export async function listCities(filters: CityFilters = {}) {
  const limit = filters.limit ?? 100;
  const { where, orderBy } = buildQueryParts(filters);

  const query = Prisma.sql`
    SELECT slug, name, country, ST_AsGeoJSON(center) AS center, created_at
    FROM cities
    ${where}
    ${orderBy}
    LIMIT ${limit};
  `;

  const result = await prisma.$queryRaw<{
    slug: string;
    name: string;
    country: string | null;
    center: string | null;
    created_at: string | Date;
  }[]>(query);

  return result.map((row) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    center: row.center ? JSON.parse(row.center) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
}

export async function listCitiesGeoJson(filters: CityFilters = {}) {
  const limit = filters.limit ?? 100;
  const { where, orderBy, distanceExpr } = buildQueryParts(filters);

  const query = Prisma.sql`
    SELECT json_build_object(
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
    ${orderBy}
    LIMIT ${limit};
  `;

  const result = await prisma.$queryRaw<{ feature: CityGeoFeature }[]>(query);

  return {
    type: 'FeatureCollection' as const,
    features: result.map((row) => row.feature),
  };
}

export async function getCity(slug: string) {
  const query = Prisma.sql`
    SELECT slug, name, country, ST_AsGeoJSON(center) AS center, created_at
    FROM cities
    WHERE slug = ${slug};
  `;

  const result = await prisma.$queryRaw<{
    slug: string;
    name: string;
    country: string | null;
    center: string | null;
    created_at: string | Date;
  }[]>(query);

  const row = result[0];
  if (!row) return null;

  return {
    slug: row.slug,
    name: row.name,
    country: row.country,
    center: row.center ? JSON.parse(row.center) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}
