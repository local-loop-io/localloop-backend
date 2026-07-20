import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerCityRoutes } from '../src/routes/cities';
import { registerInterestRoutes } from '../src/routes/interest';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { specErrorCodeForStatus } from '../src/specErrors';

/**
 * §8.3 error-envelope coverage for the surfaces migrated off the legacy flat
 * `{ error: "message" }` shape: legacy lab routes, plus the global handlers
 * (404 + Fastify schema-validation rejections) via buildServer.
 */

describe('specErrorCodeForStatus', () => {
  it('maps canonical statuses to their §8.3 codes', () => {
    expect(specErrorCodeForStatus(400)).toBe('INVALID_REQUEST');
    expect(specErrorCodeForStatus(401)).toBe('UNAUTHORIZED');
    expect(specErrorCodeForStatus(403)).toBe('FORBIDDEN');
    expect(specErrorCodeForStatus(404)).toBe('NOT_FOUND');
    expect(specErrorCodeForStatus(409)).toBe('CONFLICT');
    expect(specErrorCodeForStatus(500)).toBe('INTERNAL_ERROR');
  });

  it('falls back to the nearest canonical code for statuses outside the §8.3 set', () => {
    expect(specErrorCodeForStatus(415)).toBe('INVALID_REQUEST');
    expect(specErrorCodeForStatus(429)).toBe('INVALID_REQUEST');
    expect(specErrorCodeForStatus(503)).toBe('INTERNAL_ERROR');
  });
});

const offerPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'Offer',
  schema_version: '0.1.1',
  id: 'OFR-2F7A6B9C',
  material_id: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  from_city: 'Munich',
  to_city: 'Berlin',
  quantity: { value: 80, unit: 'kg' },
  status: 'open',
  available_until: '2025-06-05T10:00:00Z',
};

const buildLoopApp = () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const record = { id: 'x', created_at: new Date().toISOString() };
  const deps = {
    createLoopMaterial: async () => ({ ...record, event: { type: 'material.created', entity: 'material', entity_id: 'x', data: {}, created_at: record.created_at } }),
    createLoopProduct: async () => ({ ...record, event: { type: 'product.created', entity: 'product', entity_id: 'x', data: {}, created_at: record.created_at } }),
    createLoopOffer: async () => ({ ...record, event: { type: 'offer.created', entity: 'offer', entity_id: 'x', data: {}, created_at: record.created_at } }),
    createLoopMatch: async () => ({ ...record, event: { type: 'match.created', entity: 'match', entity_id: 'x', data: {}, created_at: record.created_at } }),
    createLoopTransfer: async () => ({ ...record, event: { type: 'transfer.created', entity: 'transfer', entity_id: 'x', data: {}, created_at: record.created_at } }),
    insertLoopEvent: async () => ({ id: 1, created_at: record.created_at }),
    listLoopEvents: async () => [],
    getLoopMaterial: async () => undefined,
    getLoopMaterialById: async () => undefined,
    listLoopMaterials: async () => [],
    getLoopProduct: async () => undefined,
    getLoopProductById: async () => undefined,
    listLoopProducts: async () => [],
    getLoopOffer: async () => undefined,
    getLoopOfferById: async () => undefined,
    listLoopOffers: async () => [],
    getLoopMatch: async () => undefined,
    getLoopMatchById: async () => undefined,
    listLoopMatches: async () => [],
    getLoopTransferById: async () => undefined,
    listLoopTransfers: async () => [],
    searchLoopMaterials: async () => ({ results: [] }),
    searchLoopProducts: async () => ({ results: [] }),
    searchLoopMaterialsProtocol: async () => ({ results: [], total: 0 }),
    broadcastLoopEvent: () => undefined,
  };

  return { app, deps };
};

describe('§8.3 envelope on legacy lab routes', () => {
  it('returns NOT_FOUND envelope for a missing loop entity', async () => {
    const { app, deps } = buildLoopApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/v1/material/MAT-MISSING' });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('returns CONFLICT envelope on a duplicate write', async () => {
    const { app, deps } = buildLoopApp();
    const conflict = new Error('duplicate key value violates unique constraint');
    (conflict as Error & { code?: string }).code = '23505';
    await registerLoopRoutes(app, {
      ...deps,
      createLoopMaterial: async () => {
        throw conflict;
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: {
        '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
        '@type': 'MaterialDNA',
        schema_version: '0.1.1',
        id: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
        category: 'plastic-pet',
        quantity: { value: 100, unit: 'kg' },
        origin_city: 'Munich',
        current_city: 'Munich',
        available_from: '2025-06-01T10:00:00Z',
      },
    });
    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body).toEqual({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
  });

  it('returns INVALID_REQUEST envelope for an offer referencing an unknown material', async () => {
    const { app, deps } = buildLoopApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({ method: 'POST', url: '/api/v1/offer', payload: offerPayload });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toEqual({ error: { code: 'INVALID_REQUEST', message: 'Unknown material_id' } });
  });

  it('returns INVALID_REQUEST envelope for invalid city filters', async () => {
    const app = Fastify({ logger: false });
    await registerCityRoutes(app, {
      listCities: async () => [],
      listCitiesGeoJson: async () => ({ type: 'FeatureCollection' as const, features: [] }),
      getCity: async () => null,
    });

    const response = await app.inject({ method: 'GET', url: '/api/cities?bbox=1,2,3' });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'bbox must be four comma-separated numbers.' },
    });
  });

  it('returns NOT_FOUND envelope for an unknown city slug', async () => {
    const app = Fastify({ logger: false });
    await registerCityRoutes(app, {
      listCities: async () => [],
      listCitiesGeoJson: async () => ({ type: 'FeatureCollection' as const, features: [] }),
      getCity: async () => null,
    });

    const response = await app.inject({ method: 'GET', url: '/api/cities/nope' });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('returns INVALID_REQUEST envelope with validation details for invalid interest submissions', async () => {
    const app = Fastify({ logger: false });
    await registerInterestRoutes(app, {
      insertInterest: async () => ({ id: 1, created_at: new Date().toISOString() }),
      listInterests: async () => [],
      countInterests: async () => 0,
      enqueueInterest: async () => undefined,
      broadcastInterest: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/interest',
      // Passes the Fastify body schema, fails zod (website must be a URL), so
      // the rejection comes from the route handler's own validation.
      payload: { name: 'Jane Doe', consentPublic: true, website: 'not-a-url' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toBe('Invalid request');
    expect(body.error.details.validation).toBeDefined();
  });
});

describe('§8.3 envelope on global handlers', () => {
  it('returns NOT_FOUND envelope for unmatched routes', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    } finally {
      await app.close();
    }
  });

  it('returns INVALID_REQUEST envelope for Fastify schema-validation rejections', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/interest',
        payload: { name: 'Jane Doe', consentPublic: 'yes' },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REQUEST');
      expect(typeof body.error.message).toBe('string');
    } finally {
      await app.close();
    }
  });
});
