import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';

/**
 * Matches profiles/core-dp/schemas/error.schema.json exactly (additionalProperties:
 * false there, so this shape must not gain extra fields without a schema update).
 */
export const CORE_DP_ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'duplicate',
  'stale_message',
  'unsupported_profile_version',
  'signature_invalid',
  'schema_invalid',
  'timeout',
  'partition',
  'internal_error',
] as const;

export type CoreDpErrorCode = (typeof CORE_DP_ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<CoreDpErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  duplicate: 409,
  stale_message: 409,
  unsupported_profile_version: 400,
  signature_invalid: 401,
  schema_invalid: 400,
  timeout: 504,
  partition: 503,
  internal_error: 500,
};

const RETRYABLE_BY_DEFAULT = new Set<CoreDpErrorCode>(['timeout', 'partition', 'internal_error']);

export function newCorrelationId(prefix: 'msg' | 'conv' = 'msg'): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

export class CoreDpError extends Error {
  readonly code: CoreDpErrorCode;
  readonly retryable: boolean;
  readonly correlationId: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CoreDpErrorCode,
    message: string,
    options: { correlationId?: string; retryable?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'CoreDpError';
    this.code = code;
    this.retryable = options.retryable ?? RETRYABLE_BY_DEFAULT.has(code);
    this.correlationId = options.correlationId ?? newCorrelationId('msg');
    this.details = options.details;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }

  toBody() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      correlation_id: this.correlationId,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function sendCoreDpError(reply: FastifyReply, error: CoreDpError) {
  reply.code(error.httpStatus).send(error.toBody());
}

/** Wrap an unknown caught value as an internal_error CoreDpError, preserving a CoreDpError as-is. */
export function toCoreDpError(error: unknown): CoreDpError {
  if (error instanceof CoreDpError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return new CoreDpError('internal_error', message);
}
