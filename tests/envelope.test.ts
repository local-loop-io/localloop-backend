import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'bun:test';
import {
  canonicalSigningInput,
  createEnvelope,
  signEnvelope,
  verifyEnvelopeSignature,
  validateReplayWindow,
  type EnvelopeWithoutSignature,
  type NodeRef,
  type SignedEnvelope,
  type TrustStore,
} from '../src/envelope';
import { CoreDpError } from '../src/errors';

/**
 * Deep-reverses the property insertion order of an object/array, recursively.
 * Used to prove canonicalization actually sorts keys rather than preserving
 * original insertion order (spreading `{ ...value }` preserves order and does
 * NOT exercise this — see the "canonical signing input" test below).
 */
function reverseKeyOrder<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reverseKeyOrder(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>).reverse()) {
      result[key] = reverseKeyOrder(val);
    }
    return result as T;
  }
  return value;
}

const sender: NodeRef = {
  node_id: 'munich.loop',
  endpoint: 'https://munich.loop/api/v1',
  key_id: 'key_munich_2026_07',
};

const receiver: NodeRef = {
  node_id: 'berlin.loop',
  endpoint: 'https://berlin.loop/api/v1',
  key_id: 'key_berlin_2026_07',
};

function buildBody() {
  return {
    conversation_id: 'conv_offerAck00000001',
    message_type: 'offer.ack',
    origin_node: 'berlin.loop',
    counterparty_node: 'munich.loop',
    subject: { type: 'offer', id: 'OFF-DE-MUC-2026-000001' },
    previous_state: 'offer-published',
    state: 'offer-acked',
    terminal: true,
    attempt: 1,
    timeout_at: '2026-07-17T00:05:00Z',
    accepted_profile_version: '0.1.0-lab',
    authoritative_role: 'counterparty',
  };
}

function buildTrustStore(overrides: Partial<TrustStore['keys'][number]>, x: string): TrustStore {
  return {
    version: '1.0.0',
    updated_at: '2026-07-17T00:00:00Z',
    keys: [
      {
        node_id: sender.node_id,
        key_id: sender.key_id,
        public_key_jwk: { kty: 'OKP', crv: 'Ed25519', x },
        lifecycle_status: 'active',
        valid_from: '2026-01-01T00:00:00Z',
        valid_until: '2027-01-01T00:00:00Z',
        ...overrides,
      },
    ],
  };
}

