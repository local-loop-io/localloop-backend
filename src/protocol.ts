import type { FastifyInstance } from 'fastify';

export const loopContentType = 'application/ld+json';

export function registerLoopProtocolParsers(app: FastifyInstance) {
  app.addContentTypeParser(
    /^application\/ld\+json(?:\s*;.*)?$/i,
    { parseAs: 'string' },
    (request, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(new Error('Invalid JSON body'));
      }
    },
  );
}
