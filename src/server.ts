import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';

import { config } from './config';
import { runMigrations } from './db/migrate';
import { waitForDatabase } from './db/wait';
import { registerHealthRoutes } from './routes/health';
import { registerInterestRoutes } from './routes/interest';
import { registerDocsRoutes } from './routes/docs';
import { registerCityRoutes } from './routes/cities';
import { registerPaymentRoutes } from './routes/payments';
import { registerLoopRoutes } from './routes/loop';
import { registerSignalsRoutes } from './routes/signals';
import { registerTransactionRoutes } from './routes/transactions';
import { registerFederateRoutes } from './routes/federate';
import { registerEvidenceRoutes } from './routes/evidence';
import { registerMetricsRoutes } from './routes/metrics';
import { registerPrivacyRoutes } from './routes/privacy';
import { registerFederationRoutes } from './routes/federation';
import { registerAuthStatusRoutes } from './routes/auth';
import { handleAuth, closeAuthPool } from './auth';
import { startWorkers, closeQueue } from './queue';
import { pool } from './db/pool';
import { registerLoopSchemas } from './schemas/loopSchemas';
import { registerFederationSchemas } from './schemas/federationSchemas';
import { registerLoopProtocolParsers } from './protocol';
import { sendSpecError, sendSpecErrorForStatus } from './specErrors';
import { VERSION, PROTOCOL_VERSION } from './version';
import { setNoStore } from './httpCache';
import { prisma } from './db/prisma';

type BuildOptions = {
  logger?: boolean;
};

export async function buildServer(options: BuildOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    // Exactly one reverse-proxy hop (Traefik in Docker, or the legacy
    // deploy/nginx.conf) sits in front of this process, and its address inside
    // the compose network is not stable, so trust only the immediate peer
    // (hop 0) rather than every X-Forwarded-For value a client cares to send —
    // with `true`, any caller could pick its own request.ip and sidestep the
    // per-IP rate limits. (Fastify >= 5.12.1 dropped the numeric hop-count
    // form, GHSA-3m5p-2c4r-xxw2; the trust function is the supported way.)
    trustProxy: (_address: string, hop: number) => hop === 0,
    bodyLimit: config.bodyLimit,
    connectionTimeout: config.requestTimeoutMs,
  });

  registerLoopProtocolParsers(app);

  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-API-Key', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'localLOOP Lab API',
        description: 'Live lab-only backend surface for interest capture, city data, and controlled interoperability demos. This artifact is not the normative LOOP protocol reference.',
        version: VERSION,
        // OpenAPI vendor extension: the LOOP spec baseline this node implements.
        ...({ 'x-protocol-version': PROTOCOL_VERSION } as Record<string, string>),
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
      servers: [{ url: config.publicBaseUrl }],
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerLoopSchemas(app);
  registerFederationSchemas(app);

  // Error/404 handlers must be installed before the route groups below are
  // registered: `await app.register()` loads each child context immediately,
  // and a child copies the root's handlers at that moment, so anything set on
  // the root afterwards would not apply inside the groups.
  app.setNotFoundHandler((_request, reply) => {
    sendSpecError(reply, 'NOT_FOUND', 'Not found');
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Request failed';
    if (statusCode >= 400 && statusCode < 500) {
      const validation = (error as { validation?: unknown }).validation;
      sendSpecErrorForStatus(
        reply,
        statusCode,
        message,
        validation ? { validation } : undefined,
      );
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    sendSpecError(reply, 'INTERNAL_ERROR', 'Internal server error');
  });

  // Each route group is registered in its own encapsulated plugin context so
  // the hooks a group adds (e.g. the `onRequest` -> Cache-Control: no-store
  // hook in the loop/evidence/payments/... modules) apply to that group only.
  // Registering them on the root instance made every such hook global — seven
  // copies of setNoStore ran on every request, including /openapi.json.
  // Schemas, content-type parsers, and the swagger/rate-limit plugins are
  // registered on the root above and are inherited by these children.
  for (const registerRoutes of [
    registerHealthRoutes,
    registerInterestRoutes,
    registerCityRoutes,
    registerPaymentRoutes,
    registerLoopRoutes,
    registerSignalsRoutes,
    registerTransactionRoutes,
    registerFederateRoutes,
    registerEvidenceRoutes,
    registerFederationRoutes,
    registerAuthStatusRoutes,
    registerMetricsRoutes,
    registerPrivacyRoutes,
    registerDocsRoutes,
  ]) {
    await app.register(async (instance) => {
      await registerRoutes(instance);
    });
  }

  app.all('/api/auth/*', async (request, reply) => {
    setNoStore(reply);
    await handleAuth(request, reply);
  });

  return app;
}

export async function startServer() {
  await waitForDatabase();

  if (config.runMigrations) {
    await runMigrations();
  }

  const app = await buildServer();
  const worker = startWorkers();

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    // A second signal while draining must not re-enter (and `process.on` with an
    // async handler would otherwise also leave any rejection unhandled).
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down');
    const forceExit = setTimeout(() => {
      console.error('Shutdown timed out; exiting');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await app.close();
      if (worker) {
        // Workers use the pool, so they must stop before the database goes away.
        await worker.close();
      }
      await closeQueue();
      await prisma.$disconnect();
      await closeAuthPool();
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed', error);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}
