import { betterAuth } from 'better-auth';
import pg from 'pg';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config';

const { Pool } = pg;

const authEnabled = config.auth.enabled && Boolean(config.auth.secret);
if (config.auth.enabled && !config.auth.secret) {
  console.warn('Auth enabled but BETTER_AUTH_SECRET is missing. Auth will be disabled.');
}

const authPool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

export const auth = authEnabled
  ? betterAuth({
      database: authPool,
      emailAndPassword: { enabled: true },
      trustedOrigins: config.auth.trustedOrigins,
      secret: config.auth.secret,
    })
  : null;

export async function handleAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!auth) {
    reply.code(503).send({ error: 'Auth is disabled' });
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
