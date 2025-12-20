import { describe, expect, it } from 'bun:test';
import { EventEmitter } from 'events';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { broadcastLoopEvent, registerLoopStream } from '../src/realtime/loopStream';

class MockRaw extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  chunks: string[] = [];

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  write(chunk: string | Buffer) {
    this.chunks.push(chunk.toString());
    return true;
  }
}

const buildMocks = () => {
  const raw = new MockRaw();
  const reply = { raw } as unknown as FastifyReply;
  const request = { raw: new EventEmitter() } as unknown as FastifyRequest;
  return { raw, reply, request };
};

describe('loop event stream', () => {
  it('registers SSE stream and broadcasts events', () => {
    const { raw, reply, request } = buildMocks();

    registerLoopStream(request, reply);

    expect(raw.statusCode).toBe(200);
    expect(raw.headers['Content-Type']).toBe('text/event-stream');
    expect(raw.headers['Cache-Control']).toBe('no-cache');

    const before = raw.chunks.length;
    broadcastLoopEvent({ type: 'material.created' });
    expect(raw.chunks.length).toBe(before + 1);
    expect(raw.chunks[raw.chunks.length - 1]).toContain('data:');

    request.raw.emit('close');
    const afterClose = raw.chunks.length;
    broadcastLoopEvent({ type: 'offer.created' });
    expect(raw.chunks.length).toBe(afterClose);
  });
});
