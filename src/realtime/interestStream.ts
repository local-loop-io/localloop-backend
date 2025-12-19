import type { FastifyReply, FastifyRequest } from 'fastify';

const clients = new Set<FastifyReply>();

export function registerInterestStream(request: FastifyRequest, reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
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
