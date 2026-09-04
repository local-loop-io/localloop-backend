import { afterAll, describe, expect, it } from 'bun:test';
import { probeDatabase } from './dbReady';
import { pool } from '../src/db/pool';
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

const dbReady = await probeDatabase('loop.stateMachine');
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


afterAll(async () => {
  if (dbReady) {
    for (const id of createdMaterials) {
      // FK ON DELETE CASCADE cleans up offers -> matches -> transfers.
      await pool.query('DELETE FROM loop_materials WHERE id = $1', [id]);
    }
  }
  // NOTE: does not call pool.end() — `pool` is a shared module-level singleton
  // across every test file in this `bun test` run (not just this one), and other
  // DB-backed suites (loop.search, evidence, idempotency) need it to stay open
  // regardless of file execution order.
});

describe('loop state machine (db-backed)', () => {
  it.skipIf(!dbReady)('reserves the offer when an active match is created', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);

    await createLoopMatch(buildMatch(material.id, offer.id));

    const reloaded = await getLoopOfferById(offer.id);
    expect(reloaded?.status).toBe('reserved');
  });

  it.skipIf(!dbReady)('rejects a second match on an already-reserved offer as a conflict', async () => {
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
    // Someone else holds the offer: a 409-class conflict, not a malformed request.
    expect((error as LoopStateError).kind).toBe('conflict');
  });

  it.skipIf(!dbReady)('rejects matching a withdrawn offer', async () => {
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

  it.skipIf(!dbReady)('rejects a second transfer on the same match', async () => {
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
    // An explicit pre-insert check (guarded by the same FOR UPDATE lock used
    // for the match/offer state checks above) catches this before it can reach
    // the uq_loop_transfers_active_match unique index, so callers get a clean
    // `conflict` state error (409, same status the raw 23505 used to produce)
    // instead of a database error.
    expect(error).toBeInstanceOf(LoopStateError);
    expect((error as LoopStateError).kind).toBe('conflict');
  });

  it.skipIf(!dbReady)('lets exactly one of two concurrent transfers win for the same match', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);
    const match = buildMatch(material.id, offer.id);
    await createLoopMatch(match);

    const results = await Promise.allSettled([
      createLoopTransfer(buildTransfer(material.id, match.id)),
      createLoopTransfer(buildTransfer(material.id, match.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0]!.reason).toBeInstanceOf(LoopStateError);
    expect((rejected[0]!.reason as LoopStateError).kind).toBe('conflict');
  });

  it.skipIf(!dbReady)('rejects an offer whose quantity exceeds the material', async () => {
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

  it.skipIf(!dbReady)('lets exactly one of two concurrent matches win', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);
    const offer = buildOffer(material.id);
    await createLoopOffer(offer);

    const results = await Promise.allSettled([
      createLoopMatch(buildMatch(material.id, offer.id)),
      createLoopMatch(buildMatch(material.id, offer.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0]!.reason).toBeInstanceOf(LoopStateError);
    expect((rejected[0]!.reason as LoopStateError).kind).toBe('conflict');

    const reloaded = await getLoopOfferById(offer.id);
    expect(reloaded?.status).toBe('reserved');
  });
});
