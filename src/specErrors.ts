import type { FastifyReply } from 'fastify';

/**
 * Error envelope required by SPECIFICATION §8.3 for protocol endpoints:
 * `{ "error": { "code", "message", "details?" } }` with the canonical code set.
 * New protocol endpoints (signals, transaction, federate/*, protocol-mode
 * search) use this envelope; older lab routes predate it and still return the
 * legacy flat `{ "error": "message" }` shape (tracked in SPEC-COMPLIANCE.md).
 */
export const SPEC_ERROR_CODES = [
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const;

export type SpecErrorCode = (typeof SPEC_ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<SpecErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

/**
 * Fastify/fast-json-stringify response schema for the §8.3 envelope.
 * `details` needs explicit additionalProperties — without it the serializer
 * strips the details' contents.
 */
export const specErrorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
      },
    },
  },
};

export function sendSpecError(
  reply: FastifyReply,
  code: SpecErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  reply.code(HTTP_STATUS_BY_CODE[code]).send({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
