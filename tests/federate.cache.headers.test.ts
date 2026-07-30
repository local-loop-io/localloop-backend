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

const buildApp = async () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);

  const deps = {
    insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    getLoopMaterial: async (id: string) => (id === offerPayload.material ? { id } : undefined),
    broadcastLoopEvent: () => undefined,
  };

  await registerFederateRoutes(app, deps);
  return app;
};

describe('federate write routes Cache-Control', () => {
  it.each([
    ['/api/v1/federate/announce', announcementPayload],
    ['/api/v1/federate/offer', offerPayload],
  ])('returns no-store on POST %s', async (url, payload) => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url,
      headers: nodeHeaders(),
      payload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
