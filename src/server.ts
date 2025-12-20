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
import { registerMetricsRoutes } from './routes/metrics';
import { registerPrivacyRoutes } from './routes/privacy';
import { handleAuth } from './auth';
import { startWorkers } from './queue';
import { pool } from './db/pool';
import { registerLoopSchemas } from './schemas/loopSchemas';

type BuildOptions = {
  logger?: boolean;
};

export async function buildServer(options: BuildOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '15 minutes',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'LocalLoop API',
        description: 'Public API for LocalLoop lab demo, interest capture, and city portal data.',
        version: '0.1.1-demo',
      },
      servers: [{ url: config.publicBaseUrl }],
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerLoopSchemas(app);

  await registerHealthRoutes(app);
  await registerInterestRoutes(app);
  await registerCityRoutes(app);
  await registerPaymentRoutes(app);
  await registerLoopRoutes(app);
  await registerMetricsRoutes(app);
  await registerPrivacyRoutes(app);
  await registerDocsRoutes(app);

  app.all('/api/auth/*', async (request, reply) => {
    await handleAuth(request, reply);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'Not found' });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error' });
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

  const shutdown = async () => {
    await app.close();
    await pool.end();
    if (worker) {
      await worker.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}
