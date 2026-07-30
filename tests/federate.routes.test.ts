import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerFederateRoutes } from '../src/routes/federate';

const announcementPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialAnnouncement',
  material: 'MAT-DE-MUC-2025-FOOD-B847F3',
  origin: 'munich.loop',
  available: true,
};

const offerPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialOffer',
  material: 'MAT-DE-MUC-2025-FOOD-B847F3',
  from: 'vienna.loop',
  base_price: 60,
  loop_cost: 104,
  valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const nodeHeaders = () => ({
  'x-node-id': 'munich.loop',
  'x-node-signature': 'lab-signature-placeholder',
  'x-timestamp': new Date().toISOString(),
});

const buildApp = () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);

  const events: { event_type: string; entity_id: string; payload: unknown }[] = [];
  const deps = {
    insertLoopEvent: async (input: { event_type: string; entity_type: string; entity_id: string; payload: unknown }) => {
      events.push(input);
      return { id: events.length, created_at: new Date().toISOString() };
    },
    getLoopMaterial: async (id: string) => (id === offerPayload.material ? { id } : undefined),
    broadcastLoopEvent: () => undefined,
  };
  return { app, deps, events };
};

describe('POST /api/v1/federate/announce', () => {
  it('accepts a spec §8.2 MaterialAnnouncement with §9.2 node headers', async () => {
    const { app, deps, events } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: nodeHeaders(),
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('accepted');
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('federation.announcement');
    expect(events[0].entity_id).toBe(announcementPayload.material);
    expect((events[0].payload as { source_node: string }).source_node).toBe('munich.loop');
  });

  it('rejects requests without §9.2 node headers', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({ method: 'POST', url: '/api/v1/federate/announce', payload: announcementPayload });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects stale X-Timestamp values (±5 minute tolerance)', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-timestamp': new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejects malformed X-Timestamp values', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-timestamp': 'not-a-timestamp' },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REQUEST');
  });
});

describe('§9.2 empty header rejection (SPEC-COMPLIANCE §9.2)', () => {
  it('rejects empty X-Node-Signature on announce with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-node-signature': '' },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects whitespace-only X-Node-Signature on announce with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-node-signature': '   ' },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects empty X-Node-Signature on offer with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: { ...nodeHeaders(), 'x-node-signature': '' },
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects whitespace-only X-Node-Signature on offer with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: { ...nodeHeaders(), 'x-node-signature': '   ' },
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });
});

describe('§9.2 empty X-Node-ID rejection (SPEC-COMPLIANCE §9.2)', () => {
  it('rejects empty X-Node-ID on announce with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-node-id': '' },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects whitespace-only X-Node-ID on announce with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: { ...nodeHeaders(), 'x-node-id': '   ' },
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects empty X-Node-ID on offer with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: { ...nodeHeaders(), 'x-node-id': '' },
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('rejects whitespace-only X-Node-ID on offer with §8.3 envelope', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: { ...nodeHeaders(), 'x-node-id': '   ' },
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.message).toBe('string');
  });
});

describe('X-Node-Signature lab boundary (presence-only, SPEC-COMPLIANCE §9.2)', () => {
  const garbageSignatureHeaders = () => ({
    ...nodeHeaders(),
    'x-node-signature': 'intentionally-invalid-not-cryptographically-verified',
  });

  it('accepts any non-empty X-Node-Signature on announce (no crypto verification)', async () => {
    const { app, deps, events } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/announce',
      headers: garbageSignatureHeaders(),
      payload: announcementPayload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('accepted');
    expect(events.length).toBe(1);
  });

  it('accepts any non-empty X-Node-Signature on offer (no crypto verification)', async () => {
    const { app, deps, events } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: garbageSignatureHeaders(),
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('accepted');
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('federation.offer_received');
  });
});

describe('POST /api/v1/federate/offer', () => {
  it('accepts an inbound MaterialOffer for a locally hosted material', async () => {
    const { app, deps, events } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: nodeHeaders(),
      payload: offerPayload,
    });
    expect(response.statusCode).toBe(202);
    expect(events[0].event_type).toBe('federation.offer_received');
    expect((events[0].payload as { from: string }).from).toBe('vienna.loop');
  });

  it('returns NOT_FOUND for offers targeting materials not hosted here', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: nodeHeaders(),
      payload: { ...offerPayload, material: 'MAT-FR-PAR-2026-GLASS-000001' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('rejects expired offers', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: nodeHeaders(),
      payload: { ...offerPayload, valid_until: new Date(Date.now() - 60 * 1000).toISOString() },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REQUEST');
  });

  it('rejects wrong @type values', async () => {
    const { app, deps } = buildApp();
    await registerFederateRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federate/offer',
      headers: nodeHeaders(),
      payload: { ...offerPayload, '@type': 'MaterialAnnouncement' },
    });
    expect(response.statusCode).toBe(400);
  });
});
