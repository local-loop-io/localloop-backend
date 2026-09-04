import type { FastifyInstance } from 'fastify';
import federateAcceptedSchema from './federate-accepted.schema.json';
import handshakeRaw from './handshake.schema.json';

const BASE = 'https://localloop.urbnia.com/projects/loop-protocol/schemas/v0.2.0';

type SchemaDef = Record<string, unknown>;
const defs = (handshakeRaw as any).definitions as Record<string, SchemaDef>;

const handshakeRequestSchema: SchemaDef = {
  $id: `${BASE}/handshake-request.schema.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'HandshakeRequest',
  ...defs.HandshakeRequest,
};

const handshakeResponseSchema: SchemaDef = {
  $id: `${BASE}/handshake-response.schema.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'HandshakeResponse',
  ...defs.HandshakeResponse,
};

export const federationSchemaIds = {
  handshake: handshakeRaw.$id as string,
  handshakeRequest: handshakeRequestSchema.$id as string,
  handshakeResponse: handshakeResponseSchema.$id as string,
  federateAccepted: federateAcceptedSchema.$id as string,
};

export function registerFederationSchemas(app: FastifyInstance) {
  if (!app.getSchema(federationSchemaIds.handshake)) {
    app.addSchema(handshakeRaw);
  }
  if (!app.getSchema(federationSchemaIds.handshakeRequest)) {
    app.addSchema(handshakeRequestSchema);
  }
  if (!app.getSchema(federationSchemaIds.handshakeResponse)) {
    app.addSchema(handshakeResponseSchema);
  }
  if (!app.getSchema(federationSchemaIds.federateAccepted)) {
    app.addSchema(federateAcceptedSchema);
  }
}
