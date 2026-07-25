import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerMetricsRoutes } from '../src/routes/metrics';

describe('metrics version', () => {
  it('includes package version', async () => {
    const app = Fastify({ logger: false });
    await registerMetricsRoutes(app);
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });
});
