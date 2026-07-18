import { CoreDpError } from './errors';

/**
 * Opaque cursor helpers shared by search and evidence listing. Format matches
 * profiles/core-dp/schemas/search-contract.schema.json's `cur_[A-Za-z0-9_-]{16,200}`
 * pattern: a `cur_` prefix over base64url JSON, which is exactly Node's base64url
 * alphabet, so no further escaping is needed.
 */
export function encodeCursor(parts: Record<string, string | number>): string {
  const json = JSON.stringify(parts);
  return `cur_${Buffer.from(json, 'utf8').toString('base64url')}`;
}

export function decodeCursor<T = Record<string, string | number>>(cursor: string): T {
  // A malformed cursor is a client input error, not a server fault: throw a
  // CoreDpError directly so it maps to invalid_request/400 (non-retryable)
  // instead of falling through to the generic internal_error/500 wrapper,
  // which would also leak the raw engine error message to the client.
  if (!cursor.startsWith('cur_')) {
    throw new CoreDpError('invalid_request', 'Invalid cursor: missing cur_ prefix');
  }
  try {
    const json = Buffer.from(cursor.slice('cur_'.length), 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    throw new CoreDpError('invalid_request', 'Invalid cursor: malformed cursor payload');
  }
}

/** Escape a literal prefix for use in a LIKE pattern with ESCAPE '\'. */
export function escapeLikePrefix(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
