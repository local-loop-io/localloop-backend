import { setNoStore } from '../httpCache';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import {
  createLoopTransaction,
  getLoopTransactionById,
  transactionIdentity,
  type LoopTransactionPayload,
} from '../db/loop';
import { broadcastLoopEvent } from '../realtime/loopStream';
import { incrementMetric } from '../metrics';
import { loopSchemaIds } from '../schemas/loopSchemas';
import { requireApiKey } from '../security/apiKey';
import { loopContentType } from '../protocol';
import { sendSpecError, specErrorResponseSchema } from '../specErrors';
import { CoreDpError, sendCoreDpError } from '../errors';
import { withIdempotency } from '../idempotency';
import { LOOP_V0_2_CONTEXT } from './signals';

const transactionStatusResponseSchema = {
  type: 'object',
  required: ['@context', '@type', 'transaction_id', 'status', 'updated_at'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'TransactionStatus' },
    schema_version: { type: 'string' },
    transaction_id: { type: 'string' },
    status: { type: 'string' },
    updated_at: { type: 'string' },
    settlement_url: { type: 'string' },
  },
};

const apiKeySecurity = [{ ApiKeyAuth: [] }];

// The write-route 409 can carry either the §8.3 envelope (duplicate
// transaction id via the database) or the Core-DP error body (Idempotency-Key
// conflict via withIdempotency), so that status cannot use a strict
// single-envelope response schema — same pattern as the loop write routes.
const mixedWriteErrorResponseSchema = { type: 'object', additionalProperties: true };

const writeRateLimit = {
  max: config.rateLimitWriteMax,
  timeWindow: config.rateLimitWriteWindow,
};

type TransactionDeps = {
  createLoopTransaction: typeof createLoopTransaction;
  getLoopTransactionById: typeof getLoopTransactionById;
  broadcastLoopEvent: typeof broadcastLoopEvent;
};

const defaultDeps: TransactionDeps = {
  createLoopTransaction,
  getLoopTransactionById,
  broadcastLoopEvent,
};

type DbLikeError = Error & { code?: string };

function transactionStatusBody(transactionId: string, status: string, updatedAt: string) {
  return {
    '@context': LOOP_V0_2_CONTEXT,
    '@type': 'TransactionStatus',
    schema_version: '0.2.0',
    transaction_id: transactionId,
    status,
    updated_at: updatedAt,
    settlement_url: `/api/v1/transaction/${transactionId}`,
  };
}

export async function registerTransactionRoutes(app: FastifyInstance, deps: TransactionDeps = defaultDeps) {
  app.addHook('onRequest', async (_req, reply) => { setNoStore(reply); });

  // SPEC §8.1: create a transaction. The request body is validated against the
  // canonical transaction schema (MaterialTransaction | Settlement |
  // TransactionStatus); the response is a TransactionStatus JSON-LD object.
  app.post('/api/v1/transaction', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.transaction}#` },
      response: {
        201: transactionStatusResponseSchema,
        400: specErrorResponseSchema,
        409: mixedWriteErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopTransactionPayload;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    let outcome: { status: 201; body: Record<string, unknown> };
    try {
      outcome = await withIdempotency('transaction.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopTransaction(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_transaction_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ transactionId: created.id }, 'Loop transaction created');
        return {
          status: 201,
          body: transactionStatusBody(created.id, transactionIdentity(payload).status, created.created_at),
        };
      }) as { status: 201; body: Record<string, unknown> };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      const pgError = error as DbLikeError;
      if (pgError?.code === '23505') {
        sendSpecError(reply, 'CONFLICT', 'Transaction with this id already exists');
        return;
      }
      throw error;
    }

    reply.type(loopContentType).code(outcome.status).send(outcome.body);
  });

  // Companion read so the TransactionStatus `settlement_url` returned above is
  // resolvable (additive to the spec's required surface).
  app.get('/api/v1/transaction/:id', {
    schema: {
      response: {
        200: transactionStatusResponseSchema,
        404: specErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await deps.getLoopTransactionById(id);
    if (!row) {
      sendSpecError(reply, 'NOT_FOUND', `Transaction with ID ${id} not found`, { searched_id: id });
      return;
    }
    reply.type(loopContentType).send(transactionStatusBody(row.id, row.status, row.updated_at));
  });
}
