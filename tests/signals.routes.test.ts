import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerSignalsRoutes } from '../src/routes/signals';

const signalRow = {
  signals: {
    'plastic-pet': 0.3,
    'metal-aluminum': 0.15,
    default: 0.05,
  },
  valid_from: '2026-01-01T00:00:00.000Z',
  valid_until: '2027-12-31T23:59:59.000Z',
  updated_at: '2026-07-19T10:00:00.000Z',
};

describe('GET /api/v1/signals', () => {
  it('publishes the node LoopSignal configuration (SPEC §8.1)', async () => {
    const app = Fastify({ logger: false });
    await registerSignalsRoutes(app, { getLoopSignalConfig: async () => signalRow });

    const response = await app.inject({ method: 'GET', url: '/api/v1/signals' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/ld+json');

    const payload = response.json();
    expect(payload['@context']).toBe('https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld');
    expect(payload['@type']).toBe('LoopSignalConfig');
    expect(payload.schema_version).toBe('0.2.0');
    expect(payload.node).toBe('lab-hub.loop');
    expect(payload.signals).toEqual(signalRow.signals);
    expect(payload.valid_from).toBe(signalRow.valid_from);
    expect(payload.valid_until).toBe(signalRow.valid_until);
  });

  it('returns a spec error envelope when no configuration is published', async () => {
    const app = Fastify({ logger: false });
    await registerSignalsRoutes(app, { getLoopSignalConfig: async () => undefined });

    const response = await app.inject({ method: 'GET', url: '/api/v1/signals' });
    expect(response.statusCode).toBe(404);
    const payload = response.json();
    expect(payload.error.code).toBe('NOT_FOUND');
    expect(typeof payload.error.message).toBe('string');
  });
});
