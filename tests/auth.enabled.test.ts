import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { Pool } from 'pg';

// IMPORTANT: this file must be the ONLY place that touches `../src/auth` /
// `../src/config` with AUTH_ENABLED=true. Bun's --isolate gives each test FILE a
// fresh module registry, but a *bare* (non-cache-busted) sibling import inside a
// dynamically-imported module — e.g. `auth.ts`'s own `import { config } from
// './config'` — is still cached process-wide for the rest of THIS file once first
// touched. Confirmed empirically: a second differently-enved dynamic import of a
// module with a bare sibling import silently sees the FIRST import's cached
// sibling, not its own env. So: set env once, import once, reuse the one fresh
// `handleAuth`/`registerAuthStatusRoutes` for every case below — do not add a
// second differently-enved scenario to this file.
process.env.AUTH_ENABLED = 'true';
process.env.BETTER_AUTH_SECRET = 'test-only-fixture-secret-do-not-use-in-prod-32c';

let app: FastifyInstance;
let cleanupPool: Pool | undefined;
const createdUserIds: string[] = [];
const email = `auth-enabled-test-${Date.now()}@example.com`;
const password = 'CorrectHorseBatteryStaple1!';

// Probed at module load so the cases below can be declared with
// it.skipIf(!dbReady) and show as skipped (not passed) without a database.
// Confirms the better-auth core schema (migration 017) is actually applied —
// AUTH_ENABLED was once wired in code with no schema ever provisioned, so
// sign-up would have failed on a missing relation.
const dbReady = await (async () => {
  const probe = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1 FROM "user" LIMIT 1');
    return true;
  } catch (error) {
    console.warn('[auth.enabled] Postgres/better-auth schema unavailable — tests are skipped:', (error as Error).message);
    return false;
  } finally {
    await probe.end();
  }
})();

beforeAll(async () => {
  if (!dbReady) {
    return;
  }
  cleanupPool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { handleAuth } = await import(`../src/auth.ts?case=${Math.random()}`);
  const { registerAuthStatusRoutes } = await import(`../src/routes/auth.ts?case=${Math.random()}`);

  app = Fastify({ logger: false });
  await registerAuthStatusRoutes(app);
  app.all('/api/auth/*', async (request, reply) => {
    await handleAuth(request, reply);
  });
  await app.ready();
});

afterAll(async () => {
  if (cleanupPool) {
    if (createdUserIds.length > 0) {
      await cleanupPool.query('DELETE FROM "user" WHERE id = ANY($1)', [createdUserIds]);
    }
    await cleanupPool.end();
  }
  if (app) {
    await app.close();
  }
});

describe('AUTH_ENABLED end-to-end (better-auth wired and live)', () => {
  it.skipIf(!dbReady)('/api/auth/status reports auth as enabled and active when AUTH_ENABLED=true', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.enabled).toBe(true);
    expect(body.active).toBe(true);
    expect(body.provider).toBe('better-auth');
    expect(body.methods).toContain('email+password');
  });

  it.skipIf(!dbReady)('signs up a new user and returns a session token + cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, name: 'Auth Test User' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.email).toBe(email);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(response.headers['set-cookie']).toBeDefined();

    createdUserIds.push(body.user.id);
  });

  it.skipIf(!dbReady)('rejects sign-up with a duplicate email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email, password, name: 'Auth Test User Again' },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it.skipIf(!dbReady)('signs in with correct credentials and issues a real session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'content-type': 'application/json' },
      payload: { email, password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.email).toBe(email);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(';')[0]).join('; ')
      : String(setCookie).split(';')[0];

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: cookieHeader },
    });
    expect(sessionResponse.statusCode).toBe(200);
    const sessionBody = sessionResponse.json();
    expect(sessionBody.user.email).toBe(email);
    expect(sessionBody.session.userId).toBe(body.user.id);
  });

  it.skipIf(!dbReady)('rejects sign-in with an incorrect password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: 'definitely-the-wrong-password' },
    });
    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!dbReady)('returns no session for get-session without a cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/get-session' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('null');
  });
});
