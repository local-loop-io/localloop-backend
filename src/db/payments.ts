import { pool } from './pool';

export type PaymentIntentInput = {
  name: string;
  organization?: string | null;
  email?: string | null;
  amountCents: number;
  currency: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PaymentIntentRecord = {
  id: number;
  status: string;
  created_at: string;
};

export type PaymentWebhookInput = {
  provider?: string | null;
  payload: Record<string, unknown>;
};

export async function insertPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentRecord> {
  const query = `
    INSERT INTO payment_intents (
      name,
      organization,
      email,
      amount_cents,
      currency,
      note,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id, status, created_at;
  `;

  const values = [
    input.name,
    input.organization ?? null,
    input.email ?? null,
    input.amountCents,
    input.currency,
    input.note ?? null,
    input.metadata ?? null,
  ];

  const result = await pool.query<PaymentIntentRecord>(query, values);
  return result.rows[0];
}

export async function insertPaymentWebhook(input: PaymentWebhookInput) {
  const query = `
    INSERT INTO payment_webhooks (provider, payload)
    VALUES ($1, $2)
    RETURNING id, created_at;
  `;

  const result = await pool.query(query, [input.provider ?? null, input.payload]);
  return result.rows[0];
}
