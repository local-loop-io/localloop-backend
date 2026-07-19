import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { getLoopSignalConfig } from '../db/loop';
import { sendSpecError, specErrorResponseSchema } from '../specErrors';
import { loopContentType } from '../protocol';

export const LOOP_V0_2_CONTEXT = 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld';

type SignalsDeps = {
  getLoopSignalConfig: typeof getLoopSignalConfig;
};

const defaultDeps: SignalsDeps = {
  getLoopSignalConfig,
};

const signalConfigResponseSchema = {
  type: 'object',
  required: ['@context', '@type', 'node', 'signals', 'valid_from', 'valid_until'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'LoopSignalConfig' },
    schema_version: { type: 'string' },
    node: { type: 'string' },
    signals: { type: 'object', additionalProperties: { type: 'number' } },
    valid_from: { type: 'string' },
    valid_until: { type: 'string' },
  },
};

export async function registerSignalsRoutes(app: FastifyInstance, deps: SignalsDeps = defaultDeps) {
  // SPEC §8.1: nodes MUST publish their LoopSignal configuration publicly.
  app.get('/api/v1/signals', {
    schema: {
      response: {
        200: signalConfigResponseSchema,
        404: specErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const row = await deps.getLoopSignalConfig();
    if (!row) {
      sendSpecError(reply, 'NOT_FOUND', 'No LoopSignal configuration is published by this node');
      return;
    }

    reply.type(loopContentType).send({
      '@context': LOOP_V0_2_CONTEXT,
      '@type': 'LoopSignalConfig',
      schema_version: '0.2.0',
      node: config.node.id,
      signals: row.signals,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
    });
  });
}
