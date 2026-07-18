import { pool, withTransaction, type Queryable } from './pool';
import { config } from '../config';
import { canonicalHash } from '../crypto/canonical';
import { encodeCursor, decodeCursor, escapeLikePrefix } from '../pagination';
import { CoreDpError } from '../errors';
import { insertLoopEvidence, type EvidenceEventType } from './evidence';

/**
 * Thrown by the transactional create* operations when a state-machine rule is
 * violated. Routes map `not_found` -> 404 and `invalid_state` -> 400.
 */
export class LoopStateError extends Error {
  readonly kind: 'not_found' | 'invalid_state';
  constructor(kind: 'not_found' | 'invalid_state', message: string) {
    super(message);
    this.name = 'LoopStateError';
    this.kind = kind;
  }
}

/** Offer/match statuses that count as "live" for single-allocation invariants. */
const MATCH_ACTIVE_STATUSES = ['proposed', 'accepted'];

/** Result of a transactional create: the new row plus the event to broadcast after commit. */
export type LoopCreateResult = {
  id: string;
  created_at: string;
  event: Record<string, unknown>;
};

export type LoopMaterialPayload = {
  id: string;
  category: string;
  quantity: { value: number; unit: string };
  quality?: number;
  origin_city: string;
  current_city: string;
  available_from: string;
  expires?: string;
  schema_version: string;
  [key: string]: unknown;
};

export type LoopProductPayload = {
  id: string;
  product_category: string;
  name: string;
  condition: string;
  quantity: { value: number; unit: string };
  origin_city: string;
  current_city: string;
  available_from: string;
  expires?: string;
  schema_version: string;
  [key: string]: unknown;
};

export type LoopOfferPayload = {
  id: string;
  material_id?: string;
  product_id?: string;
  from_city: string;
  to_city: string;
  quantity: { value: number; unit: string };
  status: string;
  available_until: string;
  terms?: string;
  schema_version: string;
  [key: string]: unknown;
};

export type LoopMatchPayload = {
  id: string;
  material_id?: string;
  product_id?: string;
  offer_id: string;
  from_city: string;
  to_city: string;
  status: string;
  matched_at: string;
  schema_version: string;
  [key: string]: unknown;
};

export type LoopTransferPayload = {
  id: string;
  material_id?: string;
  product_id?: string;
  match_id: string;
  status: string;
  handoff_at: string;
  received_at?: string;
  schema_version: string;
  [key: string]: unknown;
};

export async function insertLoopMaterial(payload: LoopMaterialPayload, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_materials (
      id, category, quantity_value, quantity_unit, origin_city, current_city,
      available_from, expires_at, quality, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.category,
      payload.quantity.value,
      payload.quantity.unit,
      payload.origin_city,
      payload.current_city,
      payload.available_from,
      payload.expires ?? null,
      payload.quality ?? null,
      payload,
    ],
  );
  return rows[0] as { id: string; created_at: string };
}

export async function insertLoopProduct(payload: LoopProductPayload, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_products (
      id, product_category, name, condition, quantity_value, quantity_unit,
      origin_city, current_city, available_from, expires_at, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.product_category,
      payload.name,
      payload.condition,
      payload.quantity.value,
      payload.quantity.unit,
      payload.origin_city,
      payload.current_city,
      payload.available_from,
      payload.expires ?? null,
      payload,
    ],
  );
  return rows[0] as { id: string; created_at: string };
}

export async function insertLoopOffer(payload: LoopOfferPayload, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_offers (
      id, material_id, product_id, from_city, to_city, status, quantity_value, quantity_unit,
      available_until, terms, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id ?? null,
      payload.product_id ?? null,
      payload.from_city,
      payload.to_city,
      payload.status,
      payload.quantity.value,
      payload.quantity.unit,
      payload.available_until,
      payload.terms ?? null,
      payload,
    ],
  );
  return rows[0] as { id: string; created_at: string };
}

export async function insertLoopMatch(payload: LoopMatchPayload, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_matches (
      id, material_id, product_id, offer_id, from_city, to_city, status, matched_at, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id ?? null,
      payload.product_id ?? null,
      payload.offer_id,
      payload.from_city,
      payload.to_city,
      payload.status,
      payload.matched_at,
      payload,
    ],
  );
  return rows[0] as { id: string; created_at: string };
}

