import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            time: { type: 'string' },
            uptime: { type: 'number' },
            db: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            time: { type: 'string' },
            uptime: { type: 'number' },
            db: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    let dbStatus = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    const payload = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      uptime: process.uptime(),
      db: dbStatus,
    };

    if (dbStatus !== 'ok') {
      reply.code(503);
    }
    return payload;
  });
}
