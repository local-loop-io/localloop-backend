const { z } = require('zod');

const optionalTrimmed = (schema) =>
  schema
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() : value))
    .refine((value) => value === undefined || value === '' || value.length > 0, {
      message: 'Cannot be empty string',
    })
    .transform((value) => (value === '' ? undefined : value));

const interestSchema = z.object({
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

function validateInterest(payload) {
  const result = interestSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten() };
  }

  if (result.data.honey) {
    return { ok: false, errors: { formErrors: ['Spam detected.'] } };
  }

  const { honey, ...data } = result.data;
  return { ok: true, data };
}

module.exports = { validateInterest, interestSchema };
