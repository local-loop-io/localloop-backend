import { describe, expect, it, afterAll, beforeAll } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerTransactionRoutes } from '../src/routes/transactions';
import { transactionIdentity } from '../src/db/loop';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';

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

const settlementPayload = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'Settlement',
  schema_version: '0.2.0',
  transaction_id: 'TXN-2026-07-19-002',
  material: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  seller: 'munich.loop',
  buyer: 'berlin.loop',
  final_cost: 156,
  distribution: {
    seller_receives: 96,
    seller_community_fund: 24,
    buyer_community_fund: 24,
    transport_cost: 12,
  },
  settled_at: '2026-07-19T18:00:00Z',
};

const storedRow = {
  id: materialTransactionPayload.id,
  status: 'pending',
  payload: materialTransactionPayload,
  created_at: '2026-07-19T16:00:01.000Z',
  updated_at: '2026-07-19T16:00:01.000Z',
};

const buildApp = () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const created: string[] = [];
  const deps = {
    createLoopTransaction: async (p: { id?: string; transaction_id?: string }) => {
      const id = (p.id ?? p.transaction_id) as string;
      if (created.includes(id)) {
        const error = new Error('duplicate key value violates unique constraint') as Error & { code?: string };
        error.code = '23505';
        throw error;
      }
      created.push(id);
      return { id, created_at: new Date().toISOString(), event: { type: 'transaction.created' } };
    },
    getLoopTransactionById: async (id: string) => (id === storedRow.id ? storedRow : undefined),
    broadcastLoopEvent: () => undefined,
  };
  return { app, deps };
};

describe('transaction identity mapping', () => {
  it('derives id and status per @type', () => {
    expect(transactionIdentity(materialTransactionPayload)).toEqual({ id: 'TXN-2026-07-19-001', status: 'pending' });
    expect(transactionIdentity({ ...materialTransactionPayload, status: 'confirmed' })).toEqual({ id: 'TXN-2026-07-19-001', status: 'confirmed' });
    expect(transactionIdentity(settlementPayload)).toEqual({ id: 'TXN-2026-07-19-002', status: 'completed' });
  });
});

describe('POST /api/v1/transaction', () => {
  it('creates a MaterialTransaction and answers with TransactionStatus JSON-LD', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      headers: { 'content-type': 'application/ld+json' },
      payload: materialTransactionPayload,
    });
    expect(response.statusCode).toBe(201);
    expect(response.headers['content-type']).toContain('application/ld+json');

    const payload = response.json();
    expect(payload['@type']).toBe('TransactionStatus');
    expect(payload.transaction_id).toBe(materialTransactionPayload.id);
    expect(payload.status).toBe('pending');
    expect(payload.settlement_url).toBe(`/api/v1/transaction/${materialTransactionPayload.id}`);
    expect(typeof payload.updated_at).toBe('string');
  });

  it('records a Settlement as a completed transaction', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const response = await app.inject({ method: 'POST', url: '/api/v1/transaction', payload: settlementPayload });
    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload.transaction_id).toBe(settlementPayload.transaction_id);
    expect(payload.status).toBe('completed');
  });

  it('rejects duplicates with the spec CONFLICT envelope', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const first = await app.inject({ method: 'POST', url: '/api/v1/transaction', payload: materialTransactionPayload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: 'POST', url: '/api/v1/transaction', payload: materialTransactionPayload });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('CONFLICT');
  });

  it('rejects payloads that violate the canonical transaction schema', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      payload: { ...materialTransactionPayload, id: 'not-a-txn-id' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/v1/transaction Idempotency-Key handling', () => {
  let dbReady = false;
  const createdKeys: string[] = [];
  const suffix = () => Math.random().toString(16).slice(2, 10);

  beforeAll(async () => {
    try {
      await runMigrations();
      dbReady = true;
    } catch (error) {
      console.warn('[transactions] Postgres unavailable — skipping idempotency tests:', (error as Error).message);
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (dbReady) {
      for (const key of createdKeys) {
        await pool.query('DELETE FROM loop_idempotency_keys WHERE key = $1', [key]);
      }
    }
  });

  it('answers a key reused with a different body with the Core-DP conflict body (not a 500)', async () => {
    if (!dbReady) return;
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const key = `idem-txn-${suffix()}`;
    createdKeys.push(key);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      headers: { 'idempotency-key': key },
      payload: materialTransactionPayload,
    });
    expect(first.statusCode).toBe(201);

    const conflicting = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      headers: { 'idempotency-key': key },
      payload: settlementPayload,
    });
    expect(conflicting.statusCode).toBe(409);
    const body = conflicting.json();
    expect(body.code).toBe('conflict');
    expect(body.retryable).toBe(false);
    expect(typeof body.correlation_id).toBe('string');
    expect(body.details.idempotency_key).toBe(key);
  });

  it('replays the cached TransactionStatus for a repeated key with the same body', async () => {
    if (!dbReady) return;
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const key = `idem-txn-${suffix()}`;
    createdKeys.push(key);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      headers: { 'idempotency-key': key },
      payload: materialTransactionPayload,
    });
    expect(first.statusCode).toBe(201);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      headers: { 'idempotency-key': key },
      payload: materialTransactionPayload,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
  });
});

