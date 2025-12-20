import { pool } from './pool';

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

export type LoopOfferPayload = {
  id: string;
  material_id: string;
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
  material_id: string;
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
  material_id: string;
  match_id: string;
  status: string;
  handoff_at: string;
  received_at?: string;
  schema_version: string;
  [key: string]: unknown;
};

export async function insertLoopMaterial(payload: LoopMaterialPayload) {
  const { rows } = await pool.query(
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

export async function insertLoopOffer(payload: LoopOfferPayload) {
  const { rows } = await pool.query(
    `INSERT INTO loop_offers (
      id, material_id, from_city, to_city, status, quantity_value, quantity_unit,
      available_until, terms, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id,
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

export async function insertLoopMatch(payload: LoopMatchPayload) {
  const { rows } = await pool.query(
    `INSERT INTO loop_matches (
      id, material_id, offer_id, from_city, to_city, status, matched_at, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id,
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

export async function insertLoopTransfer(payload: LoopTransferPayload) {
  const { rows } = await pool.query(
    `INSERT INTO loop_transfers (
      id, material_id, match_id, status, handoff_at, received_at, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id, created_at`,
    [
      payload.id,
      payload.material_id,
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
}) {
  const { rows } = await pool.query(
    `INSERT INTO loop_events (event_type, entity_type, entity_id, payload)
     VALUES ($1,$2,$3,$4)
     RETURNING id, created_at`,
    [event.event_type, event.entity_type, event.entity_id, event.payload],
  );
  return rows[0] as { id: number; created_at: string };
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

export async function getLoopOffer(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id FROM loop_offers WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string; material_id: string } | undefined;
}

export async function getLoopMatch(id: string) {
  const { rows } = await pool.query(
    'SELECT id, material_id, offer_id FROM loop_matches WHERE id = $1',
    [id],
  );
  return rows[0] as { id: string; material_id: string; offer_id: string } | undefined;
}
