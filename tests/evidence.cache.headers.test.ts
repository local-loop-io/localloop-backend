import { afterAll, describe, expect, it, mock } from 'bun:test';
import Fastify from 'fastify';
import type { EvidenceEntry } from '../src/db/evidence';

const sampleEntry: EvidenceEntry = {
  event_id: 'evt_cache_test_0000000000000001',
  sequence: 1,
  recorded_at: '2026-07-19T16:00:00.000Z',
  node_id: 'lab-hub.loop',
  subject: { type: 'material', id: 'MAT-DE-MUC-2025-CACHE-TEST' },
  event_type: 'registered',
  immutable: {
    event_id: 'evt_cache_test_0000000000000001',
    sequence: 1,
    subject: { type: 'material', id: 'MAT-DE-MUC-2025-CACHE-TEST' },
    event_type: 'registered',
    payload_hash_sha256: 'a'.repeat(64),
  },
  payload_hash_sha256: 'a'.repeat(64),
  retention: {
    retain_until: '2028-07-19T16:00:00.000Z',
    exportable: true,
    redaction_status: 'none',
  },
};

const listResult = { results: [sampleEntry], next_cursor: undefined };

const realEvidenceModule = await import('../src/db/evidence');

mock.module('../src/db/evidence', () => ({
  getLoopEvidenceByEventId: async (eventId: string) =>
    (eventId === sampleEntry.event_id ? sampleEntry : undefined),
  listLoopEvidence: async () => listResult,
}));

const { registerEvidenceRoutes } = await import('../src/routes/evidence');

afterAll(() => {
  mock.module('../src/db/evidence', () => realEvidenceModule);
});

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await registerEvidenceRoutes(app);
  return app;
};

describe('evidence routes Cache-Control', () => {
  it.each([
    ['GET', `/api/v1/evidence/${sampleEntry.event_id}`, undefined, 200],
    ['GET', '/api/v1/evidence', undefined, 200],
    [
      'POST',
      '/api/v1/evidence/search',
      { subject_type: 'material', limit: 10 },
      200,
    ],
  ] as const)('returns no-store on %s %s', async (method, url, payload, expectedStatus) => {
    const app = await buildApp();
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
