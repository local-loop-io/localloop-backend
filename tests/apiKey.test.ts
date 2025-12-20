import { afterEach, describe, expect, it } from 'bun:test';
import { requireApiKey } from '../src/security/apiKey';
import { config } from '../src/config';

const makeReply = () => {
  return {
    statusCode: 200,
    payload: null as unknown,
    code(status: number) {
      this.statusCode = status;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
};

describe('api key guard', () => {
  const original = {
    enabled: config.auth.apiKeyEnabled,
    key: config.auth.apiKey,
  };

  afterEach(() => {
    config.auth.apiKeyEnabled = original.enabled;
    config.auth.apiKey = original.key;
  });

  it('allows requests when disabled', () => {
    config.auth.apiKeyEnabled = false;
    config.auth.apiKey = 'secret';

    const reply = makeReply();
    const request = { headers: {} } as any;
    expect(requireApiKey(request, reply as any)).toBe(true);
  });

  it('rejects requests without a key when enabled', () => {
    config.auth.apiKeyEnabled = true;
    config.auth.apiKey = 'secret';

    const reply = makeReply();
    const request = { headers: {} } as any;
    expect(requireApiKey(request, reply as any)).toBe(false);
    expect(reply.statusCode).toBe(401);
  });

  it('accepts requests with a valid x-api-key', () => {
    config.auth.apiKeyEnabled = true;
    config.auth.apiKey = 'secret';

    const reply = makeReply();
    const request = { headers: { 'x-api-key': 'secret' } } as any;
    expect(requireApiKey(request, reply as any)).toBe(true);
  });

  it('accepts requests with a valid bearer token', () => {
    config.auth.apiKeyEnabled = true;
    config.auth.apiKey = 'secret';

    const reply = makeReply();
    const request = { headers: { authorization: 'Bearer secret' } } as any;
    expect(requireApiKey(request, reply as any)).toBe(true);
  });
});
