import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { getMetricsSnapshot, incrementMetric } from '../src/metrics';
import { registerMetricsRoutes } from '../src/routes/metrics';

describe('metrics snapshot keys', () => {
  it('always exposes the full known key set including zeros via the HTTP route', async () => {
    const snap = getMetricsSnapshot();
    expect(Object.keys(snap.metrics).length).toBeGreaterThanOrEqual(12);
    expect(snap.metrics).toHaveProperty('loop_material_created');
    expect(typeof snap.metrics.loop_material_created).toBe('number');

    incrementMetric('loop_material_created');
    const after = getMetricsSnapshot();
    expect(after.metrics.loop_material_created).toBe(snap.metrics.loop_material_created + 1);

    const app = Fastify({ logger: false });
    await registerMetricsRoutes(app);
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metrics.loop_material_created).toBe(after.metrics.loop_material_created);
    expect(typeof body.version).toBe('string');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
