import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerSignalsRoutes } from '../src/routes/signals';

describe('signals routes Cache-Control', () => {
  it('returns public short cache on GET /api/v1/signals', async () => {
    const app = Fastify({ logger: false });
    await registerSignalsRoutes(app, {
      getLoopSignalConfig: async () => ({
        '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
        '@type': 'LoopSignalConfig',
        schema_version: '0.2.0',
        node: 'lab-hub.loop',
        signals: { availability: 1 },
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      }) as any,
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/signals' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=30');
    expect(response.json()['@type']).toBe('LoopSignalConfig');
  });
});
