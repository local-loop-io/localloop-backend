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
import { handleAuth } from './auth';
import { startWorkers } from './queue';
import { pool } from './db/pool';

async function buildServer() {
  const app = Fastify({
    logger: true,
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
        description: 'Public API for LocalLoop interest capture and city portal data.',
        version: '0.2.0',
      },
      servers: [{ url: config.publicBaseUrl }],
    },
  });

  await registerHealthRoutes(app);
  await registerInterestRoutes(app);
  await registerCityRoutes(app);
  await registerPaymentRoutes(app);
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

async function start() {
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

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