describe('LoopCoin settlement lab boundary (record-only, SPEC-COMPLIANCE)', () => {
  it('MaterialTransaction POST only persists the payload (no wallet execution)', async () => {
    const persisted: unknown[] = [];
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerTransactionRoutes(app, {
      createLoopTransaction: async (p) => {
        persisted.push(p);
        return {
          id: p.id as string,
          created_at: new Date().toISOString(),
          event: { type: 'transaction.created' },
        };
      },
      getLoopTransactionById: async () => undefined,
      broadcastLoopEvent: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      payload: materialTransactionPayload,
    });
    expect(response.statusCode).toBe(201);
    expect(persisted.length).toBe(1);
    expect((persisted[0] as { '@type': string })['@type']).toBe('MaterialTransaction');

    const body = response.json();
    expect(body['@type']).toBe('TransactionStatus');
    expect(body['@type']).not.toBe('LoopCoinTransfer');
    expect(body.settlement_url).toBe(`/api/v1/transaction/${materialTransactionPayload.id}`);
  });

  it('Settlement POST records completed status without LoopCoin transfer execution', async () => {
    const persisted: unknown[] = [];
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerTransactionRoutes(app, {
      createLoopTransaction: async (p) => {
        persisted.push(p);
        return {
          id: p.transaction_id as string,
          created_at: new Date().toISOString(),
          event: { type: 'transaction.created' },
        };
      },
      getLoopTransactionById: async () => undefined,
      broadcastLoopEvent: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      payload: settlementPayload,
    });
    expect(response.statusCode).toBe(201);
    expect(persisted.length).toBe(1);
    expect((persisted[0] as { '@type': string })['@type']).toBe('Settlement');

    const body = response.json();
    expect(body['@type']).toBe('TransactionStatus');
    expect(body.status).toBe('completed');
    expect(body['@type']).not.toBe('LoopCoinTransfer');
  });

  it('returns NOT_FOUND for hypothetical LoopCoin wallet routes (no currency engine)', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      for (const url of ['/api/v1/loopcoin/transfer', '/api/v1/loopcoin/config']) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe('NOT_FOUND');
      }
    } finally {
      await app.close();
    }
  });
});

describe('GET /api/v1/transaction/:id', () => {
  it('resolves the settlement_url of a stored transaction', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: `/api/v1/transaction/${storedRow.id}` });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload['@type']).toBe('TransactionStatus');
    expect(payload.transaction_id).toBe(storedRow.id);
    expect(payload.status).toBe(storedRow.status);
  });

  it('returns the spec NOT_FOUND envelope for unknown transactions', async () => {
    const { app, deps } = buildApp();
    await registerTransactionRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/v1/transaction/TXN-2026-01-01-999' });
    expect(response.statusCode).toBe(404);
    const payload = response.json();
    expect(payload.error.code).toBe('NOT_FOUND');
    expect(payload.error.details.searched_id).toBe('TXN-2026-01-01-999');
  });
});