describe('Core-DP signed envelope', () => {
  it('round-trips sign + verify for a trusted active key', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);

    expect(signed.signature.alg).toBe('Ed25519-lab-detached-v1');
    expect(signed.signature.key_id).toBe(sender.key_id);
    expect(signed.signature.signing_input_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.signature.value).toMatch(/^[A-Za-z0-9_-]{86}$/);

    const trustStore = buildTrustStore({}, x);
    const matched = verifyEnvelopeSignature(signed, trustStore);
    expect(matched.key_id).toBe(sender.key_id);

    // validateReplayWindow should not throw for a freshly created, well-formed envelope.
    expect(() => validateReplayWindow(signed, new Date('2026-07-17T00:01:00Z'))).not.toThrow();
  });

  it('produces a canonical signing input that excludes replay_window_seconds and signature', () => {
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
      replay_window_seconds: 300,
    });

    const input = canonicalSigningInput(envelope);
    expect(input).not.toContain('replay_window_seconds');
    expect(input).not.toContain('signature');

    // Deterministic: signing the same logical envelope twice yields the same bytes.
    // NOTE: spreading `{ ...envelope }` (as an earlier version of this test did)
    // preserves original key insertion order and would pass even if
    // canonicalJsonStringify didn't sort keys at all. Reversing every object's key
    // insertion order (recursively, including nested sender/receiver/body objects)
    // is what actually exercises key-order independence.
    const reordered = reverseKeyOrder(envelope);
    expect(Object.keys(reordered as object)).toEqual([...Object.keys(envelope)].reverse());
    expect(canonicalSigningInput(reordered)).toBe(input);
  });

  it('fails verification when the body is tampered with after signing', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    const tampered: SignedEnvelope = {
      ...signed,
      body: { ...signed.body, state: 'offer-rejected' },
    };

    const trustStore = buildTrustStore({}, x);
    expect(() => verifyEnvelopeSignature(tampered, trustStore)).toThrow(CoreDpError);
    try {
      verifyEnvelopeSignature(tampered, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
    }
  });

  it('fails verification for a wrong/untrusted key_id', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    // Trust store only knows about a different, unrelated key.
    const { publicKey: otherPublicKey } = generateKeyPairSync('ed25519');
    const otherX = (otherPublicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);

    const trustStore: TrustStore = {
      version: '1.0.0',
      updated_at: '2026-07-17T00:00:00Z',
      keys: [
        {
          node_id: sender.node_id,
          key_id: 'key_munich_untrusted_999', // does not match sender.key_id / signature.key_id
          public_key_jwk: { kty: 'OKP', crv: 'Ed25519', x: otherX },
          lifecycle_status: 'active',
          valid_from: '2026-01-01T00:00:00Z',
          valid_until: '2027-01-01T00:00:00Z',
        },
      ],
    };

    expect(() => verifyEnvelopeSignature(signed, trustStore)).toThrow(CoreDpError);
    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
    }
  });

  it('fails verification for a revoked key', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    const trustStore = buildTrustStore(
      { lifecycle_status: 'revoked', revoked_at: '2026-07-01T00:00:00Z' },
      x,
    );

    expect(() => verifyEnvelopeSignature(signed, trustStore)).toThrow(CoreDpError);
    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/revoked/);
    }
  });

  it('fails validateReplayWindow for an expired message (now after expires_at)', () => {
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
      replay_window_seconds: 300,
    });

    // expires_at is 2026-07-17T00:05:00Z; ask well after that.
    const farFuture = new Date('2026-07-17T01:00:00Z');
    expect(() => validateReplayWindow(envelope, farFuture)).toThrow(CoreDpError);
    try {
      validateReplayWindow(envelope, farFuture);
      throw new Error('expected validateReplayWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('stale_message');
    }
  });

  it('fails validateReplayWindow when now is before created_at', () => {
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
      replay_window_seconds: 300,
    });

    const past = new Date('2026-07-16T23:59:00Z');
    expect(() => validateReplayWindow(envelope, past)).toThrow(CoreDpError);
  });

  it('fails validateReplayWindow when replay_window_seconds is outside [60, 900]', () => {
    // Bypass createEnvelope's own guard to simulate a malformed/received envelope.
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
      replay_window_seconds: 300,
    });
    const malformed = { ...envelope, replay_window_seconds: 30, expires_at: '2026-07-17T00:00:30Z' };

    expect(() => validateReplayWindow(malformed, new Date('2026-07-17T00:00:10Z'))).toThrow(CoreDpError);
  });

  it('createEnvelope rejects an out-of-range replay_window_seconds', () => {
    expect(() =>
      createEnvelope({
        message_type: 'offer.ack',
        sender,
        receiver,
        body_schema:
          'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
        body: buildBody(),
        replay_window_seconds: 5,
      }),
    ).toThrow(CoreDpError);
  });

  it('fails verification when signature.key_id does not match sender.key_id (guard, not just an untrusted lookup)', () => {
    // Regression test: an earlier version of this suite named a test for this guard
    // but actually built a trust store keyed under a different key_id, which only
    // ever hit the "no trusted key found" branch. This test keeps the trust store
    // correctly keyed under sender.key_id so the `signature.key_id !== sender.key_id`
    // guard itself (src/envelope.ts) is the branch that throws.
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    const tampered: SignedEnvelope = {
      ...signed,
      signature: { ...signed.signature, key_id: 'key_munich_someone_else_01' },
    };

    // Trust store correctly has an entry for sender.key_id (the real key_id) — if the
    // signature.key_id === sender.key_id guard were missing/removed, this would fall
    // through and be evaluated (and rejected later, but for the wrong reason).
    const trustStore = buildTrustStore({}, x);

    try {
      verifyEnvelopeSignature(tampered, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/signature\.key_id must match sender\.key_id/);
    }
  });

  it('fails verification for an unsupported signature.alg', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    const tampered = {
      ...signed,
      signature: { ...signed.signature, alg: 'Ed25519-lab-detached-v2' as SignedEnvelope['signature']['alg'] },
    };

    const trustStore = buildTrustStore({}, x);
    try {
      verifyEnvelopeSignature(tampered, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/Unsupported signature algorithm/);
    }
  });

  it('fails verification for a wrong node_id even when the key_id legitimately exists under a different node', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);

    // Trust store has this exact key_id, but bound to a different node_id than the
    // envelope's sender — impersonation-style lookup must not match.
    const trustStore: TrustStore = {
      version: '1.0.0',
      updated_at: '2026-07-17T00:00:00Z',
      keys: [
        {
          node_id: 'someone-else.loop',
          key_id: sender.key_id,
          public_key_jwk: { kty: 'OKP', crv: 'Ed25519', x },
          lifecycle_status: 'active',
          valid_from: '2026-01-01T00:00:00Z',
          valid_until: '2027-01-01T00:00:00Z',
        },
      ],
    };

    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/No trusted key found/);
    }
  });

  it('fails verification for a non-revoked key outside its [valid_from, valid_until) window', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    // Active status, but the envelope's created_at is before valid_from.
    const trustStore = buildTrustStore(
      { valid_from: '2026-08-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z' },
      x,
    );

    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/was not valid at envelope created_at/);
    }
  });

  it('accepts a "rotated" (not just "active") key that is still inside its validity window', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    const trustStore = buildTrustStore(
      { lifecycle_status: 'rotated', valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z' },
      x,
    );

    expect(() => verifyEnvelopeSignature(signed, trustStore)).not.toThrow();
  });

  it('fails verification when the trusted public key JWK is malformed', () => {
    const { privateKey } = generateKeyPairSync('ed25519');

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    // Not a valid base64url-encoded 32-byte Ed25519 x coordinate.
    const trustStore = buildTrustStore({}, 'not-a-valid-jwk-x-value');

    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/could not be imported/);
    }
  });

  it('fails verification when a created_at/valid_from/valid_until lacks a UTC/offset designator', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;

    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T00:00:00Z',
    });

    const signed = signEnvelope(envelope, privateKey, sender.key_id);
    // A designator-less trust-store timestamp is ambiguous (local time under bare
    // `new Date()`), and must be rejected rather than silently misinterpreted.
    const trustStore = buildTrustStore({ valid_from: '2026-01-01T00:00:00' }, x);

    try {
      verifyEnvelopeSignature(signed, trustStore);
      throw new Error('expected verifyEnvelopeSignature to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('signature_invalid');
      expect((error as CoreDpError).message).toMatch(/UTC\/offset designator/);
    }
  });

  it('createEnvelope rejects a created_at lacking a UTC/offset designator', () => {
    expect(() =>
      createEnvelope({
        message_type: 'offer.ack',
        sender,
        receiver,
        body_schema:
          'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
        body: buildBody(),
        created_at: '2026-07-17T00:00:00',
      }),
    ).toThrow(CoreDpError);
  });

  it('validateReplayWindow rejects a created_at/expires_at lacking a UTC/offset designator', () => {
    const envelope: EnvelopeWithoutSignature = {
      ...createEnvelope({
        message_type: 'offer.ack',
        sender,
        receiver,
        body_schema:
          'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
        body: buildBody(),
        created_at: '2026-07-17T00:00:00Z',
        replay_window_seconds: 300,
      }),
      expires_at: '2026-07-17T00:05:00', // no trailing Z
    };

    expect(() => validateReplayWindow(envelope, new Date('2026-07-17T00:01:00Z'))).toThrow(CoreDpError);
  });

  it('accepts a spec-valid envelope whose actual window is shorter than the declared replay_window_seconds', () => {
    // Regression test for the "equality instead of <=" bug: per
    // profiles/core-dp/README.md, `created_at < expires_at <= created_at +
    // replay_window_seconds` — the sender may pick a tighter expires_at than the
    // declared cap. Mirrors the pinned conformance vector
    // core-dp-envelope-valid-replay-window-001 (created_at 01:00:00Z, expires_at
    // 01:03:00Z => actual 180s, declared replay_window_seconds 300, expected valid).
    const envelope: EnvelopeWithoutSignature = {
      ...createEnvelope({
        message_type: 'offer.ack',
        sender,
        receiver,
        body_schema:
          'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
        body: buildBody(),
        created_at: '2026-07-17T01:00:00Z',
        replay_window_seconds: 300,
      }),
      expires_at: '2026-07-17T01:03:00Z',
    };

    expect(() => validateReplayWindow(envelope, new Date('2026-07-17T01:01:00Z'))).not.toThrow();
  });

  it('rejects an envelope whose actual window exceeds the declared replay_window_seconds', () => {
    // Mirrors the pinned conformance vector core-dp-envelope-invalid-replay-window-001:
    // created_at 01:00:00Z, expires_at 01:03:00Z (actual 180s), declared
    // replay_window_seconds 60 => actual exceeds declared => invalid.
    const envelope: EnvelopeWithoutSignature = {
      ...createEnvelope({
        message_type: 'offer.ack',
        sender,
        receiver,
        body_schema:
          'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
        body: buildBody(),
        created_at: '2026-07-17T01:00:00Z',
        replay_window_seconds: 60,
      }),
      expires_at: '2026-07-17T01:03:00Z',
      replay_window_seconds: 60,
    };

    try {
      validateReplayWindow(envelope, new Date('2026-07-17T01:01:00Z'));
      throw new Error('expected validateReplayWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('stale_message');
      expect((error as CoreDpError).message).toMatch(/expires_at must be within replay_window_seconds/);
    }
  });

  it('rejects at the exact expiry boundary (evaluation_time === expires_at)', () => {
    // Regression test for the off-by-one bug: mirrors the pinned conformance vector
    // core-dp-envelope-invalid-replay-expired-evaluation-time-001 ("Reject envelope
    // when evaluation_time >= expires_at").
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T01:00:00Z',
      replay_window_seconds: 300,
    });

    try {
      validateReplayWindow(envelope, new Date(envelope.expires_at));
      throw new Error('expected validateReplayWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreDpError);
      expect((error as CoreDpError).code).toBe('stale_message');
      expect((error as CoreDpError).message).toMatch(/has expired/);
    }
  });

  it('accepts at the exact creation boundary (evaluation_time === created_at)', () => {
    // Mirrors the pinned conformance vector core-dp-envelope-valid-replay-evaluation-time-001
    // ("Accept envelope when evaluation_time equals created_at").
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
      created_at: '2026-07-17T01:00:00Z',
      replay_window_seconds: 300,
    });

    expect(() => validateReplayWindow(envelope, new Date(envelope.created_at))).not.toThrow();
  });

  it('createEnvelope generates msg_/idem_ prefixed ids matching the schema patterns', () => {
    const envelope = createEnvelope({
      message_type: 'offer.ack',
      sender,
      receiver,
      body_schema:
        'https://localloop.urbnia.com/projects/loop-protocol/profiles/core-dp/0.1.0-lab/schemas/choreography-message.schema.json',
      body: buildBody(),
    });

    expect(envelope.message_id).toMatch(/^msg_[A-Za-z0-9_-]{16,80}$/);
    expect(envelope.idempotency_key).toMatch(/^idem_[A-Za-z0-9_-]{16,120}$/);
  });
});
