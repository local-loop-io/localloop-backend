import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { withIdempotency } from '../src/idempotency';
import { CoreDpError } from '../src/errors';

let dbReady = false;
const createdKeys: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');

beforeAll(async () => {
  try {
    await runMigrations();
    dbReady = true;
  } catch (error) {
    console.warn('[idempotency] Postgres unavailable — skipping idempotency tests:', (error as Error).message);
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

describe('REST idempotency (Idempotency-Key)', () => {
  it('runs the handler once and replays the cached response for a repeated key+body', async () => {
    if (!dbReady) return;
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

  it('throws a conflict CoreDpError when the same key is reused with a different body', async () => {
    if (!dbReady) return;
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
