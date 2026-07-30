import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerTransactionRoutes } from '../src/routes/transactions';

const materialTransactionPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'MaterialTransaction',
  schema_version: '0.2.0',
  id: 'TXN-2026-07-19-001',
  material: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  seller: 'munich.loop',
  buyer: 'berlin.loop',
  offer: {
    base_price: 120,
    loop_cost: 156,
    breakdown: { export_penalty: 24, import_penalty: 0, distance_cost: 12 },
  },
  timestamp: '2026-07-19T16:00:00Z',
};

const storedRow = {
  id: materialTransactionPayload.id,
  status: 'pending',
  payload: materialTransactionPayload,
  created_at: '2026-07-19T16:00:01.000Z',
  updated_at: '2026-07-19T16:00:01.000Z',
};

const buildApp = async () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const deps = {
    createLoopTransaction: async (p: { id?: string; transaction_id?: string }) => {
      const id = (p.id ?? p.transaction_id) as string;
      return { id, created_at: new Date().toISOString(), event: { type: 'transaction.created' } };
    },
    getLoopTransactionById: async (id: string) => (id === storedRow.id ? storedRow : undefined),
    broadcastLoopEvent: () => undefined,
  };

  await registerTransactionRoutes(app, deps);
  return app;
};

describe('transaction routes Cache-Control', () => {
  it.each([
    ['POST', '/api/v1/transaction', materialTransactionPayload, 201],
    ['GET', `/api/v1/transaction/${storedRow.id}`, undefined, 200],
  ] as const)('returns no-store on %s %s', async (method, url, payload, expectedStatus) => {
    const app = await buildApp();
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
