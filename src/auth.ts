import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config';
import { sendSpecErrorForStatus } from './specErrors';

const authEnabled = config.auth.enabled && Boolean(config.auth.secret);
if (config.auth.enabled && !config.auth.secret) {
  console.warn('Auth enabled but BETTER_AUTH_SECRET is missing. Auth will be disabled.');
}

// better-auth needs its own pg Pool. Only create it when auth is actually on:
// with AUTH_ENABLED=false (the default) a module-level pool would still open up
// to 5 idle Postgres connections that nothing uses and nothing closes.
const authPool = authEnabled
  ? new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
    })
  : null;

/** Close the auth pool during shutdown; a no-op when auth is disabled. */
export async function closeAuthPool() {
  await authPool?.end();
}

export const auth = authEnabled && authPool
  ? betterAuth({
      database: authPool,
      baseURL: config.publicBaseUrl,
      emailAndPassword: { enabled: true },
      trustedOrigins: config.auth.trustedOrigins,
      secret: config.auth.secret,
    })
  : null;

export async function handleAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!auth) {
    sendSpecErrorForStatus(reply, 503, 'Auth is disabled');
    return;
  }

  const url = new URL(request.url, config.publicBaseUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : JSON.stringify(request.body ?? {});

  const authRequest = new Request(url.toString(), {
    method: request.method,
    headers,
    body,
  });

  const response = await auth.handler(authRequest);
  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });
  reply.code(response.status).send(await response.text());
}
