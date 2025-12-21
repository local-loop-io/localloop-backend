import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { config } from '../src/config';
import { registerFederationRoutes } from '../src/routes/federation';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerPaymentRoutes } from '../src/routes/payments';

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

const handshakePayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'NodeHandshake',
  schema_version: '0.1.1',
  node_id: 'node-a',
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
    await registerLoopRoutes(app, {
      insertLoopMaterial: async () => ({ id: materialPayload.id, created_at: new Date().toISOString() }),
      insertLoopOffer: async () => ({ id: 'offer', created_at: new Date().toISOString() }),
      insertLoopMatch: async () => ({ id: 'match', created_at: new Date().toISOString() }),
      insertLoopTransfer: async () => ({ id: 'transfer', created_at: new Date().toISOString() }),
      insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
      listLoopEvents: async () => ([]),
      getLoopMaterial: async () => ({ id: materialPayload.id }),
      getLoopOffer: async () => ({ id: 'offer', material_id: materialPayload.id }),
      getLoopMatch: async () => ({ id: 'match', material_id: materialPayload.id, offer_id: 'offer' }),
      broadcastLoopEvent: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/loop/materials',
      payload: materialPayload,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('blocks federation handshake without api key', async () => {
    const app = Fastify({ logger: false });
    await registerFederationRoutes(app, {
      listFederationNodes: async () => ([]),
      insertFederationHandshake: async () => ({ id: 1, created_at: new Date().toISOString() }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/federation/handshake',
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
});
