import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { config } from '../src/config';
import type { EvidenceEntry } from '../src/db/evidence';
import { registerEvidenceRoutes } from '../src/routes/evidence';
import { registerFederateRoutes } from '../src/routes/federate';
import { registerFederationRoutes } from '../src/routes/federation';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerPaymentRoutes } from '../src/routes/payments';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerTransactionRoutes } from '../src/routes/transactions';

const evidenceEntry: EvidenceEntry = {
  event_id: 'evt_apikey_test_0000000000000001',
  sequence: 1,
  recorded_at: '2026-07-19T16:00:00.000Z',
  node_id: 'lab-hub.loop',
  subject: { type: 'material', id: 'MAT-DE-MUC-2025-APIKEY-TEST' },
  event_type: 'registered',
  immutable: {
    event_id: 'evt_apikey_test_0000000000000001',
    sequence: 1,
    subject: { type: 'material', id: 'MAT-DE-MUC-2025-APIKEY-TEST' },
    event_type: 'registered',
    payload_hash_sha256: 'b'.repeat(64),
  },
  payload_hash_sha256: 'b'.repeat(64),
  retention: {
    retain_until: '2028-07-19T16:00:00.000Z',
    exportable: true,
    redaction_status: 'none',
  },
};

const original = {
  enabled: config.auth.apiKeyEnabled,
  key: config.auth.apiKey,
};

beforeEach(() => {
  config.auth.apiKeyEnabled = true;
  config.auth.apiKey = 'secret';
});

afterEach(() => {
  config.auth.apiKeyEnabled = original.enabled;
  config.auth.apiKey = original.key;
});

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

const relayPayload = {
  event_type: 'material.created',
  entity_type: 'material',
  entity_id: materialPayload.id,
  payload: { hello: 'world' },
  source_node: 'node-a',
};

const handshakePayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'NodeHandshake',
  schema_version: '0.1.1',
  node_id: 'node-a.loop',
  name: 'Node A',
  endpoint: 'https://node-a.example.com',
  capabilities: ['material-registry'],
  timestamp: '2025-06-01T10:00:00Z',
};

const paymentPayload = {
  name: 'Example Partner',
  amount: 25,
  currency: 'EUR',
};

const materialTransactionPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialTransaction',
  schema_version: '0.2.0',
  id: 'TXN-2026-07-19-001',
  material: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  seller: 'munich.loop',
  buyer: 'berlin.loop',
  offer: {
    base_price: 120,
    loop_cost: 156,
    breakdown: { export_penalty: 24, import_penalty: 0, distance_cost: 12 },
  },
  timestamp: '2026-07-19T16:00:00Z',
};

const federateAnnouncementPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialAnnouncement',
  material: 'MAT-DE-MUC-2025-FOOD-B847F3',
  origin: 'munich.loop',
  available: true,
};

const federateOfferPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialOffer',
  material: 'MAT-DE-MUC-2025-FOOD-B847F3',
  from: 'vienna.loop',
  base_price: 60,
  loop_cost: 104,
  valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const federateNodeHeaders = () => ({
  'x-node-id': 'munich.loop',
  'x-node-signature': 'lab-signature-placeholder',
  'x-timestamp': new Date().toISOString(),
});

const federateThrowingDeps = () => ({
  insertLoopEvent: async () => {
    throw new Error('insertLoopEvent must not be called when auth guards reject');
  },
  getLoopMaterial: async () => {
    throw new Error('getLoopMaterial must not be called when auth guards reject');
  },
  broadcastLoopEvent: () => {
    throw new Error('broadcastLoopEvent must not be called when auth guards reject');
  },
});

const buildLoopApp = async () => {
  const app = Fastify({ logger: false });
  registerLoopSchemas(app);
  const now = new Date().toISOString();
  await registerLoopRoutes(app, {
    createLoopMaterial: async () => ({ id: materialPayload.id, created_at: now, event: {} }),
    createLoopProduct: async () => ({ id: 'product', created_at: now, event: {} }),
    createLoopOffer: async () => ({ id: 'offer', created_at: now, event: {} }),
    createLoopMatch: async () => ({ id: 'match', created_at: now, event: {} }),
    createLoopTransfer: async () => ({ id: 'transfer', created_at: now, event: {} }),
    insertLoopEvent: async () => ({ id: 1, created_at: now }),
    listLoopEvents: async () => ([]),
    getLoopMaterial: async () => ({ id: materialPayload.id }),
    getLoopMaterialById: async () => undefined,
    listLoopMaterials: async () => ([]),
    getLoopProduct: async () => ({ id: 'product' }),
    getLoopProductById: async () => undefined,
    listLoopProducts: async () => ([]),
    getLoopOffer: async () => ({ id: 'offer', material_id: materialPayload.id, product_id: null, status: 'open' }),
    getLoopOfferById: async () => undefined,
    listLoopOffers: async () => ([]),
    getLoopMatch: async () => ({ id: 'match', material_id: materialPayload.id, product_id: null, offer_id: 'offer', status: 'accepted' }),
    getLoopMatchById: async () => undefined,
    listLoopMatches: async () => ([]),
    getLoopTransferById: async () => undefined,
    listLoopTransfers: async () => ([]),
    searchLoopMaterials: async () => ({ results: [] }),
    searchLoopProducts: async () => ({ results: [] }),
    searchLoopMaterialsProtocol: async () => ({ results: [], total: 0 }),
    broadcastLoopEvent: () => undefined,
  });
  return app;
};

