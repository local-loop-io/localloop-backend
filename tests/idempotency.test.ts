import { afterAll, describe, expect, it } from 'bun:test';
import { probeDatabase } from './dbReady';
import { pool } from '../src/db/pool';
import { withIdempotency, IDEMPOTENCY_RETENTION_MS } from '../src/idempotency';
import { CoreDpError } from '../src/errors';

const dbReady = await probeDatabase('idempotency');
const createdKeys: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');


afterAll(async () => {
  if (dbReady) {
    for (const key of createdKeys) {
      await pool.query('DELETE FROM loop_idempotency_keys WHERE key = $1', [key]);
    }
  }
});

describe('REST idempotency (Idempotency-Key)', () => {
  it.skipIf(!dbReady)('runs the handler once and replays the cached response for a repeated key+body', async () => {
    const key = `idem-test-${suffix()}`;
    createdKeys.push(key);
    let calls = 0;
    const body = { a: 1 };
    const handler = async () => {
      calls += 1;
      return { status: 201 as const, body: { id: 'created-once' } };
    };

    const first = await withIdempotency('test.route', key, body, handler);
    const second = await withIdempotency('test.route', key, body, handler);

    expect(calls).toBe(1);
    expect(first).toEqual(second);
    expect(first.body).toEqual({ id: 'created-once' });
  });

  it.skipIf(!dbReady)('throws a conflict CoreDpError when the same key is reused with a different body', async () => {
    const key = `idem-conflict-${suffix()}`;
    createdKeys.push(key);
    const handler = async () => ({ status: 201 as const, body: { id: 'x' } });

    await withIdempotency('test.route', key, { a: 1 }, handler);

    let error: unknown;
    try {
      await withIdempotency('test.route', key, { a: 2 }, handler);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CoreDpError);
    expect((error as CoreDpError).code).toBe('conflict');
  });

  it.skipIf(!dbReady)('treats a cache row past the retention window as expired, not a conflict', async () => {
    const key = `idem-expired-${suffix()}`;
    createdKeys.push(key);

    // Seed a stale cache row directly (bypassing withIdempotency's own INSERT
    // so we can control created_at), as if it were written before the
    // retention window.
    const staleCreatedAt = new Date(Date.now() - IDEMPOTENCY_RETENTION_MS - 60_000);
    await pool.query(
      `INSERT INTO loop_idempotency_keys (key, route, request_hash_sha256, response_status, response_body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [key, 'test.route', 'stale-hash-does-not-matter', 201, JSON.stringify({ id: 'stale' }), staleCreatedAt],
    );

    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { status: 201 as const, body: { id: 'fresh' } };
    };

    // A different body than the "cached" one would normally conflict — but
    // the cached row is expired, so this should run handler fresh instead.
    const result = await withIdempotency('test.route', key, { a: 'a fresh, different body' }, handler);

    expect(calls).toBe(1);
    expect(result.body).toEqual({ id: 'fresh' });
  });

  it.skipIf(!dbReady)('scopes cache rows per route so one key on two routes never replays the wrong response', async () => {
    const key = `idem-routes-${suffix()}`;
    createdKeys.push(key);
    let aCalls = 0;
    let bCalls = 0;
    const handlerA = async () => { aCalls += 1; return { status: 201 as const, body: { id: 'from-a' } }; };
    const handlerB = async () => { bCalls += 1; return { status: 201 as const, body: { id: 'from-b' } }; };

    const a1 = await withIdempotency('route.a', key, { a: 1 }, handlerA);
    const b1 = await withIdempotency('route.b', key, { b: 1 }, handlerB);
    // Before migration 018 the second route overwrote the first route's row,
    // so this replay re-ran handlerA and returned a fresh (different) response.
    const a2 = await withIdempotency('route.a', key, { a: 1 }, handlerA);

    expect(aCalls).toBe(1);
    expect(bCalls).toBe(1);
    expect(a1.body).toEqual({ id: 'from-a' });
    expect(b1.body).toEqual({ id: 'from-b' });
    expect(a2).toEqual(a1);
  });

  it.skipIf(!dbReady)('does not exhaust the pool under more concurrent keyed writes than DB_POOL_SIZE', async () => {
    // Each keyed request holds one client for its advisory lock; the handler
    // must reuse that client for its own transaction instead of waiting for a
    // second slot, otherwise DB_POOL_SIZE concurrent requests deadlock until
    // the connection timeout.
    const { config } = await import('../src/config');
    const { withTransaction } = await import('../src/db/pool');
    const attempts = config.dbPoolSize + 2;
    const keys = Array.from({ length: attempts }, () => `idem-pool-${suffix()}`);
    createdKeys.push(...keys);

    const results = await Promise.all(keys.map((key) =>
      withIdempotency('pool.route', key, { key }, async (client) =>
        withTransaction(async (tx) => {
          await tx.query('SELECT pg_sleep(0.05)');
          return { status: 201 as const, body: { key } };
        }, client),
      ),
    ));

    expect(results).toHaveLength(attempts);
    expect(results.map((r) => (r.body as { key: string }).key).sort()).toEqual([...keys].sort());
  });

  it('passes through directly (runs every time) when no key is supplied', async () => {
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return { status: 201 as const, body: { id: 'no-key' } };
    };
    await withIdempotency('test.route', undefined, { a: 1 }, handler);
    await withIdempotency('test.route', undefined, { a: 1 }, handler);
    expect(calls).toBe(2);
  });
});
