import { createPublicKey, randomBytes, sign as cryptoSign, verify as cryptoVerify, type KeyLike } from 'node:crypto';
import { canonicalJsonStringify, sha256Hex } from './crypto/canonical';
import { CoreDpError, newCorrelationId, type CoreDpErrorCode } from './errors';

/**
 * Core-DP signed message envelope (LAB ONLY).
 *
 * Mirrors ../../loop-protocol profiles/core-dp/schemas/envelope.schema.json and the
 * canonical signing input documented in profiles/core-dp/README.md ("Signed Envelope"
 * section). This is not a production security claim — see that schema's description.
 */

export const CORE_DP_PROFILE = 'core-dp' as const;
export const CORE_DP_PROFILE_VERSION = '0.1.0-lab' as const;
export const CORE_DP_SIGNATURE_ALG = 'Ed25519-lab-detached-v1' as const;

export const MIN_REPLAY_WINDOW_SECONDS = 60;
export const MAX_REPLAY_WINDOW_SECONDS = 900;
export const DEFAULT_REPLAY_WINDOW_SECONDS = 300;

export interface NodeRef {
  node_id: string;
  endpoint: string;
  key_id: string;
}

export interface VersionNegotiation {
  requested: typeof CORE_DP_PROFILE_VERSION;
  supported: string[];
}

export interface EnvelopeSignature {
  alg: typeof CORE_DP_SIGNATURE_ALG;
  key_id: string;
  signing_input_sha256: string;
  value: string;
}

/** The envelope shape before a detached signature has been computed for it. */
export interface EnvelopeWithoutSignature {
  profile: typeof CORE_DP_PROFILE;
  profile_version: typeof CORE_DP_PROFILE_VERSION;
  message_id: string;
  message_type: string;
  created_at: string;
  expires_at: string;
  sender: NodeRef;
  receiver: NodeRef;
  idempotency_key: string;
  replay_window_seconds: number;
  body_schema: string;
  body: Record<string, unknown>;
  version_negotiation?: VersionNegotiation;
}

export interface SignedEnvelope extends EnvelopeWithoutSignature {
  signature: EnvelopeSignature;
}

/**
 * Exact field set that makes up the canonical signing input, per
 * profiles/core-dp/README.md's "Signed Envelope" section. Notably this excludes
 * `replay_window_seconds` and `version_negotiation` (present on the envelope but
 * outside the signed subset) as well as `signature` itself. Verified empirically
 * against the pinned signing_input_sha256 values in
 * profiles/core-dp/conformance/vectors/core-dp-vectors.json.
 */
const SIGNING_INPUT_FIELDS = [
  'profile',
  'profile_version',
  'message_id',
  'message_type',
  'created_at',
  'expires_at',
  'sender',
  'receiver',
  'idempotency_key',
  'body_schema',
  'body',
] as const satisfies readonly (keyof EnvelopeWithoutSignature)[];

/**
 * Canonical UTF-8 JSON signing input: lexicographically-sorted-key JSON over the
 * fixed field subset above. This is what signEnvelope signs and what
 * verifyEnvelopeSignature re-verifies against — never the raw envelope object,
 * so that fields outside the signed subset (replay_window_seconds,
 * version_negotiation) can vary without invalidating the signature.
 */
export function canonicalSigningInput(envelope: EnvelopeWithoutSignature): string {
  const subset: Record<string, unknown> = {};
  for (const field of SIGNING_INPUT_FIELDS) {
    subset[field] = envelope[field];
  }
  return canonicalJsonStringify(subset);
}

function generateIdempotencyKey(): string {
  return `idem_${randomBytes(16).toString('hex')}`;
}

/**
 * RFC 3339 requires an explicit UTC ('Z') or numeric offset designator on a
 * date-time. Per ECMA-262, `new Date(str)` silently parses a designator-less
 * string (e.g. "2026-07-17T00:00:00") as the *host process's local time*, not
 * UTC — which would shift replay-window and key-validity-window decisions by
 * the deployment's UTC offset for a value that came from an untrusted peer.
 * All date-time fields entering this module (received or looked up from a
 * trust store) are parsed through this helper instead of a bare `new Date()`
 * so that ambiguity is rejected outright rather than silently misinterpreted.
 */
const RFC3339_UTC_OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i;

