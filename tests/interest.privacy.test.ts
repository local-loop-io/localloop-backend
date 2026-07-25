import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { insertInterest, listInterests, refreshInterestSearch } from '../src/db/interest';
import { prisma } from '../src/db/prisma';

let dbReady = false;
const createdIds: number[] = [];

beforeAll(async () => {
  try {
    await pool.query('SELECT 1');
    await runMigrations();
    dbReady = true;
  } catch (error) {
    console.warn('[interest.privacy] Postgres unavailable — skipping:', (error as Error).message);
  }
});

afterAll(async () => {
  if (!dbReady) return;
  for (const id of createdIds) {
    await prisma.interest.delete({ where: { id: BigInt(id) } }).catch(() => undefined);
  }
  await refreshInterestSearch().catch(() => undefined);
});

describe('interest list email privacy', () => {
  it('redacts email on search when shareEmail was revoked after MV refresh', async () => {
    if (!dbReady) return;

    const marker = `privacy-${Date.now()}`;
    const created = await insertInterest({
      name: marker,
      organization: 'Privacy Lab',
      role: undefined,
      country: 'DE',
      city: 'Berlin',
      website: undefined,
      email: `${marker}@example.com`,
      message: `searchable-${marker}`,
      shareEmail: true,
      consentPublic: true,
    });
    createdIds.push(created.id);

    await refreshInterestSearch();

    // Revoke sharing without refreshing the materialized view — search used to
    // read the MV's stale email column and leak the address.
    await prisma.interest.update({
      where: { id: BigInt(created.id) },
      data: { shareEmail: false },
    });

    const results = await listInterests(50, marker);
    const hit = results.find((row) => row.id === created.id);
    expect(hit).toBeDefined();
    expect(hit?.email).toBeNull();

    const unscoped = await listInterests(50);
    const hit2 = unscoped.find((row) => row.id === created.id);
    expect(hit2?.email).toBeNull();
  });
});
