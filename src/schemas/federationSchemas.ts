import type { FastifyInstance } from 'fastify';
import handshakeSchema from './handshake.schema.json';

export const federationSchemaIds = {
  handshake: handshakeSchema.$id as string,
};

export function registerFederationSchemas(app: FastifyInstance) {
  if (!app.getSchema(federationSchemaIds.handshake)) {
    app.addSchema(handshakeSchema);
  }
}
