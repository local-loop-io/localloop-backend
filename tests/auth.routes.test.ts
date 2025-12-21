import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerAuthStatusRoutes } from '../src/routes/auth';

describe('auth status routes', () => {
  it('reports auth as disabled by default', async () => {
    const app = Fastify({ logger: false });
    await registerAuthStatusRoutes(app);

    const response = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.enabled).toBeFalse();
    expect(payload.active).toBeFalse();
    expect(payload.provider).toBe('disabled');
    expect(payload.apiKeyEnabled).toBeBoolean();
  });
});
