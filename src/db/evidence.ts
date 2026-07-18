import { randomBytes } from 'node:crypto';
import { pool, type Queryable } from './pool';
import { config } from '../config';
import { canonicalHash } from '../crypto/canonical';
import { encodeCursor, decodeCursor } from '../pagination';

export type EvidenceSubjectType = 'material' | 'product' | 'offer' | 'match' | 'transfer' | 'envelope';

export type EvidenceEventType =
  | 'registered' | 'read' | 'searched'
  | 'offer-published' | 'offer-acked' | 'offer-rejected'
  | 'match-proposed' | 'match-accepted' | 'match-rejected'
  | 'transfer-dispatched' | 'transfer-received' | 'transfer-acked'
  | 'error-recorded' | 'key-rotated';

/**
 * Shape matches profiles/core-dp/schemas/evidence-entry.schema.json exactly
 * (additionalProperties: false there). `immutable` is a self-contained fingerprint
 * of the entry's identity plus a hash of the underlying event data — the profile
 * schema does not carry the full event payload, only proof that a specific one
 * occurred. Callers that need the payload itself look it up via subject.id in the
 * normal entity tables and can verify it against payload_hash_sha256.
 */
export type EvidenceEntry = {
  event_id: string;
  sequence: number;
  predecessor_event_id?: string;
  recorded_at: string;
  observed_at?: string;
  node_id: string;
  actor_node_id?: string;
  subject: { type: EvidenceSubjectType; id: string };
  event_type: EvidenceEventType;
  immutable: {
    event_id: string;
    sequence: number;
    subject: { type: EvidenceSubjectType; id: string };
    event_type: EvidenceEventType;
    payload_hash_sha256: string;
  };
  payload_hash_sha256: string;
  envelope_message_id?: string;
  retention: {
    retain_until: string;
    exportable: boolean;
    redaction_status: 'none' | 'redacted' | 'tombstoned';
    redaction_reason?: string;
  };
};

// Lab default only — not a retention/compliance policy commitment.
const DEFAULT_RETENTION_MS = 1000 * 60 * 60 * 24 * 365 * 2;

function newEventId(): string {
  return `evt_${randomBytes(16).toString('hex')}`;
}

export type InsertEvidenceInput = {
  subject: { type: EvidenceSubjectType; id: string };
  eventType: EvidenceEventType;
  data: unknown;
  predecessorEventId?: string;
  actorNodeId?: string;
  envelopeMessageId?: string;
  observedAt?: string;
};

export async function insertLoopEvidence(input: InsertEvidenceInput, db: Queryable = pool): Promise<EvidenceEntry> {
  const { rows: seqRows } = await db.query("SELECT nextval('loop_evidence_sequence') AS sequence", []);
  const sequence = Number((seqRows[0] as { sequence: string | number }).sequence);
  const eventId = newEventId();
  const payloadHash = canonicalHash(input.data);
  const recordedAt = new Date();
  const retainUntil = new Date(recordedAt.getTime() + DEFAULT_RETENTION_MS);

  const immutable = {
    event_id: eventId,
    sequence,
    subject: input.subject,
    event_type: input.eventType,
    payload_hash_sha256: payloadHash,
  };

  const { rows } = await db.query(
    `INSERT INTO loop_evidence (
      event_id, sequence, predecessor_event_id, recorded_at, observed_at, node_id, actor_node_id,
      subject_type, subject_id, event_type, immutable, payload_hash_sha256, envelope_message_id,
      retain_until, exportable, redaction_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING event_id, sequence, predecessor_event_id, recorded_at, observed_at, node_id, actor_node_id,
      subject_type, subject_id, event_type, immutable, payload_hash_sha256, envelope_message_id,
      retain_until, exportable, redaction_status, redaction_reason`,
    [
      eventId,
      sequence,
      input.predecessorEventId ?? null,
      recordedAt,
      input.observedAt ?? null,
      config.node.id,
      input.actorNodeId ?? null,
      input.subject.type,
      input.subject.id,
      input.eventType,
      immutable,
      payloadHash,
      input.envelopeMessageId ?? null,
      retainUntil,
      true,
      'none',
    ],
  );

  return rowToEvidenceEntry(rows[0]);
}

function rowToEvidenceEntry(row: Record<string, unknown>): EvidenceEntry {
  return {
    event_id: row.event_id as string,
    sequence: Number(row.sequence),
    ...(row.predecessor_event_id ? { predecessor_event_id: row.predecessor_event_id as string } : {}),
    recorded_at: new Date(row.recorded_at as string).toISOString(),
    ...(row.observed_at ? { observed_at: new Date(row.observed_at as string).toISOString() } : {}),
    node_id: row.node_id as string,
    ...(row.actor_node_id ? { actor_node_id: row.actor_node_id as string } : {}),
    subject: { type: row.subject_type as EvidenceSubjectType, id: row.subject_id as string },
    event_type: row.event_type as EvidenceEventType,
    immutable: row.immutable as EvidenceEntry['immutable'],
    payload_hash_sha256: row.payload_hash_sha256 as string,
    ...(row.envelope_message_id ? { envelope_message_id: row.envelope_message_id as string } : {}),
    retention: {
      retain_until: new Date(row.retain_until as string).toISOString(),
      exportable: row.exportable as boolean,
      redaction_status: row.redaction_status as EvidenceEntry['retention']['redaction_status'],
      ...(row.redaction_reason ? { redaction_reason: row.redaction_reason as string } : {}),
    },
  };
}

const EVIDENCE_SELECT_COLUMNS = `event_id, sequence, predecessor_event_id, recorded_at, observed_at, node_id, actor_node_id,
      subject_type, subject_id, event_type, immutable, payload_hash_sha256, envelope_message_id,
      retain_until, exportable, redaction_status, redaction_reason`;

export async function getLoopEvidenceByEventId(eventId: string): Promise<EvidenceEntry | undefined> {
  const { rows } = await pool.query(
    `SELECT ${EVIDENCE_SELECT_COLUMNS} FROM loop_evidence WHERE event_id = $1`,
    [eventId],
  );
  return rows[0] ? rowToEvidenceEntry(rows[0]) : undefined;
}

export type ListEvidenceFilters = {
  subjectType?: EvidenceSubjectType;
  subjectId?: string;
  eventTypeIn?: EvidenceEventType[];
  since?: string;
  limit: number;
  cursor?: string;
};

export type ListEvidenceResult = {
  results: EvidenceEntry[];
  next_cursor?: string;
};

export async function listLoopEvidence(filters: ListEvidenceFilters): Promise<ListEvidenceResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  function push(sql: string, value: unknown) {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  }

  if (filters.subjectType) push('subject_type = ?', filters.subjectType);
  if (filters.subjectId) push('subject_id = ?', filters.subjectId);
  if (filters.eventTypeIn?.length) push('event_type = ANY(?)', filters.eventTypeIn);
  if (filters.since) push('recorded_at >= ?', filters.since);
  if (filters.cursor) {
    const decoded = decodeCursor<{ s: number }>(filters.cursor);
    values.push(decoded.s);
    conditions.push(`sequence > $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(filters.limit + 1);

  const { rows } = await pool.query(
    `SELECT ${EVIDENCE_SELECT_COLUMNS} FROM loop_evidence ${whereClause} ORDER BY sequence ASC LIMIT $${values.length}`,
    values,
  );

  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const results = page.map(rowToEvidenceEntry);
  const next_cursor = hasMore ? encodeCursor({ s: results[results.length - 1]!.sequence }) : undefined;

  return { results, next_cursor };
}
