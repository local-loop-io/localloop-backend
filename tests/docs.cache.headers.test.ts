import { describe, expect, it } from 'bun:test';
import { VERSION, PROTOCOL_VERSION } from '../src/version';

describe('docs routes Cache-Control', () => {
  it('returns public short cache on GET /openapi.json', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=30');
      const doc = response.json();
      expect(doc.openapi).toBeDefined();
      // One version source: the OpenAPI document reports the package version
      // (previously a hard-coded, stale '0.2.0-lab') plus the spec baseline.
      expect(doc.info.version).toBe(VERSION);
      expect(doc.info['x-protocol-version']).toBe(PROTOCOL_VERSION);
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
