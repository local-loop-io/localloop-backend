import type { EvidenceEntry, InsertEvidenceInput } from '../src/db/evidence';

/**
 * Shared LoopDeps.insertLoopEvidence stub for route tests that don't exercise
 * the evidence log directly. Returns a structurally valid EvidenceEntry echoing
 * the input's subject/event_type so callers that do care can still assert on it.
 */
export async function fakeInsertLoopEvidence(input: InsertEvidenceInput): Promise<EvidenceEntry> {
  return {
    event_id: 'evt_test0000000000000000000000000',
    sequence: 1,
    recorded_at: new Date().toISOString(),
    node_id: 'test-node',
    subject: input.subject,
    event_type: input.eventType,
    immutable: {
      event_id: 'evt_test0000000000000000000000000',
      sequence: 1,
      subject: input.subject,
      event_type: input.eventType,
      payload_hash_sha256: '0'.repeat(64),
    },
    payload_hash_sha256: '0'.repeat(64),
    retention: { retain_until: new Date().toISOString(), exportable: true, redaction_status: 'none' },
  };
}
