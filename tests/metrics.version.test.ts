import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerMetricsRoutes } from '../src/routes/metrics';
import { VERSION } from '../src/version';

describe('metrics version', () => {
  it('includes package version', async () => {
    const app = Fastify({ logger: false });
    await registerMetricsRoutes(app);
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(VERSION);
  });
});
