import { createHash } from 'node:crypto';

/**
 * Deterministic JSON stringify: object keys sorted recursively so the same logical
 * value always produces the same bytes, regardless of property insertion order.
 * Used anywhere a stable hash or signature must be computed over a JSON value
 * (search record hashes, evidence payload hashes, envelope signing input).
 */
export function canonicalJsonStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    // `undefined` array elements (and holes) must serialize as "null", matching
    // native JSON.stringify, not vanish the way Array.prototype.join renders
    // undefined join results — otherwise the joined string is invalid JSON.
    return `[${value.map((item) => (item === undefined ? 'null' : stringify(item))).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalJsonStringify(value));
}