function parseStrictDateTime(value: string, fieldName: string, errorCode: CoreDpErrorCode): Date {
  if (!RFC3339_UTC_OFFSET_SUFFIX.test(value)) {
    throw new CoreDpError(
      errorCode,
      `${fieldName} must be an RFC 3339 date-time with an explicit UTC/offset designator (e.g. a trailing 'Z'): '${value}'`,
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CoreDpError(errorCode, `${fieldName} is not a valid date-time: '${value}'`);
  }
  return date;
}

export interface CreateEnvelopeFields {
  message_type: string;
  sender: NodeRef;
  receiver: NodeRef;
  body_schema: string;
  body: Record<string, unknown>;
  message_id?: string;
  idempotency_key?: string;
  /** Defaults to now. */
  created_at?: string;
  /** Defaults to created_at + replay_window_seconds. */
  expires_at?: string;
  /** Defaults to DEFAULT_REPLAY_WINDOW_SECONDS (300); must be within [60, 900]. */
  replay_window_seconds?: number;
  version_negotiation?: VersionNegotiation;
}

/**
 * Builds a Core-DP envelope matching envelope.schema.json's required fields,
 * excluding `signature` (signing happens separately via signEnvelope).
 */
export function createEnvelope(fields: CreateEnvelopeFields): EnvelopeWithoutSignature {
  const replayWindowSeconds = fields.replay_window_seconds ?? DEFAULT_REPLAY_WINDOW_SECONDS;
  if (replayWindowSeconds < MIN_REPLAY_WINDOW_SECONDS || replayWindowSeconds > MAX_REPLAY_WINDOW_SECONDS) {
    throw new CoreDpError(
      'schema_invalid',
      `replay_window_seconds must be between ${MIN_REPLAY_WINDOW_SECONDS} and ${MAX_REPLAY_WINDOW_SECONDS}, got ${replayWindowSeconds}`,
    );
  }

  const createdAt = fields.created_at
    ? parseStrictDateTime(fields.created_at, 'created_at', 'schema_invalid')
    : new Date();
  const expiresAt = fields.expires_at
    ? parseStrictDateTime(fields.expires_at, 'expires_at', 'schema_invalid')
    : new Date(createdAt.getTime() + replayWindowSeconds * 1000);

  const envelope: EnvelopeWithoutSignature = {
    profile: CORE_DP_PROFILE,
    profile_version: CORE_DP_PROFILE_VERSION,
    message_id: fields.message_id ?? newCorrelationId('msg'),
    message_type: fields.message_type,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    sender: fields.sender,
    receiver: fields.receiver,
    idempotency_key: fields.idempotency_key ?? generateIdempotencyKey(),
    replay_window_seconds: replayWindowSeconds,
    body_schema: fields.body_schema,
    body: fields.body,
    ...(fields.version_negotiation ? { version_negotiation: fields.version_negotiation } : {}),
  };

  return envelope;
}

/**
 * Computes signing_input_sha256 over the canonical signing input, signs those
 * same canonical bytes with detached Ed25519 (node:crypto — Ed25519 uses
 * algorithm=null for both sign and verify), and returns the full envelope with
 * its signature attached.
 */
export function signEnvelope(
  envelope: EnvelopeWithoutSignature,
  privateKey: KeyLike,
  keyId: string,
): SignedEnvelope {
  const signingInput = canonicalSigningInput(envelope);
  const signingInputSha256 = sha256Hex(signingInput);
  const signatureBytes = cryptoSign(null, Buffer.from(signingInput, 'utf8'), privateKey);
  const value = signatureBytes.toString('base64url');

  return {
    ...envelope,
    signature: {
      alg: CORE_DP_SIGNATURE_ALG,
      key_id: keyId,
      signing_input_sha256: signingInputSha256,
      value,
    },
  };
}

export interface TrustStoreKeyEntry {
  node_id: string;
  key_id: string;
  public_key_jwk: {
    kty: 'OKP';
    crv: 'Ed25519';
    x: string;
  };
  lifecycle_status: 'active' | 'rotated' | 'revoked';
  valid_from: string;
  valid_until: string;
  revoked_at?: string;
  rotated_to_key_id?: string;
}

export interface TrustStore {
  version: string;
  updated_at: string;
  keys: TrustStoreKeyEntry[];
}

/**
 * Verifies a signed envelope's detached Ed25519 signature against a receiver-owned
 * trust store, per trust-store.schema.json. Throws CoreDpError('signature_invalid', ...)
 * for any of: signature.alg not the supported lab algorithm, signature.key_id not
 * matching sender.key_id, no trusted key found for (sender.node_id, sender.key_id),
 * the trusted key being revoked, the trusted key being outside its
 * [valid_from, valid_until) window at the envelope's created_at, a recomputed
 * signing_input_sha256 mismatch (defence in depth against a tampered
 * signing_input_sha256 that doesn't match the actual body), or the detached
 * Ed25519 signature itself failing to verify.
 *
 * Returns the matched trust store entry on success.
 */
export function verifyEnvelopeSignature(envelope: SignedEnvelope, trustStore: TrustStore): TrustStoreKeyEntry {
  const { signature, sender } = envelope;

  if (signature.alg !== CORE_DP_SIGNATURE_ALG) {
    throw new CoreDpError('signature_invalid', `Unsupported signature algorithm '${signature.alg}'`);
  }
  if (signature.key_id !== sender.key_id) {
    throw new CoreDpError('signature_invalid', 'signature.key_id must match sender.key_id');
  }

  const entry = trustStore.keys.find(
    (key) => key.node_id === sender.node_id && key.key_id === sender.key_id,
  );
  if (!entry) {
    throw new CoreDpError(
      'signature_invalid',
      `No trusted key found for sender '${sender.node_id}' key_id '${sender.key_id}'`,
    );
  }

  if (entry.lifecycle_status === 'revoked') {
    throw new CoreDpError(
      'signature_invalid',
      `Key '${entry.key_id}' for sender '${sender.node_id}' is revoked`,
    );
  }

  const createdAt = parseStrictDateTime(envelope.created_at, 'created_at', 'signature_invalid');
  const validFrom = parseStrictDateTime(entry.valid_from, 'valid_from', 'signature_invalid');
  const validUntil = parseStrictDateTime(entry.valid_until, 'valid_until', 'signature_invalid');
  if (createdAt.getTime() < validFrom.getTime() || createdAt.getTime() >= validUntil.getTime()) {
    throw new CoreDpError(
      'signature_invalid',
      `Key '${entry.key_id}' for sender '${sender.node_id}' was not valid at envelope created_at '${envelope.created_at}' (valid_from '${entry.valid_from}', valid_until '${entry.valid_until}')`,
    );
  }

  const { signature: _signature, ...envelopeWithoutSignature } = envelope;
  const recomputedSigningInput = canonicalSigningInput(envelopeWithoutSignature);
  const recomputedSha256 = sha256Hex(recomputedSigningInput);
  if (recomputedSha256 !== signature.signing_input_sha256) {
    throw new CoreDpError(
      'signature_invalid',
      'signing_input_sha256 does not match an independently recomputed hash of the envelope fields',
    );
  }

  let publicKey: KeyLike;
  try {
    publicKey = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: entry.public_key_jwk.x },
      format: 'jwk',
    });
  } catch (error) {
    throw new CoreDpError(
      'signature_invalid',
      `Trusted public key for '${entry.key_id}' could not be imported: ${(error as Error).message}`,
    );
  }

  const signatureBytes = Buffer.from(signature.value, 'base64url');
  const verified = cryptoVerify(null, Buffer.from(recomputedSigningInput, 'utf8'), publicKey, signatureBytes);
  if (!verified) {
    throw new CoreDpError('signature_invalid', 'Detached Ed25519 signature verification failed');
  }

  return entry;
}

