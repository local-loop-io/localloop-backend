import { pool } from './pool';

export type InterestEventInput = {
  interestId: number;
  eventType: string;
  payload: Record<string, unknown>;
};

export async function insertInterestEvent(input: InterestEventInput) {
  const query = `
    INSERT INTO interest_events (interest_id, event_type, payload)
    VALUES ($1, $2, $3)
    RETURNING id, created_at;
  `;

  const result = await pool.query(query, [
    input.interestId,
    input.eventType,
    input.payload,
  ]);

  return result.rows[0];
}