export async function insertLoopTransfer(payload: LoopTransferPayload, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_transfers (
      id, material_id, product_id, match_id, status, handoff_at, received_at, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id ?? null,
      payload.product_id ?? null,
      payload.match_id,
      payload.status,
      payload.handoff_at,
      payload.received_at ?? null,
      payload,
    ],
  );
  return rows[0] as { id: string; created_at: string };
}

export async function insertLoopEvent(event: {
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: unknown;
}, db: Queryable = pool) {
  const { rows } = await db.query(
    `INSERT INTO loop_events (event_type, entity_type, entity_id, payload)
     VALUES ($1,$2,$3,$4)
     RETURNING id, created_at`,
    [event.event_type, event.entity_type, event.entity_id, event.payload],
  );
  return rows[0] as { id: number; created_at: string };
}

/**
 * Build the canonical event payload that is both persisted to loop_events and
 * broadcast over SSE. Keeps the two in lock-step (they were identical objects
 * in the route handlers previously).
 */
function buildLoopEvent(
  type: string,
  entity: string,
  entity_id: string,
  data: unknown,
  created_at: string,
): Record<string, unknown> {
  return { type, entity, entity_id, data, created_at };
}

// --- Transactional create operations -----------------------------------------
// Each wraps the entity insert, the loop_events insert, and any status
// transition in a single transaction. The returned `event` must be broadcast by
// the caller AFTER the promise resolves (i.e. after COMMIT), never before.

export async function createLoopMaterial(payload: LoopMaterialPayload): Promise<LoopCreateResult> {
  return withTransaction(async (client) => {
    const created = await insertLoopMaterial(payload, client);
    const event = buildLoopEvent('material.created', 'material', created.id, payload, created.created_at);
    await insertLoopEvent(
      { event_type: 'material.created', entity_type: 'material', entity_id: created.id, payload: event },
      client,
    );
    await insertLoopEvidence(
      { subject: { type: 'material', id: created.id }, eventType: 'registered', data: payload },
      client,
    );
    return { id: created.id, created_at: created.created_at, event };
  });
}

export async function createLoopProduct(payload: LoopProductPayload): Promise<LoopCreateResult> {
  return withTransaction(async (client) => {
    const created = await insertLoopProduct(payload, client);
    const event = buildLoopEvent('product.created', 'product', created.id, payload, created.created_at);
    await insertLoopEvent(
      { event_type: 'product.created', entity_type: 'product', entity_id: created.id, payload: event },
      client,
    );
    await insertLoopEvidence(
      { subject: { type: 'product', id: created.id }, eventType: 'registered', data: payload },
      client,
    );
    return { id: created.id, created_at: created.created_at, event };
  });
}

export async function createLoopOffer(payload: LoopOfferPayload): Promise<LoopCreateResult> {
  return withTransaction(async (client) => {
    // Mass-balance sanity: an offer cannot promise more than its source material holds.
    if (payload.material_id) {
      const { rows } = await client.query(
        'SELECT quantity_value FROM loop_materials WHERE id = $1',
        [payload.material_id],
      );
      const material = rows[0] as { quantity_value: string | number } | undefined;
      if (material && Number(payload.quantity.value) > Number(material.quantity_value)) {
        throw new LoopStateError(
          'invalid_state',
          'Offer quantity exceeds available material quantity',
        );
      }
    }
    const created = await insertLoopOffer(payload, client);
    const event = buildLoopEvent('offer.created', 'offer', created.id, payload, created.created_at);
    await insertLoopEvent(
      { event_type: 'offer.created', entity_type: 'offer', entity_id: created.id, payload: event },
      client,
    );
    await insertLoopEvidence(
      { subject: { type: 'offer', id: created.id }, eventType: 'offer-published', data: payload },
      client,
    );
    return { id: created.id, created_at: created.created_at, event };
  });
}

