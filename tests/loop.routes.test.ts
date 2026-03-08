import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';

const materialPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'MaterialDNA',
  schema_version: '0.1.1',
  id: 'DE-MUC-2025-PLASTIC-B847F3',
  category: 'plastic-pet',
  quantity: { value: 100, unit: 'kg' },
  origin_city: 'Munich',
  current_city: 'Munich',
  available_from: '2025-06-01T10:00:00Z',
};

const offerPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'Offer',
  schema_version: '0.1.1',
  id: 'OFR-2F7A6B9C',
  material_id: materialPayload.id,
  from_city: 'Munich',
  to_city: 'Berlin',
  quantity: { value: 80, unit: 'kg' },
  status: 'open',
  available_until: '2025-06-05T10:00:00Z',
};

const matchPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'Match',
  schema_version: '0.1.1',
  id: 'MCH-9B3C8A12',
  material_id: materialPayload.id,
  offer_id: offerPayload.id,
  from_city: 'Munich',
  to_city: 'Berlin',
  status: 'accepted',
  matched_at: '2025-06-02T12:15:00Z',
};

const transferPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'Transfer',
  schema_version: '0.1.1',
  id: 'TRF-5D8A23F1',
  material_id: materialPayload.id,
  match_id: matchPayload.id,
  status: 'completed',
  handoff_at: '2025-06-02T14:00:00Z',
  received_at: '2025-06-02T18:00:00Z',
};

const productPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'ProductDNA',
  schema_version: '0.2.0',
  id: 'PRD-DE-MUC-2025-DESK-F4A7B2',
  product_category: 'furniture-office',
  name: 'Standing Desk — Ergotron WorkFit',
  condition: 'good',
  quantity: { value: 12, unit: 'piece' },
  origin_city: 'Munich',
  current_city: 'Munich',
  available_from: '2026-03-15T08:00:00Z',
};

const productOfferPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'Offer',
  schema_version: '0.2.0',
  id: 'OFR-PRD-8C4F2A1B',
  product_id: productPayload.id,
  from_city: 'Munich',
  to_city: 'Berlin',
  quantity: { value: 12, unit: 'piece' },
  status: 'open',
  available_until: '2026-03-20T18:00:00Z',
};

const productMatchPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'Match',
  schema_version: '0.2.0',
  id: 'MCH-PRD-3D7E9F45',
  product_id: productPayload.id,
  offer_id: productOfferPayload.id,
  from_city: 'Munich',
  to_city: 'Berlin',
  status: 'accepted',
  matched_at: '2026-03-16T14:30:00Z',
};

const productTransferPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'Transfer',
  schema_version: '0.2.0',
  id: 'TRF-PRD-1A5B8C2D',
  product_id: productPayload.id,
  match_id: productMatchPayload.id,
  status: 'completed',
  handoff_at: '2026-03-18T09:00:00Z',
  received_at: '2026-03-18T17:30:00Z',
};

const materialStatusPayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'MaterialStatusUpdate',
  schema_version: '0.1.1',
  id: '3c9a6a0b-8c1a-4d3f-9c2c-3c1c2f9d5c2a',
  material_id: materialPayload.id,
  status: 'reserved',
  updated_at: '2025-06-03T09:15:00Z',
  reason: 'Reserved by city exchange',
  notes: 'Holding until pickup is confirmed',
  source_node: 'lab-hub.loop',
  metadata: { ticket: 'LAB-42' },
};

const buildApp = () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const deps = {
    insertLoopMaterial: async () => ({ id: materialPayload.id, created_at: new Date().toISOString() }),
    insertLoopProduct: async () => ({ id: productPayload.id, created_at: new Date().toISOString() }),
    insertLoopOffer: async (_p: { id: string }) => ({ id: _p.id, created_at: new Date().toISOString() }),
    insertLoopMatch: async (_p: { id: string }) => ({ id: _p.id, created_at: new Date().toISOString() }),
    insertLoopTransfer: async (_p: { id: string }) => ({ id: _p.id, created_at: new Date().toISOString() }),
    insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    listLoopEvents: async () => ([{ id: 1, event_type: 'material.created', entity_type: 'material', entity_id: materialPayload.id, payload: {}, created_at: new Date().toISOString() }]),
    getLoopMaterial: async (id: string) => (id === materialPayload.id ? { id } : undefined),
    getLoopProduct: async (id: string) => (id === productPayload.id ? { id } : undefined),
    getLoopOffer: async (id: string) => {
      if (id === offerPayload.id) return { id, material_id: materialPayload.id, product_id: null };
      if (id === productOfferPayload.id) return { id, material_id: null, product_id: productPayload.id };
      return undefined;
    },
    getLoopMatch: async (id: string) => {
      if (id === matchPayload.id) return { id, material_id: materialPayload.id, product_id: null, offer_id: offerPayload.id };
      if (id === productMatchPayload.id) return { id, material_id: null, product_id: productPayload.id, offer_id: productOfferPayload.id };
      return undefined;
    },
    broadcastLoopEvent: () => undefined,
  };

  return { app, deps };
};

