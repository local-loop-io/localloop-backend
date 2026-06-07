import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import {
  createLoopMaterial,
  createLoopOffer,
  createLoopMatch,
  createLoopTransfer,
  getLoopOfferById,
  LoopStateError,
  type LoopMaterialPayload,
  type LoopOfferPayload,
  type LoopMatchPayload,
  type LoopTransferPayload,
} from '../src/db/loop';

// These tests exercise the real state machine against Postgres. They auto-skip
// when no database is reachable (e.g. `bun test` without `docker compose up -d`),
// so the mocked route suite still runs everywhere. To run them locally:
//   docker compose up -d && bun test tests/loop.stateMachine.test.ts

let dbReady = false;
const createdMaterials: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');

function buildMaterial(quantity = 100): LoopMaterialPayload {
  const id = `MAT-DE-MUC-2025-PLASTIC-${suffix()}`;
  createdMaterials.push(id);
  return {
    id,
    category: 'plastic-pet',
    quantity: { value: quantity, unit: 'kg' },
    origin_city: 'Munich',
    current_city: 'Munich',
    available_from: '2025-06-01T10:00:00Z',
    schema_version: '0.1.1',
  };
}

function buildOffer(materialId: string, quantity = 80, status = 'open'): LoopOfferPayload {
  return {
    id: `OFR-${suffix()}`,
    material_id: materialId,
    from_city: 'Munich',
    to_city: 'Berlin',
    quantity: { value: quantity, unit: 'kg' },
    status,
    available_until: '2025-06-05T10:00:00Z',
    schema_version: '0.1.1',
  };
}

function buildMatch(materialId: string, offerId: string, status = 'accepted'): LoopMatchPayload {
  return {
    id: `MCH-${suffix()}`,
    material_id: materialId,
    offer_id: offerId,
    from_city: 'Munich',
    to_city: 'Berlin',
    status,
    matched_at: '2025-06-02T12:15:00Z',
    schema_version: '0.1.1',
  };
}

function buildTransfer(materialId: string, matchId: string, status = 'completed'): LoopTransferPayload {
  return {
    id: `TRF-${suffix()}`,
    material_id: materialId,
    match_id: matchId,
    status,
    handoff_at: '2025-06-02T14:00:00Z',
    received_at: '2025-06-02T18:00:00Z',
    schema_version: '0.1.1',
  };
}

beforeAll(async () => {
  try {
    await runMigrations();
    dbReady = true;
  } catch (error) {
    console.warn(
      '[loop.stateMachine] Postgres unavailable — skipping DB-backed state-machine tests:',
      (error as Error).message,
    );
    dbReady = false;
  }
});

afterAll(async () => {
  if (dbReady) {
    for (const id of createdMaterials) {
      // FK ON DELETE CASCADE cleans up offers -> matches -> transfers.
      await pool.query('DELETE FROM loop_materials WHERE id = $1', [id]);
    }
  }
  await pool.end();
});

describe('loop state machine (db-backed)', () => {
  it('reserves the offer when an active match is created', async () => {
    if (!dbReady) return;
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);

    await createLoopMatch(buildMatch(material.id, offer.id));

    const reloaded = await getLoopOfferById(offer.id);
    expect(reloaded?.status).toBe('reserved');
  });

  it('rejects a second match on an already-reserved offer', async () => {
    if (!dbReady) return;
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);

    await createLoopMatch(buildMatch(material.id, offer.id));

    let error: unknown;
    try {
      await createLoopMatch(buildMatch(material.id, offer.id));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(LoopStateError);
    expect((error as LoopStateError).kind).toBe('invalid_state');
  });

  it('rejects matching a withdrawn offer', async () => {
    if (!dbReady) return;
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id, 80, 'withdrawn');
    await createLoopOffer(offer);

    let error: unknown;
    try {
      await createLoopMatch(buildMatch(material.id, offer.id));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(LoopStateError);
    expect((error as LoopStateError).kind).toBe('invalid_state');
  });

  it('rejects a second transfer on the same match', async () => {
    if (!dbReady) return;
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);
    const match = buildMatch(material.id, offer.id);
    await createLoopMatch(match);

    await createLoopTransfer(buildTransfer(material.id, match.id));

    let error: unknown;
    try {
      await createLoopTransfer(buildTransfer(material.id, match.id));
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    // Partial unique index on (match_id WHERE status <> 'cancelled') -> 23505.
    expect((error as { code?: string }).code).toBe('23505');
  });

  it('rejects an offer whose quantity exceeds the material', async () => {
    if (!dbReady) return;
    const material = buildMaterial(100);
    await createLoopMaterial(material);

    let error: unknown;
    try {
      await createLoopOffer(buildOffer(material.id, 150));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(LoopStateError);
    expect((error as LoopStateError).kind).toBe('invalid_state');
  });

  it('lets exactly one of two concurrent matches win', async () => {
    if (!dbReady) return;
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);

    const results = await Promise.allSettled([
      createLoopMatch(buildMatch(material.id, offer.id)),
      createLoopMatch(buildMatch(material.id, offer.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const reloaded = await getLoopOfferById(offer.id);
    expect(reloaded?.status).toBe('reserved');
  });
});
