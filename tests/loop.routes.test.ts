import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopRoutes } from '../src/routes/loop';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';

const materialPayload = {
  '@context': 'https://loop-protocol.org/v0.1.1',
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
  '@context': 'https://loop-protocol.org/v0.1.1',
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
  '@context': 'https://loop-protocol.org/v0.1.1',
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
  '@context': 'https://loop-protocol.org/v0.1.1',
  '@type': 'Transfer',
  schema_version: '0.1.1',
  id: 'TRF-5D8A23F1',
  material_id: materialPayload.id,
  match_id: matchPayload.id,
  status: 'completed',
  handoff_at: '2025-06-02T14:00:00Z',
  received_at: '2025-06-02T18:00:00Z',
};

const buildApp = () => {
  const app = Fastify({ logger: false });
  registerLoopSchemas(app);

  const deps = {
    insertLoopMaterial: async () => ({ id: materialPayload.id, created_at: new Date().toISOString() }),
    insertLoopOffer: async () => ({ id: offerPayload.id, created_at: new Date().toISOString() }),
    insertLoopMatch: async () => ({ id: matchPayload.id, created_at: new Date().toISOString() }),
    insertLoopTransfer: async () => ({ id: transferPayload.id, created_at: new Date().toISOString() }),
    insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    listLoopEvents: async () => ([{ id: 1, event_type: 'material.created', entity_type: 'material', entity_id: materialPayload.id, payload: {}, created_at: new Date().toISOString() }]),
    getLoopMaterial: async (id: string) => (id === materialPayload.id ? { id } : undefined),
    getLoopOffer: async (id: string) => (id === offerPayload.id ? { id, material_id: materialPayload.id } : undefined),
    getLoopMatch: async (id: string) => (id === matchPayload.id ? { id, material_id: materialPayload.id, offer_id: offerPayload.id } : undefined),
    broadcastLoopEvent: () => undefined,
  };

  return { app, deps };
};

describe('loop routes', () => {
  it('creates material, offer, match, and transfer', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const materialResponse = await app.inject({ method: 'POST', url: '/api/loop/materials', payload: materialPayload });
    expect(materialResponse.statusCode).toBe(201);

    const offerResponse = await app.inject({ method: 'POST', url: '/api/loop/offers', payload: offerPayload });
    expect(offerResponse.statusCode).toBe(201);

    const matchResponse = await app.inject({ method: 'POST', url: '/api/loop/matches', payload: matchPayload });
    expect(matchResponse.statusCode).toBe(201);

    const transferResponse = await app.inject({ method: 'POST', url: '/api/loop/transfers', payload: transferPayload });
    expect(transferResponse.statusCode).toBe(201);
  });

  it('rejects offers for unknown materials', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, { ...deps, getLoopMaterial: async () => undefined });

    const response = await app.inject({ method: 'POST', url: '/api/loop/offers', payload: offerPayload });
    expect(response.statusCode).toBe(400);
  });

  it('fails fast on invalid payloads', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/loop/materials',
      payload: { id: 'DE-MUC-2025-PLASTIC-B847F3' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('lists loop events', async () => {
    const { app, deps } = buildApp();
    await registerLoopRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/loop/events' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.results.length).toBeGreaterThan(0);
  });
});