describe('loop routes', () => {
  it('creates material, offer, match, and transfer', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const materialResponse = await app.inject({ method: 'POST', url: '/api/v1/material', payload: materialPayload });
    expect(materialResponse.statusCode).toBe(201);

    const offerResponse = await app.inject({ method: 'POST', url: '/api/v1/offer', payload: offerPayload });
    expect(offerResponse.statusCode).toBe(201);

    const matchResponse = await app.inject({ method: 'POST', url: '/api/v1/match', payload: matchPayload });
    expect(matchResponse.statusCode).toBe(201);

    const transferResponse = await app.inject({ method: 'POST', url: '/api/v1/transfer', payload: transferPayload });
    expect(transferResponse.statusCode).toBe(201);
  });

  it('records material status updates', async () => {
    const { app, deps } = buildApp();
    const calls: { event?: { event_type: string; entity_type: string; entity_id: string } } = {};
    await registerLoopRoutes(app, {
      ...deps,
      insertLoopEvent: async (input) => {
        calls.event = input;
        return { id: 3, created_at: new Date().toISOString() };
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material-status',
      payload: materialStatusPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(calls.event?.event_type).toBe('material.status_updated');
    expect(calls.event?.entity_type).toBe('material');
    expect(calls.event?.entity_id).toBe(materialPayload.id);
  });

  it('rejects offers for unknown materials', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, { ...deps, getLoopMaterial: async () => undefined });

    const response = await app.inject({ method: 'POST', url: '/api/v1/offer', payload: offerPayload });
    expect(response.statusCode).toBe(400);
  });

  it('fails fast on invalid payloads', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: { id: 'DE-MUC-2025-PLASTIC-B847F3' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects status updates for unknown materials', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, { ...deps, getLoopMaterial: async () => undefined });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material-status',
      payload: materialStatusPayload,
    });
    expect(response.statusCode).toBe(400);
  });

  it('lists loop events', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/v1/events' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.results.length).toBeGreaterThan(0);
  });

  it('relays loop events', async () => {
    const { app, deps } = buildApp();
    const calls: { event?: { event_type: string; entity_type: string; entity_id: string } } = {};
    await registerLoopRoutes(app, {
      ...deps,
      insertLoopEvent: async (input) => {
        calls.event = input;
        return { id: 2, created_at: new Date().toISOString() };
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/relay',
      payload: {
        event_type: 'material.created',
        entity_type: 'material',
        entity_id: materialPayload.id,
        payload: { hello: 'world' },
        source_node: 'node-a',
      },
    });

    expect(response.statusCode).toBe(202);
    expect(calls.event?.event_type).toBe('material.created');
  });

  it('accepts the canonical linked-data content type', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      headers: {
        'content-type': 'application/ld+json',
      },
      payload: JSON.stringify(materialPayload),
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects personal contact data in minimal interop payloads', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: {
        ...materialPayload,
        contact: {
          email: 'pii@example.com',
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepts additive patch-line schema versions', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: {
        ...materialPayload,
        schema_version: '0.1.2',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('maps duplicate writes to conflicts', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, {
      ...deps,
      insertLoopMaterial: async () => {
        const error = new Error('duplicate key value violates unique constraint');
        (error as Error & { code?: string }).code = '23505';
        throw error;
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: materialPayload,
    });

    expect(response.statusCode).toBe(409);
  });

  it('creates product, offer, match, and transfer with product_id', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const prodResponse = await app.inject({ method: 'POST', url: '/api/v1/product', payload: productPayload });
    expect(prodResponse.statusCode).toBe(201);

    const offerResponse = await app.inject({ method: 'POST', url: '/api/v1/offer', payload: productOfferPayload });
    expect(offerResponse.statusCode).toBe(201);

    const matchResponse = await app.inject({ method: 'POST', url: '/api/v1/match', payload: productMatchPayload });
    expect(matchResponse.statusCode).toBe(201);

    const transferResponse = await app.inject({ method: 'POST', url: '/api/v1/transfer', payload: productTransferPayload });
    expect(transferResponse.statusCode).toBe(201);
  });

  it('rejects offers for unknown products', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, { ...deps, getLoopProduct: async () => undefined });

    const response = await app.inject({ method: 'POST', url: '/api/v1/offer', payload: productOfferPayload });
    expect(response.statusCode).toBe(400);
  });

  it('rejects product with invalid payload', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/product',
      payload: { id: 'PRD-INVALID' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('maps duplicate product writes to conflicts', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, {
      ...deps,
      insertLoopProduct: async () => {
        const error = new Error('duplicate key value violates unique constraint');
        (error as Error & { code?: string }).code = '23505';
        throw error;
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/product',
      payload: productPayload,
    });

    expect(response.statusCode).toBe(409);
  });
});
