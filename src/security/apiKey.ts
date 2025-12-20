import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

const extractApiKey = (request: FastifyRequest) => {
  const direct = request.headers['x-api-key'];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
};

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  if (!config.auth.apiKeyEnabled) return true;

  if (!config.auth.apiKey) {
    reply.code(503).send({ error: 'API key protection is enabled but no API_KEY is configured' });
    return false;
  }

  const provided = extractApiKey(request);
  if (!provided || !safeCompare(provided, config.auth.apiKey)) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
