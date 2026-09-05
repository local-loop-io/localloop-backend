import { afterAll, describe, expect, it } from 'bun:test';
import { probeDatabase } from './dbReady';
import { pool } from '../src/db/pool';
import { createLoopMaterial, createLoopTransaction, type LoopMaterialPayload, type LoopTransactionPayload } from '../src/db/loop';
import { insertLoopEvidence, getLoopEvidenceByEventId, listLoopEvidence } from '../src/db/evidence';

const dbReady = await probeDatabase('evidence');
const createdMaterials: string[] = [];
const createdTransactions: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');

function buildMaterial(): LoopMaterialPayload {
  const id = `MAT-DE-MUC-2025-EVID-${suffix()}`;
  createdMaterials.push(id);
  return {
    id,
    category: 'plastic-pet',
    quantity: { value: 100, unit: 'kg' },
    origin_city: 'Munich',
    current_city: 'Munich',
    available_from: '2025-06-01T10:00:00Z',
    schema_version: '0.1.1',
  };
}


afterAll(async () => {
  if (dbReady) {
    for (const id of createdTransactions) {
      await pool.query('DELETE FROM loop_transactions WHERE id = $1', [id]);
    }
    for (const id of createdMaterials) {
      await pool.query('DELETE FROM loop_materials WHERE id = $1', [id]);
    }
  }
});

describe('Core-DP append-only evidence log', () => {
  it.skipIf(!dbReady)('records a registered evidence entry when a material is created', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);

    const result = await listLoopEvidence({ subjectType: 'material', subjectId: material.id, limit: 10 });
    expect(result.results.length).toBe(1);
    const entry = result.results[0]!;
    expect(entry.event_type).toBe('registered');
    expect(entry.subject).toEqual({ type: 'material', id: material.id });
    expect(entry.payload_hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.immutable.event_id).toBe(entry.event_id);
    expect(entry.immutable.payload_hash_sha256).toBe(entry.payload_hash_sha256);
    expect(entry.retention.exportable).toBe(true);
    expect(entry.retention.redaction_status).toBe('none');
  });

  it.skipIf(!dbReady)('records a registered evidence entry for a transaction (migration 020)', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);
    const id = `TXN-EVIDENCE-${suffix()}`;
    createdTransactions.push(id);
    const payload = {
      '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
      '@type': 'MaterialTransaction',
      schema_version: '0.2.0',
      id,
      material: material.id,
      seller: 'munich.loop',
      buyer: 'berlin.loop',
      offer: { base_price: 120, loop_cost: 156, breakdown: { export_penalty: 24, import_penalty: 0, distance_cost: 12 } },
      timestamp: '2026-07-19T16:00:00Z',
    } as unknown as LoopTransactionPayload;

    await createLoopTransaction(payload);

    const entries = await listLoopEvidence({ subjectType: 'transaction', subjectId: id, limit: 10 });
    expect(entries.results.length).toBe(1);
    expect(entries.results[0]!.event_type).toBe('registered');
    expect(entries.results[0]!.subject).toEqual({ type: 'transaction', id });
  });

  it.skipIf(!dbReady)('records a status-updated evidence entry for material status changes (migration 016)', async () => {
    const material = buildMaterial();
    await createLoopMaterial(material);

    await insertLoopEvidence({
      subject: { type: 'material', id: material.id },
      eventType: 'status-updated',
      data: { status: 'reserved' },
    });

    const result = await listLoopEvidence({ subjectType: 'material', subjectId: material.id, limit: 10 });
    expect(result.results.map((r) => r.event_type)).toEqual(['registered', 'status-updated']);
  });

  it.skipIf(!dbReady)('fetches a single entry by event_id', async () => {
    const entry = await insertLoopEvidence({
      subject: { type: 'offer', id: `OFR-${suffix()}` },
      eventType: 'offer-published',
      data: { hello: 'world' },
    });

    const fetched = await getLoopEvidenceByEventId(entry.event_id);
    expect(fetched?.event_id).toBe(entry.event_id);
    expect(fetched?.sequence).toBe(entry.sequence);
  });

  it.skipIf(!dbReady)('returns undefined for an unknown event_id', async () => {
    const fetched = await getLoopEvidenceByEventId('evt_does_not_exist_0000000000000000');
    expect(fetched).toBeUndefined();
  });

  it.skipIf(!dbReady)('paginates by sequence with a cursor, oldest first', async () => {
    const subjectId = `TRF-${suffix()}`;
    for (let i = 0; i < 3; i += 1) {
      await insertLoopEvidence({ subject: { type: 'transfer', id: subjectId }, eventType: 'transfer-dispatched', data: { i } });
    }

    const page1 = await listLoopEvidence({ subjectType: 'transfer', subjectId, limit: 2 });
    expect(page1.results.length).toBe(2);
    expect(page1.next_cursor).toBeDefined();

    const page2 = await listLoopEvidence({ subjectType: 'transfer', subjectId, limit: 2, cursor: page1.next_cursor });
    expect(page2.results.length).toBe(1);

    const sequences = [...page1.results, ...page2.results].map((r) => r.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });

  it.skipIf(!dbReady)('enforces append-only at the database level (blocks UPDATE and DELETE)', async () => {
    const entry = await insertLoopEvidence({
      subject: { type: 'match', id: `MCH-${suffix()}` },
      eventType: 'match-proposed',
      data: { x: 1 },
    });

    let updateError: unknown;
    try {
      await pool.query("UPDATE loop_evidence SET redaction_status = 'redacted' WHERE event_id = $1", [entry.event_id]);
    } catch (error) {
      updateError = error;
    }
    expect(updateError).toBeDefined();
    expect((updateError as Error).message).toMatch(/append-only/);

    let deleteError: unknown;
    try {
      await pool.query('DELETE FROM loop_evidence WHERE event_id = $1', [entry.event_id]);
    } catch (error) {
      deleteError = error;
    }
    expect(deleteError).toBeDefined();
    expect((deleteError as Error).message).toMatch(/append-only/);
  });
});

describe('Evidence lab boundary (append-only, SPEC-COMPLIANCE)', () => {
  it('has no HTTP route to create, update, delete, redact, or export evidence', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      for (const { method, url } of [
        { method: 'POST' as const, url: '/api/v1/evidence' },
        { method: 'PUT' as const, url: '/api/v1/evidence/evt_0000000000000000000000000001' },
        { method: 'DELETE' as const, url: '/api/v1/evidence/evt_0000000000000000000000000001' },
        { method: 'POST' as const, url: '/api/v1/evidence/evt_0000000000000000000000000001/redact' },
        { method: 'POST' as const, url: '/api/v1/evidence/redact' },
        { method: 'POST' as const, url: '/api/v1/evidence/export' },
      ]) {
        const response = await app.inject({ method, url });
        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe('NOT_FOUND');
      }
    } finally {
      await app.close();
    }
  });
});
