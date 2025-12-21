import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

const clients = new Set<FastifyReply>();
const heartbeatTimers = new Map<FastifyReply, ReturnType<typeof setInterval>>();

export function registerInterestStream(request: FastifyRequest, reply: FastifyReply) {
  if (clients.size >= config.sseMaxClients) {
    reply.code(429).send({ error: 'Too many active stream connections' });
    return;
  }

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

  if (config.sseKeepAliveMs > 0) {
    const timer = setInterval(() => {
      try {
        reply.raw.write(': keep-alive\n\n');
      } catch {
        // Ignore write errors; cleanup happens on close.
      }
    }, config.sseKeepAliveMs);
    heartbeatTimers.set(reply, timer);
  }

  request.raw.on('close', () => {
    clients.delete(reply);
    const timer = heartbeatTimers.get(reply);
    if (timer) {
      clearInterval(timer);
      heartbeatTimers.delete(reply);
    }
  });
}

export function broadcastInterest(payload: unknown) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const reply of clients) {
    reply.raw.write(message);
  }
}
