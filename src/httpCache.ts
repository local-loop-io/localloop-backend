import type { FastifyReply } from 'fastify';

/** Lab node-info / signals are stable enough for a short public cache. */
export function setPublicShortCache(reply: FastifyReply, seconds = 30) {
  reply.header('Cache-Control', `public, max-age=${seconds}`);
}

export function setNoStore(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store');
}

/** Set no-store only when Cache-Control is not already set (onSend hooks). */
export function setNoStoreIfUnset(reply: FastifyReply) {
  if (!reply.getHeader('Cache-Control')) {
    setNoStore(reply);
  }
}
