import { pool, withTransaction, type Queryable } from './pool';

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
    return { id: created.id, created_at: created.created_at, event };
  });
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
