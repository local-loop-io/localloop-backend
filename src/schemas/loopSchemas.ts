import type { FastifyInstance } from 'fastify';
import materialSchema from './material-dna.schema.json';
import productSchema from './product-dna.schema.json';
import offerSchema from './offer.schema.json';
import matchSchema from './match.schema.json';
import transferSchema from './transfer.schema.json';
import materialStatusSchema from './material-status.schema.json';
import transactionSchema from './transaction.schema.json';
import loopSignalSchema from './loopsignal.schema.json';

/**
 * Fastify's AJV runs in strict mode without `useDefaults`, so canonical
 * schemas that declare `default` values (transaction.schema.json's
 * `status: default "pending"`) fail to compile at registration time. The
 * default is documentation-only here — handlers assign initial statuses
 * themselves — so strip `default` keywords from the registered copy. The
 * on-disk synced file stays byte-identical to loop-protocol (sync check
 * compares files, not the registered compiler input), and full canonical
 * validation remains loop-protocol's `npm run validate:schemas`.
 */
function stripDefaults<T>(node: T): T {
  if (Array.isArray(node)) {
    return node.map((item) => stripDefaults(item)) as T;
  }
  if (node && typeof node === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'default') continue;
      result[key] = stripDefaults(value);
    }
    return result as T;
  }
  return node;
}

const transactionSchemaForFastify = stripDefaults(transactionSchema) as typeof transactionSchema;

export const loopSchemaIds = {
  material: materialSchema.$id as string,
  product: productSchema.$id as string,
  offer: offerSchema.$id as string,
  match: matchSchema.$id as string,
  transfer: transferSchema.$id as string,
  materialStatus: materialStatusSchema.$id as string,
  transaction: transactionSchema.$id as string,
  loopSignal: loopSignalSchema.$id as string,
};

export function registerLoopSchemas(app: FastifyInstance) {
  app.addSchema(materialSchema);
  app.addSchema(productSchema);
  app.addSchema(offerSchema);
  app.addSchema(matchSchema);
  app.addSchema(transferSchema);
  app.addSchema(materialStatusSchema);
  app.addSchema(transactionSchemaForFastify);
  app.addSchema(loopSignalSchema);
}
