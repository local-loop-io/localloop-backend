import { afterEach, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { config } from '../src/config';
import { registerInterestRoutes } from '../src/routes/interest';

const buildApp = () => {
  const app = Fastify({ logger: false });
  const deps = {
    insertInterest: async () => ({ id: 2, created_at: new Date().toISOString() }),
    listInterests: async () => [],
    countInterests: async () => 0,
    enqueueInterest: async () => undefined,
    broadcastInterest: () => undefined,
  };

  return { app, deps };
};

describe('interest auth guard', () => {
  const original = {
    enabled: config.auth.apiKeyEnabled,
    key: config.auth.apiKey,
  };

  afterEach(() => {
    config.auth.apiKeyEnabled = original.enabled;
    config.auth.apiKey = original.key;
  });

  it('rejects writes without API key when enabled', async () => {
    config.auth.apiKeyEnabled = true;
    config.auth.apiKey = 'secret';

    const { app, deps } = buildApp();
    await registerInterestRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/interest',
      payload: { name: 'Jane Doe', consentPublic: true },
    });

    expect(response.statusCode).toBe(401);
  });

  it('accepts writes with API key when enabled', async () => {
    config.auth.apiKeyEnabled = true;
    config.auth.apiKey = 'secret';

    const { app, deps } = buildApp();
    await registerInterestRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/interest',
      headers: { 'x-api-key': 'secret' },
      payload: { name: 'Jane Doe', consentPublic: true },
    });

    expect(response.statusCode).toBe(201);
  });
});
