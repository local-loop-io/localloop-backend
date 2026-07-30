import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { getMetricsSnapshot } from '../src/metrics';
import { registerMetricsRoutes } from '../src/routes/metrics';
import { registerPrivacyRoutes } from '../src/routes/privacy';

describe('utility routes', () => {
  it('returns metrics snapshot', async () => {
    const baseline = getMetricsSnapshot();
    const app = Fastify({ logger: false });
    await registerMetricsRoutes(app);

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.metrics).toBeDefined();
    expect(payload.metrics.loop_material_created).toBe(
      baseline.metrics.loop_material_created,
    );
    expect(payload.metrics.loop_transaction_created).toBe(
      baseline.metrics.loop_transaction_created,
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns privacy notice', async () => {
    const app = Fastify({ logger: false });
    await registerPrivacyRoutes(app);

    const response = await app.inject({ method: 'GET', url: '/api/privacy' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.scope).toBe('Lab demo only');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
