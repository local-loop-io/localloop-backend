import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

const clients = new Set<FastifyReply>();

export function registerInterestStream(request: FastifyRequest, reply: FastifyReply) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };

  const origin = request.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }

  reply.raw.writeHead(200, headers);
  reply.raw.write('\n');

  clients.add(reply);

  request.raw.on('close', () => {
    clients.delete(reply);
  });
}

export function broadcastInterest(payload: unknown) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const reply of clients) {
    reply.raw.write(message);
  }
}