describe('api key guard on write routes', () => {
  // Covers all 7 requireApiKey-protected routes in src/routes/loop.ts (material,
  // product, offer, match, transfer, material-status, relay) so a future refactor
  // that silently drops one of the requireApiKey calls fails a test instead of
  // going unnoticed.
  it.each([
    ['material', '/api/v1/material', materialPayload],
    ['product', '/api/v1/product', productPayload],
    ['offer', '/api/v1/offer', offerPayload],
    ['match', '/api/v1/match', matchPayload],
    ['transfer', '/api/v1/transfer', transferPayload],
    ['material-status', '/api/v1/material-status', materialStatusPayload],
    ['relay', '/api/v1/relay', relayPayload],
  ] as const)('blocks loop %s write without api key', async (_label, url, payload) => {
    const app = await buildLoopApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url,
        payload,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Unauthorized');
    } finally {
      await app.close();
    }
  });

  it('blocks federation handshake without api key', async () => {
    const app = Fastify({ logger: false });
    const now = new Date().toISOString();
    await registerFederationRoutes(app, {
      listNodes: async () => ([]),
      upsertNode: async (input) => ({
        ...input,
        last_seen: now,
        lab_only: true as const,
      }),
      getLocalNode: () => ({
        node_id: 'local-node',
        name: 'Local Node',
        endpoint: 'https://example.com',
        capabilities: [],
        last_seen: now,
        lab_only: true,
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federation/handshake',
      payload: handshakePayload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('blocks payment intent without api key', async () => {
    const app = Fastify({ logger: false });
    await registerPaymentRoutes(app, {
      insertPaymentIntent: async () => ({ id: 1, status: 'created', created_at: new Date().toISOString() }),
      insertPaymentWebhook: async () => ({ id: 1, created_at: new Date().toISOString() }),
    }, true);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/intent',
      payload: paymentPayload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('allows payment intent with api key', async () => {
    const app = Fastify({ logger: false });
    await registerPaymentRoutes(app, {
      insertPaymentIntent: async () => ({ id: 1, status: 'created', created_at: new Date().toISOString() }),
      insertPaymentWebhook: async () => ({ id: 1, created_at: new Date().toISOString() }),
    }, true);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/intent',
      headers: { 'x-api-key': 'secret' },
      payload: paymentPayload,
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it.each([
    ['announce', '/api/v1/federate/announce', federateAnnouncementPayload],
    ['offer', '/api/v1/federate/offer', federateOfferPayload],
  ] as const)('blocks federate %s without api key', async (_label, url, payload) => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    await registerFederateRoutes(app, federateThrowingDeps());

    const response = await app.inject({
      method: 'POST',
      url,
      headers: federateNodeHeaders(),
      payload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('blocks transaction POST without api key', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerTransactionRoutes(app, {
      createLoopTransaction: async () => {
        throw new Error('createLoopTransaction must not be called when auth guards reject');
      },
      getLoopTransactionById: async () => undefined,
      broadcastLoopEvent: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      payload: materialTransactionPayload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it.each([
    ['GET', `/api/v1/evidence/${evidenceEntry.event_id}`, undefined],
    ['GET', '/api/v1/evidence', undefined],
    [
      'POST',
      '/api/v1/evidence/search',
      { subject_type: 'material', limit: 10 },
    ],
  ] as const)('blocks evidence %s %s without api key', async (method, url, payload) => {
    const app = Fastify({ logger: false });
    await registerEvidenceRoutes(app, {
      getLoopEvidenceByEventId: async (eventId: string) =>
        (eventId === evidenceEntry.event_id ? evidenceEntry : undefined),
      listLoopEvidence: async () => ({ results: [evidenceEntry], next_cursor: undefined }),
    });

    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
