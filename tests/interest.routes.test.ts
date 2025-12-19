import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerInterestRoutes } from '../src/routes/interest';

const buildApp = () => {
  const app = Fastify({ logger: false });
  const data = [{
    id: 1,
    name: 'Alex',
    organization: 'Loop City',
    role: null,
    country: 'DE',
    city: 'Berlin',
    website: null,
    email: null,
    message: null,
    is_demo: true,
    created_at: new Date().toISOString(),
  }];

  const deps = {
    insertInterest: async () => ({ id: 2, created_at: new Date().toISOString() }),
    listInterests: async () => data,
    countInterests: async () => data.length,
    enqueueInterest: async () => undefined,
    broadcastInterest: () => undefined,
  };

  return { app, deps };
};

describe('interest routes', () => {
  it('lists public interests', async () => {
    const { app, deps } = buildApp();
    await registerInterestRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/interest' });
    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.total).toBe(1);
    expect(payload.results[0].name).toBe('Alex');
  });

  it('rejects invalid interest submission', async () => {
    const { app, deps } = buildApp();
    await registerInterestRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/interest',
      payload: { name: 'Jane Doe' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepts valid interest submission', async () => {
    const { app, deps } = buildApp();
    await registerInterestRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/api/interest',
      payload: { name: 'Jane Doe', consentPublic: true },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload.id).toBe(2);
  });
});
