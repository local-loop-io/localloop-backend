import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerHealthRoutes, type HealthDeps } from '../src/routes/health';

async function injectHealth(deps: HealthDeps) {
  const app = Fastify({ logger: false });
  await registerHealthRoutes(app, deps);
  return app.inject({ method: 'GET', url: '/health' });
}

describe('GET /health', () => {
  it('returns 200 with db and redis ok', async () => {
    const response = await injectHealth({
      checkDb: async () => 'ok',
      checkRedis: async () => 'ok',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(typeof body.time).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('treats redis skipped as healthy when db is ok', async () => {
    const response = await injectHealth({
      checkDb: async () => 'ok',
      checkRedis: async () => 'skipped',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.redis).toBe('skipped');
  });

  it('returns 503 when database probe fails', async () => {
    const response = await injectHealth({
      checkDb: async () => 'error',
      checkRedis: async () => 'ok',
    });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
    expect(body.redis).toBe('ok');
  });

  it('returns 503 when redis probe fails', async () => {
    const response = await injectHealth({
      checkDb: async () => 'ok',
      checkRedis: async () => 'error',
    });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('ok');
    expect(body.redis).toBe('error');
  });
});
