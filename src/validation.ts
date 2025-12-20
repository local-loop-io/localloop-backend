import { z } from 'zod';

const optionalTrimmed = (schema: z.ZodString) =>
  schema
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() : value))
    .refine((value) => value === undefined || value === '' || value.length > 0, {
      message: 'Cannot be empty string',
    })
    .transform((value) => (value === '' ? undefined : value));

export const interestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  organization: optionalTrimmed(z.string().max(120)),
  role: optionalTrimmed(z.string().max(80)),
  country: optionalTrimmed(z.string().max(80)),
  city: optionalTrimmed(z.string().max(80)),
  website: optionalTrimmed(z.string().url().max(200)),
  email: optionalTrimmed(z.string().email().max(120)),
  message: optionalTrimmed(z.string().max(500)),
  shareEmail: z.boolean().optional().default(false),
  consentPublic: z.literal(true),
  honey: optionalTrimmed(z.string().max(100)).optional(),
});

export type InterestInput = z.infer<typeof interestSchema>;

export function validateInterest(payload: unknown) {
  const result = interestSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false as const, errors: result.error.flatten() };
  }

  if (result.data.honey) {
    return { ok: false as const, errors: { formErrors: ['Spam detected.'] } };
  }

  const { honey, ...data } = result.data;
  return { ok: true as const, data };
}

export const paymentIntentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  organization: optionalTrimmed(z.string().max(120)),
  email: optionalTrimmed(z.string().email().max(120)),
  amount: z.number().positive(),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  note: optionalTrimmed(z.string().max(280)),
  metadata: z.record(z.unknown()).optional(),
});

export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>;

export function validatePaymentIntent(payload: unknown) {
  const result = paymentIntentSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false as const, errors: result.error.flatten() };
  }

  return { ok: true as const, data: result.data };
}
