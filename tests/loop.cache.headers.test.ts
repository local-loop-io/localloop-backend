import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { fakeInsertLoopEvidence } from './testEvidence';

const materialPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'MaterialDNA',
  schema_version: '0.1.1',
  id: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  category: 'plastic-pet',
  quantity: { value: 100, unit: 'kg' },
  origin_city: 'Munich',
  current_city: 'Munich',
  available_from: '2025-06-01T10:00:00Z',
};

const offerPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'Transfer',
  schema_version: '0.1.1',
  id: 'TRF-5D8A23F1',
  material_id: materialPayload.id,
  match_id: matchPayload.id,
  status: 'completed',
  handoff_at: '2025-06-02T14:00:00Z',
  received_at: '2025-06-02T18:00:00Z',
};

const materialStatusPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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

const productPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
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

const relayPayload = {
  event_type: 'material.created',
  entity_type: 'material',
  entity_id: materialPayload.id,
  payload: { hello: 'world' },
  source_node: 'node-a',
};

const eventFor = (type: string, entity: string, entity_id: string, data: unknown) => ({
  type,
  entity,
  entity_id,
  data,
  created_at: new Date().toISOString(),
});

const buildApp = async () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const deps = {
    createLoopMaterial: async (payload: { id: string }) => ({
      id: payload.id,
      created_at: new Date().toISOString(),
      event: eventFor('material.created', 'material', payload.id, payload),
    }),
    createLoopProduct: async (payload: { id: string }) => ({
      id: payload.id,
      created_at: new Date().toISOString(),
      event: eventFor('product.created', 'product', payload.id, payload),
    }),
    createLoopOffer: async (payload: { id: string }) => ({
      id: payload.id,
      created_at: new Date().toISOString(),
      event: eventFor('offer.created', 'offer', payload.id, payload),
    }),
    createLoopMatch: async (payload: { id: string }) => ({
      id: payload.id,
      created_at: new Date().toISOString(),
      event: eventFor('match.created', 'match', payload.id, payload),
    }),
    createLoopTransfer: async (payload: { id: string }) => ({
      id: payload.id,
      created_at: new Date().toISOString(),
      event: eventFor('transfer.created', 'transfer', payload.id, payload),
    }),
    insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    insertLoopEvidence: fakeInsertLoopEvidence,
    listLoopEvents: async () => [],
    getLoopMaterial: async (id: string) => (id === materialPayload.id ? { id } : undefined),
    getLoopMaterialById: async () => undefined,
    listLoopMaterials: async () => [],
    getLoopProduct: async () => undefined,
    getLoopProductById: async () => undefined,
    listLoopProducts: async () => [],
    getLoopOffer: async (id: string) => (id === offerPayload.id ? { id, material_id: materialPayload.id, product_id: null, status: 'open' } : undefined),
    getLoopOfferById: async () => undefined,
    listLoopOffers: async () => [],
    getLoopMatch: async (id: string) => (id === matchPayload.id ? { id, material_id: materialPayload.id, product_id: null, offer_id: offerPayload.id, status: 'accepted' } : undefined),
    getLoopMatchById: async () => undefined,
    listLoopMatches: async () => [],
    getLoopTransferById: async () => undefined,
    listLoopTransfers: async () => [],
    searchLoopMaterials: async () => ({ results: [] }),
    searchLoopProducts: async () => ({ results: [] }),
    searchLoopMaterialsProtocol: async () => ({ results: [], total: 0 }),
    broadcastLoopEvent: () => undefined,
  };

  await registerLoopRoutes(app, deps);
  return app;
};

describe('loop write routes Cache-Control', () => {
  it.each([
    ['/api/v1/material', materialPayload, 201],
    ['/api/v1/offer', offerPayload, 201],
    ['/api/v1/match', matchPayload, 201],
    ['/api/v1/transfer', transferPayload, 201],
    ['/api/v1/material-status', materialStatusPayload, 201],
    ['/api/v1/product', productPayload, 201],
    ['/api/v1/relay', relayPayload, 202],
  ])('returns no-store on POST %s', async (url, payload, expectedStatus) => {
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url, payload });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('loop read and search routes Cache-Control', () => {
  it.each([
    ['GET', '/api/v1/material', undefined, 200],
    ['GET', '/api/v1/events', undefined, 200],
    ['GET', '/api/v1/product', undefined, 200],
    ['GET', '/api/v1/offer', undefined, 200],
    ['GET', '/api/v1/match', undefined, 200],
    ['GET', '/api/v1/transfer', undefined, 200],
    ['POST', '/api/v1/material/search', { limit: 10 }, 200],
    ['POST', '/api/v1/product/search', { limit: 10 }, 200],
  ] as const)('returns no-store on %s %s', async (method, url, payload, expectedStatus) => {
    const app = await buildApp();
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
