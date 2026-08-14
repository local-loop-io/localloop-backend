import { describe, expect, it } from 'bun:test';

describe('docs routes Cache-Control', () => {
  it('returns public short cache on GET /openapi.json', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=30');
      expect(response.json().openapi).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('returns public short cache on GET /docs', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/docs' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=30');
      expect(response.body).toContain('redoc');
    } finally {
      await app.close();
    }
  });
});