export async function createLoopMatch(payload: LoopMatchPayload): Promise<LoopCreateResult> {
  return withTransaction(async (client) => {
    // Lock the offer row so concurrent matches serialize; re-read the committed status.
    const { rows } = await client.query(
      'SELECT status FROM loop_offers WHERE id = $1 FOR UPDATE',
      [payload.offer_id],
    );
    const offer = rows[0] as { status: string } | undefined;
    if (!offer) {
      throw new LoopStateError('not_found', 'Unknown offer_id');
    }
    if (offer.status !== 'open') {
      throw new LoopStateError('invalid_state', `Offer is not open (status=${offer.status})`);
    }

    const created = await insertLoopMatch(payload, client);

    // Reserving the offer prevents further matches; the partial unique index on
    // (offer_id WHERE status IN active) is the backstop for any concurrent path.
    if (MATCH_ACTIVE_STATUSES.includes(payload.status)) {
      await client.query('UPDATE loop_offers SET status = $1 WHERE id = $2', ['reserved', payload.offer_id]);
    }

    const event = buildLoopEvent('match.created', 'match', created.id, payload, created.created_at);
    await insertLoopEvent(
      { event_type: 'match.created', entity_type: 'match', entity_id: created.id, payload: event },
      client,
    );
    await insertLoopEvidence(
      { subject: { type: 'match', id: created.id }, eventType: matchEvidenceEventType(payload.status), data: payload },
      client,
    );
    return { id: created.id, created_at: created.created_at, event };
  });
}

/**
 * Maps a loop_matches.status value to the closest evidence-entry event_type.
 * `expired` has no dedicated evidence event in this lab profile, so it is
 * recorded as a rejection (the closest terminal-negative outcome).
 */
function matchEvidenceEventType(status: string): EvidenceEventType {
  if (status === 'accepted') return 'match-accepted';
  if (status === 'rejected' || status === 'expired') return 'match-rejected';
  return 'match-proposed';
}

/**
 * Maps a loop_transfers.status value to the closest evidence-entry event_type.
 * This profile's transfer creation is single-shot (no separate dispatch/receive/ack
 * calls yet), so `scheduled`/`in_transit` record as `dispatched` and a terminal
 * `completed` status records as `received`. `cancelled` must NOT record as
 * `dispatched` — since loop_evidence is append-only, that would permanently
 * misrepresent a transfer that never happened as one that did. There is no
 * dedicated "cancelled" event_type in this profile's evidence-entry schema, so
 * `error-recorded` (the generic non-success outcome) is the closest honest fit.
 */
function transferEvidenceEventType(status: string): EvidenceEventType {
  if (status === 'completed') return 'transfer-received';
  if (status === 'cancelled') return 'error-recorded';
  return 'transfer-dispatched';
}

export async function createLoopTransfer(payload: LoopTransferPayload): Promise<LoopCreateResult> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT status FROM loop_matches WHERE id = $1 FOR UPDATE',
      [payload.match_id],
    );
    const match = rows[0] as { status: string } | undefined;
    if (!match) {
      throw new LoopStateError('not_found', 'Unknown match_id');
    }
    if (match.status !== 'accepted') {
      throw new LoopStateError('invalid_state', `Match is not accepted (status=${match.status})`);
    }

    const created = await insertLoopTransfer(payload, client);
    const event = buildLoopEvent('transfer.created', 'transfer', created.id, payload, created.created_at);
    await insertLoopEvent(
      { event_type: 'transfer.created', entity_type: 'transfer', entity_id: created.id, payload: event },
      client,
    );
    await insertLoopEvidence(
      { subject: { type: 'transfer', id: created.id }, eventType: transferEvidenceEventType(payload.status), data: payload },
      client,
    );
    return { id: created.id, created_at: created.created_at, event };
  });
}

