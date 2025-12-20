import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerMetricsRoutes } from '../src/routes/metrics';
import { registerPrivacyRoutes } from '../src/routes/privacy';

describe('utility routes', () => {
  it('returns metrics snapshot', async () => {
    const app = Fastify({ logger: false });
    await registerMetricsRoutes(app);

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.metrics).toBeDefined();
  });

  it('returns privacy notice', async () => {
    const app = Fastify({ logger: false });
    await registerPrivacyRoutes(app);

    const response = await app.inject({ method: 'GET', url: '/api/privacy' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.scope).toBe('Lab demo only');
  });
});
