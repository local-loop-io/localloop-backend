import type { FastifyInstance } from 'fastify';
import materialSchema from './material-dna.schema.json';
import offerSchema from './offer.schema.json';
import matchSchema from './match.schema.json';
import transferSchema from './transfer.schema.json';
import materialStatusSchema from './material-status.schema.json';

export const loopSchemaIds = {
  material: materialSchema.$id as string,
  offer: offerSchema.$id as string,
  match: matchSchema.$id as string,
  transfer: transferSchema.$id as string,
  materialStatus: materialStatusSchema.$id as string,
};

export function registerLoopSchemas(app: FastifyInstance) {
  app.addSchema(materialSchema);
  app.addSchema(offerSchema);
  app.addSchema(matchSchema);
  app.addSchema(transferSchema);
  app.addSchema(materialStatusSchema);
}