/**
 * Validates the replay window on an envelope (already-signed or not — this only
 * looks at created_at/expires_at/replay_window_seconds). Per
 * profiles/core-dp/README.md's "Signed Envelope" section, the semantic check is
 * the inequality `created_at < expires_at <= created_at + replay_window_seconds`
 * — the declared replay_window_seconds is an upper bound on the actual window,
 * not a value the actual window must match exactly. Throws
 * CoreDpError('stale_message', ...) if the declared replay_window_seconds falls
 * outside the schema's [60, 900] second bounds, if expires_at is not strictly
 * after created_at, if the actual window exceeds the declared
 * replay_window_seconds, or if `now` is before created_at or at/after
 * expires_at (evaluation_time >= expires_at is expired, per the conformance
 * vectors — the upper boundary is exclusive).
 */
export function validateReplayWindow(envelope: EnvelopeWithoutSignature, now: Date = new Date()): void {
  const createdAt = parseStrictDateTime(envelope.created_at, 'created_at', 'stale_message');
  const expiresAt = parseStrictDateTime(envelope.expires_at, 'expires_at', 'stale_message');

  const declaredWindowSeconds = envelope.replay_window_seconds;
  const actualWindowSeconds = (expiresAt.getTime() - createdAt.getTime()) / 1000;

  if (declaredWindowSeconds < MIN_REPLAY_WINDOW_SECONDS || declaredWindowSeconds > MAX_REPLAY_WINDOW_SECONDS) {
    throw new CoreDpError(
      'stale_message',
      `replay_window_seconds (${declaredWindowSeconds}) is outside the allowed [${MIN_REPLAY_WINDOW_SECONDS}, ${MAX_REPLAY_WINDOW_SECONDS}] second bounds`,
    );
  }
  if (actualWindowSeconds <= 0) {
    throw new CoreDpError(
      'stale_message',
      `expires_at ('${envelope.expires_at}') must be after created_at ('${envelope.created_at}')`,
    );
  }
  if (actualWindowSeconds > declaredWindowSeconds) {
    throw new CoreDpError(
      'stale_message',
      `expires_at must be within replay_window_seconds: expires_at - created_at (${actualWindowSeconds}s) exceeds the declared replay_window_seconds (${declaredWindowSeconds}s)`,
    );
  }

  if (now.getTime() < createdAt.getTime()) {
    throw new CoreDpError('stale_message', `Message created_at ('${envelope.created_at}') is in the future relative to now`);
  }
  if (now.getTime() >= expiresAt.getTime()) {
    throw new CoreDpError('stale_message', `Message has expired: now is at or after expires_at ('${envelope.expires_at}')`);
  }
}
