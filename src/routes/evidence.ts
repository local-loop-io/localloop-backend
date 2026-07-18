import type { FastifyInstance } from 'fastify';
import {
  getLoopEvidenceByEventId,
  listLoopEvidence,
  type EvidenceEventType,
  type EvidenceSubjectType,
} from '../db/evidence';
import { CoreDpError, sendCoreDpError, toCoreDpError } from '../errors';
import { requireApiKey } from '../security/apiKey';

const EVIDENCE_SUBJECT_TYPES: readonly EvidenceSubjectType[] = [
  'material', 'product', 'offer', 'match', 'transfer', 'envelope',
];

const EVIDENCE_EVENT_TYPES: readonly EvidenceEventType[] = [
  'registered', 'read', 'searched',
  'offer-published', 'offer-acked', 'offer-rejected',
  'match-proposed', 'match-accepted', 'match-rejected',
  'transfer-dispatched', 'transfer-received', 'transfer-acked',
  'error-recorded', 'key-rotated',
];

const evidenceResponseSchema = { type: 'object', additionalProperties: true };
const evidenceListResponseSchema = { type: 'object', additionalProperties: true };

function isSubjectType(value: unknown): value is EvidenceSubjectType {
  return typeof value === 'string' && (EVIDENCE_SUBJECT_TYPES as readonly string[]).includes(value);
}

function isEventType(value: unknown): value is EvidenceEventType {
  return typeof value === 'string' && (EVIDENCE_EVENT_TYPES as readonly string[]).includes(value);
}

type EvidenceListQuery = {
  subject_type?: EvidenceSubjectType;
  subject_id?: string;
  event_type_in?: EvidenceEventType[];
  since?: string;
  limit?: number;
  cursor?: string;
};

async function runList(query: EvidenceListQuery) {
  if (query.subject_type !== undefined && !isSubjectType(query.subject_type)) {
    throw new CoreDpError('invalid_request', `Unknown subject_type '${query.subject_type}'`);
  }
  if (query.event_type_in) {
    for (const eventType of query.event_type_in) {
      if (!isEventType(eventType)) {
        throw new CoreDpError('invalid_request', `Unknown event_type '${eventType}'`);
      }
    }
  }

  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

  return listLoopEvidence({
    subjectType: query.subject_type,
    subjectId: query.subject_id,
    eventTypeIn: query.event_type_in,
    since: query.since,
    limit,
    cursor: query.cursor,
  });
}

export async function registerEvidenceRoutes(app: FastifyInstance) {
  app.get('/api/v1/evidence/:event_id', {
    schema: { response: { 200: evidenceResponseSchema } },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const { event_id } = request.params as { event_id: string };
    const entry = await getLoopEvidenceByEventId(event_id);
    if (!entry) {
      sendCoreDpError(reply, new CoreDpError('not_found', `No evidence entry with event_id '${event_id}'`));
      return;
    }
    reply.send(entry);
  });

  app.get('/api/v1/evidence', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          subject_type: { type: 'string' },
          subject_id: { type: 'string' },
          event_type_in: { type: 'string', description: 'Comma-separated list of event_type values' },
          since: { type: 'string' },
          limit: { type: 'number' },
          cursor: { type: 'string' },
        },
      },
      response: { 200: evidenceListResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const q = request.query as {
      subject_type?: string;
      subject_id?: string;
      event_type_in?: string;
      since?: string;
      limit?: number;
      cursor?: string;
    };

    try {
      const result = await runList({
        subject_type: q.subject_type as EvidenceSubjectType | undefined,
        subject_id: q.subject_id,
        event_type_in: q.event_type_in ? (q.event_type_in.split(',').map((v) => v.trim()) as EvidenceEventType[]) : undefined,
        since: q.since,
        limit: q.limit,
        cursor: q.cursor,
      });
      reply.send(result);
    } catch (error) {
      sendCoreDpError(reply, toCoreDpError(error));
    }
  });

  app.post('/api/v1/evidence/search', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          subject_type: { type: 'string' },
          subject_id: { type: 'string' },
          event_type_in: { type: 'array', items: { type: 'string' } },
          since: { type: 'string' },
          limit: { type: 'number' },
          cursor: { type: 'string' },
        },
      },
      response: { 200: evidenceListResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const body = request.body as EvidenceListQuery;

    try {
      const result = await runList(body);
      reply.send(result);
    } catch (error) {
      sendCoreDpError(reply, toCoreDpError(error));
    }
  });
}
