import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { config } from '../src/config';
import type { EvidenceEntry } from '../src/db/evidence';
import { registerEvidenceRoutes } from '../src/routes/evidence';
import { registerFederationRoutes } from '../src/routes/federation';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerPaymentRoutes } from '../src/routes/payments';

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

describe('api key guard on write routes', () => {
  it('blocks loop writes without api key', async () => {
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material',
      payload: materialPayload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
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
