import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerInterestRoutes } from '../src/routes/interest';

describe('interest routes Cache-Control', () => {
  it('returns Cache-Control: no-store on GET /api/interest', async () => {
    const app = Fastify({ logger: false });
    const data = [{
      id: 1,
      name: 'Alex',
      organization: null,
      role: null,
      country: null,
      city: null,
      website: null,
      email: null,
      message: null,
      is_demo: true,
      created_at: new Date().toISOString(),
    }];
    await registerInterestRoutes(app, {
      insertInterest: async () => ({ id: 2, created_at: new Date().toISOString() }),
      listInterests: async () => data,
      countInterests: async () => data.length,
      enqueueInterest: async () => undefined,
      broadcastInterest: () => undefined,
    });

    const response = await app.inject({ method: 'GET', url: '/api/interest' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().total).toBe(1);
  });
});
