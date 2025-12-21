import { describe, expect, it } from 'bun:test';

const makeReply = () => {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let payload: unknown;
  return {
    raw: {
      writeHead: (status: number, nextHeaders: Record<string, string>) => {
        statusCode = status;
        Object.assign(headers, nextHeaders);
      },
      write: () => undefined,
    },
    code: (status: number) => {
      statusCode = status;
      return { send: (body: unknown) => { payload = body; } };
    },
    getHeaders: () => headers,
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
};

describe('loop stream', () => {
  it('adds CORS headers for allowed origins', async () => {
    process.env.ALLOWED_ORIGINS = 'https://local-loop-io.github.io';
    const { config } = await import('../src/config');
    const { registerLoopStream } = await import('../src/realtime/loopStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseKeepAliveMs = 0;

    const reply = makeReply();
    const request = {
      headers: { origin: 'https://local-loop-io.github.io' },
      raw: { on: () => undefined },
    } as any;

    registerLoopStream(request, reply as any);

    const headers = reply.getHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('https://local-loop-io.github.io');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers.Vary).toBe('Origin');
    config.sseKeepAliveMs = previousKeepAlive;
  });

  it('rejects new connections when max clients reached', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream } = await import('../src/realtime/loopStream');
    const previousMax = config.sseMaxClients;
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseMaxClients = 0;
    config.sseKeepAliveMs = 0;

    const reply = makeReply();
    const request = {
      headers: {},
      raw: { on: () => undefined },
    } as any;

    registerLoopStream(request, reply as any);

    expect(reply.getStatus()).toBe(429);
    expect(reply.getPayload()).toEqual({ error: 'Too many active stream connections' });
    config.sseMaxClients = previousMax;
    config.sseKeepAliveMs = previousKeepAlive;
  });
});