export async function listLoopEvents(limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, event_type, entity_type, entity_id, payload, created_at
     FROM loop_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function getLoopMaterial(id: string) {
  const { rows } = await pool.query(
    'SELECT id FROM loop_materials WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string } | undefined;
}

export async function getLoopMaterialById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, category, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, quality, payload, created_at FROM loop_materials WHERE id = $1',
    [id],
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function listLoopMaterials(opts: { limit?: number; category?: string } = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  if (opts.category) {
    const { rows } = await pool.query(
      'SELECT id, category, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, quality, payload, created_at FROM loop_materials WHERE category = $1 ORDER BY created_at DESC LIMIT $2',
      [opts.category, limit],
    );
    return rows as Record<string, unknown>[];
  }
  const { rows } = await pool.query(
    'SELECT id, category, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, quality, payload, created_at FROM loop_materials ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows as Record<string, unknown>[];
}

export async function getLoopProduct(id: string) {
  const { rows } = await pool.query(
    'SELECT id FROM loop_products WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string } | undefined;
}

export async function getLoopProductById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, product_category, name, condition, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, payload, created_at FROM loop_products WHERE id = $1',
    [id],
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function listLoopProducts(opts: { limit?: number; category?: string } = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  if (opts.category) {
    const { rows } = await pool.query(
      'SELECT id, product_category, name, condition, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, payload, created_at FROM loop_products WHERE product_category = $1 ORDER BY created_at DESC LIMIT $2',
      [opts.category, limit],
    );
    return rows as Record<string, unknown>[];
  }
  const { rows } = await pool.query(
    'SELECT id, product_category, name, condition, quantity_value, quantity_unit, origin_city, current_city, available_from, expires_at, payload, created_at FROM loop_products ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows as Record<string, unknown>[];
}

export async function getLoopOffer(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, status FROM loop_offers WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string; material_id: string | null; product_id: string | null; status: string } | undefined;
}

export async function getLoopOfferById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, from_city, to_city, status, quantity_value, quantity_unit, available_until, terms, payload, created_at FROM loop_offers WHERE id = $1',
    [id],
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function listLoopOffers(opts: { limit?: number; status?: string } = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  if (opts.status) {
    const { rows } = await pool.query(
      'SELECT id, material_id, product_id, from_city, to_city, status, quantity_value, quantity_unit, available_until, terms, payload, created_at FROM loop_offers WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
      [opts.status, limit],
    );
    return rows as Record<string, unknown>[];
  }
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, from_city, to_city, status, quantity_value, quantity_unit, available_until, terms, payload, created_at FROM loop_offers ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows as Record<string, unknown>[];
}

export async function getLoopMatch(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, offer_id, status FROM loop_matches WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string; material_id: string | null; product_id: string | null; offer_id: string; status: string } | undefined;
}

export async function getLoopMatchById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, offer_id, from_city, to_city, status, matched_at, payload, created_at FROM loop_matches WHERE id = $1',
    [id],
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function listLoopMatches(opts: { limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, offer_id, from_city, to_city, status, matched_at, payload, created_at FROM loop_matches ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows as Record<string, unknown>[];
}

export async function getLoopTransferById(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, match_id, status, handoff_at, received_at, payload, created_at FROM loop_transfers WHERE id = $1',
    [id],
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function listLoopTransfers(opts: { limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const { rows } = await pool.query(
    'SELECT id, material_id, product_id, match_id, status, handoff_at, received_at, payload, created_at FROM loop_transfers ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return rows as Record<string, unknown>[];
}

// --- Core-DP local search (MaterialDNA / ProductDNA) --------------------------
// Implements profiles/core-dp/schemas/search-contract.schema.json's local-scope
// contract: exact filters, deterministic updated_at_asc/id_asc ordering, opaque
// cursor pagination, and a per-result record_hash_sha256/source_node/updated_at.
// Cross-node search (scope: "cross-node") requires the signed envelope + peer
// federation machinery and is out of scope for this lab preview; callers get an
// `invalid_request` CoreDpError if they ask for it.

export type LoopSearchFilters = {
  category_prefix?: string;
  id_prefix?: string;
  origin_city?: string;
  current_city?: string;
  available_from_gte?: string;
  available_from_lt?: string;
  quantity_min?: number;
  condition?: string;
  updated_since?: string;
};

export type LoopSearchOptions = {
  filters: LoopSearchFilters;
  limit: number;
  cursor?: string;
  strictFiltering?: boolean;
};

export type LoopSearchResultRow = Record<string, unknown> & {
  id: string;
  source_node: string;
  record_hash_sha256: string;
  updated_at: string;
};

export type LoopSearchResult = {
  results: LoopSearchResultRow[];
  next_cursor?: string;
};

type EntitySearchConfig = {
  table: 'loop_materials' | 'loop_products';
  categoryColumn: 'category' | 'product_category';
  supportsCondition: boolean;
  selectColumns: string[];
};

const MATERIAL_SEARCH_CONFIG: EntitySearchConfig = {
  table: 'loop_materials',
  categoryColumn: 'category',
  supportsCondition: false,
  selectColumns: [
    'id', 'category', 'quantity_value', 'quantity_unit', 'origin_city', 'current_city',
    'available_from', 'expires_at', 'quality', 'payload', 'created_at', 'updated_at',
  ],
};

const PRODUCT_SEARCH_CONFIG: EntitySearchConfig = {
  table: 'loop_products',
  categoryColumn: 'product_category',
  supportsCondition: true,
  selectColumns: [
    'id', 'product_category', 'name', 'condition', 'quantity_value', 'quantity_unit',
    'origin_city', 'current_city', 'available_from', 'expires_at', 'payload', 'created_at', 'updated_at',
  ],
};

async function runEntitySearch(entityConfig: EntitySearchConfig, opts: LoopSearchOptions): Promise<LoopSearchResult> {
  const { filters, limit, cursor, strictFiltering } = opts;

  if (strictFiltering && filters.condition !== undefined && !entityConfig.supportsCondition) {
    throw new CoreDpError('invalid_request', `'condition' filter does not apply to ${entityConfig.table}`);
  }

  const conditions: string[] = [];
  const values: unknown[] = [];

  function push(sql: string, value: unknown) {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  }

  if (filters.category_prefix) {
    push(`${entityConfig.categoryColumn} LIKE ? ESCAPE '\\'`, `${escapeLikePrefix(filters.category_prefix)}%`);
  }
  if (filters.id_prefix) {
    push(`id LIKE ? ESCAPE '\\'`, `${escapeLikePrefix(filters.id_prefix)}%`);
  }
  if (filters.origin_city) {
    push('origin_city = ?', filters.origin_city);
  }
  if (filters.current_city) {
    push('current_city = ?', filters.current_city);
  }
  if (filters.available_from_gte) {
    push('available_from >= ?', filters.available_from_gte);
  }
  if (filters.available_from_lt) {
    push('available_from < ?', filters.available_from_lt);
  }
  if (filters.quantity_min !== undefined) {
    push('quantity_value >= ?', filters.quantity_min);
  }
  if (filters.condition !== undefined && entityConfig.supportsCondition) {
    push('condition = ?', filters.condition);
  }
  if (filters.updated_since) {
    push('updated_at >= ?', filters.updated_since);
  }
  // Cursor continuation uses EXTRACT(EPOCH ...) rather than a JS Date/ISO-string
  // round trip: `timestamptz` has microsecond precision but JS Date only keeps
  // milliseconds, so two rows within the same millisecond (easily hit when
  // several rows are inserted back-to-back in a test or a burst of writes)
  // would collapse to an equal, truncated cursor value and re-match on the
  // next page. A double-precision epoch-seconds value round-trips exactly.
  if (cursor) {
    const decoded = decodeCursor<{ u: number; i: string }>(cursor);
    values.push(decoded.u, decoded.i);
    conditions.push(`(EXTRACT(EPOCH FROM updated_at), id) > ($${values.length - 1}::double precision, $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit + 1);

  const { rows } = await pool.query(
    `SELECT ${entityConfig.selectColumns.join(', ')}, EXTRACT(EPOCH FROM updated_at) AS updated_at_epoch
     FROM ${entityConfig.table} ${whereClause}
     ORDER BY updated_at ASC, id ASC LIMIT $${values.length}`,
    values,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const results: LoopSearchResultRow[] = page.map((row: Record<string, unknown>) => ({
    ...(row.payload as Record<string, unknown>),
    id: row.id as string,
    source_node: config.node.id,
    record_hash_sha256: canonicalHash(row.payload),
    updated_at: new Date(row.updated_at as string).toISOString(),
  }));

  const next_cursor = hasMore
    ? encodeCursor({
        u: Number((page[page.length - 1] as Record<string, unknown>).updated_at_epoch),
        i: (page[page.length - 1] as Record<string, unknown>).id as string,
      })
    : undefined;

  return { results, next_cursor };
}

export async function searchLoopMaterials(opts: LoopSearchOptions): Promise<LoopSearchResult> {
  return runEntitySearch(MATERIAL_SEARCH_CONFIG, opts);
}

export async function searchLoopProducts(opts: LoopSearchOptions): Promise<LoopSearchResult> {
  return runEntitySearch(PRODUCT_SEARCH_CONFIG, opts);
}
