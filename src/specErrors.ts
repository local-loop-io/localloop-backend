import type { FastifyReply } from 'fastify';

/**
 * Error envelope required by SPECIFICATION §8.3:
 * `{ "error": { "code", "message", "details?" } }` with the canonical code set.
 * All lab API surfaces use this envelope — protocol endpoints (signals,
 * transaction, federate/*, protocol-mode search) via sendSpecError, and
 * pre-existing lab routes plus framework-level rejections via
 * sendSpecErrorForStatus (which preserves their pre-existing HTTP statuses).
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

/**
 * Maps an HTTP status code to the closest canonical §8.3 code. The canonical
 * set covers 400/401/403/404/409/500 directly; other client rejections
 * (e.g. 429) fall back to INVALID_REQUEST, other server-side failures
 * (e.g. 503 feature-disabled) to INTERNAL_ERROR. The HTTP status itself is
 * always preserved unchanged by sendSpecErrorForStatus.
 */
export function specErrorCodeForStatus(statusCode: number): SpecErrorCode {
  switch (statusCode) {
    case 400:
      return 'INVALID_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST';
  }
}

/**
 * §8.3 envelope for surfaces whose HTTP status predates the envelope
 * migration (legacy lab routes, Fastify rejections such as 415/429). Keeps
 * the original status code while normalizing the body shape.
 */
export function sendSpecErrorForStatus(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
) {
  reply.code(statusCode).send({
    error: {
      code: specErrorCodeForStatus(statusCode),
      message,
      ...(details ? { details } : {}),
    },
  });
}
