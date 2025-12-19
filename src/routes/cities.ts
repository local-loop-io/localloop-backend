import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { getCity, listCities, listCitiesGeoJson } from '../db/cities';

type CityFilters = {
  limit: number;
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

const citySchema = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    country: { type: ['string', 'null'] },
    center: { type: ['object', 'null'] },
    created_at: { type: 'string' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

const geoJsonSchema = {
  type: 'object',
  properties: {
    type: { const: 'FeatureCollection' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { const: 'Feature' },
          geometry: { type: ['object', 'null'] },
          properties: { type: 'object' },
        },
      },
    },
  },
};

const MAX_RADIUS_KM = 500;
const DEFAULT_RADIUS_KM = 50;

type CityDeps = {
  listCities: typeof listCities;
  listCitiesGeoJson: typeof listCitiesGeoJson;
  getCity: typeof getCity;
};

const defaultDeps: CityDeps = {
  listCities,
  listCitiesGeoJson,
  getCity,
};

const parseNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const isValidLon = (value: number) => value >= -180 && value <= 180;
const isValidLat = (value: number) => value >= -90 && value <= 90;

const parseBbox = (value: string | undefined) => {
  if (!value) return { ok: true as const, value: null };
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return { ok: false as const, error: 'bbox must be four comma-separated numbers.' };
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (!isValidLon(minLon) || !isValidLon(maxLon) || !isValidLat(minLat) || !isValidLat(maxLat)) {
    return { ok: false as const, error: 'bbox coordinates must be valid lon/lat values.' };
  }
  if (minLon > maxLon || minLat > maxLat) {
    return { ok: false as const, error: 'bbox min values must be less than max values.' };
  }
  return { ok: true as const, value: { minLon, minLat, maxLon, maxLat } };
};

const parseNear = (value: string | undefined, radiusKm: number) => {
  if (!value) return { ok: true as const, value: null };
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
    return { ok: false as const, error: 'near must be "lon,lat".' };
  }
  const [lon, lat] = parts;
  if (!isValidLon(lon) || !isValidLat(lat)) {
    return { ok: false as const, error: 'near coordinates must be valid lon/lat values.' };
  }
  if (radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
    return { ok: false as const, error: `radiusKm must be between 1 and ${MAX_RADIUS_KM}.` };
  }
  return { ok: true as const, value: { lon, lat, radiusKm } };
};

const parseFilters = (query: Record<string, string | undefined>) => {
  const rawLimit = parseNumber(query.limit);
  if (query.limit && rawLimit === null) {
    return { ok: false as const, error: 'limit must be a number.' };
  }

  const limit = rawLimit && rawLimit > 0
    ? Math.min(rawLimit, config.publicLimit)
    : config.publicLimit;

  const radiusValue = parseNumber(query.radiusKm);
  if (query.radiusKm && radiusValue === null) {
    return { ok: false as const, error: 'radiusKm must be a number.' };
  }
  const radiusKm = radiusValue ?? DEFAULT_RADIUS_KM;

  const bboxResult = parseBbox(query.bbox);
  if (!bboxResult.ok) {
    return { ok: false as const, error: bboxResult.error };
  }

  const nearResult = parseNear(query.near, radiusKm);
  if (!nearResult.ok) {
    return { ok: false as const, error: nearResult.error };
  }

  const filters: CityFilters = {
    limit,
    bbox: bboxResult.value ?? undefined,
    near: nearResult.value ?? undefined,
  };

  return { ok: true as const, value: filters };
};

export async function registerCityRoutes(app: FastifyInstance, deps: CityDeps = defaultDeps) {
  app.get('/api/cities', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            results: { type: 'array', items: citySchema },
          },
        },
        400: errorResponseSchema,
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' },
          bbox: { type: 'string' },
          near: { type: 'string' },
          radiusKm: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = parseFilters(request.query as Record<string, string | undefined>);
    if (!parsed.ok) {
      reply.code(400).send({ error: parsed.error });
      return;
    }

    const results = await deps.listCities(parsed.value);
    return { results };
  });

  app.get('/api/cities/:slug', {
    schema: {
      response: {
        200: citySchema,
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const city = await deps.getCity(slug);
    if (!city) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    return city;
  });

  app.get('/api/cities/geojson', {
    schema: {
      response: {
        200: geoJsonSchema,
        400: errorResponseSchema,
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' },
          bbox: { type: 'string' },
          near: { type: 'string' },
          radiusKm: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = parseFilters(request.query as Record<string, string | undefined>);
    if (!parsed.ok) {
      reply.code(400).send({ error: parsed.error });
      return;
    }

    return deps.listCitiesGeoJson(parsed.value);
  });
}
