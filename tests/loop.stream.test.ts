import { describe, expect, it } from 'bun:test';

type Listener = () => void;

const makeReply = (options: { failWrites?: boolean } = {}) => {
  const headers: Record<string, string> = {};
  const listeners: Record<string, Listener[]> = {};
  let statusCode = 200;
  let payload: unknown;
  let hijacked = false;
  let writes = 0;
  return {
    hijack: () => {
      hijacked = true;
    },
    raw: {
      destroyed: false,
      writable: true,
      writeHead: (status: number, nextHeaders: Record<string, string>) => {
        statusCode = status;
        Object.assign(headers, nextHeaders);
      },
      write: (_chunk: string) => {
        // The first write is the handshake newline sent during registration;
        // simulate a socket that dies afterwards when asked to.
        if (options.failWrites && writes > 0) {
          throw new Error('write after end');
        }
        writes += 1;
        return true;
      },
      on: (event: string, listener: Listener) => {
        listeners[event] ??= [];
        listeners[event].push(listener);
      },
    },
    code: (status: number) => {
      statusCode = status;
      return { send: (body: unknown) => { payload = body; } };
    },
    getHeaders: () => headers,
    getStatus: () => statusCode,
    getPayload: () => payload,
    getHijacked: () => hijacked,
    getWrites: () => writes,
    /** Fire the response-side close listeners, as a dropped socket would. */
    close: () => { for (const listener of listeners.close ?? []) listener(); },
  };
};

const makeRequest = (headers: Record<string, string> = {}) => ({
  headers,
  raw: { on: () => undefined },
}) as any;

describe('loop stream', () => {
  it('sets Cache-Control: no-cache for SSE and hijacks the reply', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream, countLoopStreams } = await import('../src/realtime/loopStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseKeepAliveMs = 0;

    const before = countLoopStreams();
    const reply = makeReply();
    registerLoopStream(makeRequest(), reply as any);

    expect(reply.getStatus()).toBe(200);
    expect(reply.getHeaders()['Cache-Control']).toBe('no-cache');
    // The handler writes to the raw socket for the life of the subscription,
    // so Fastify must be told not to send a response of its own.
    expect(reply.getHijacked()).toBe(true);
    expect(countLoopStreams()).toBe(before + 1);

    reply.close();
    expect(countLoopStreams()).toBe(before);
    config.sseKeepAliveMs = previousKeepAlive;
  });

  it('adds CORS headers for allowed origins', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream } = await import('../src/realtime/loopStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    const previousOrigins = config.allowedOrigins;
    config.sseKeepAliveMs = 0;
    config.allowedOrigins = ['https://localloop.urbnia.com'];

    const reply = makeReply();
    registerLoopStream(makeRequest({ origin: 'https://localloop.urbnia.com' }), reply as any);

    const headers = reply.getHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('https://localloop.urbnia.com');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers.Vary).toBe('Origin');
    reply.close();
    config.sseKeepAliveMs = previousKeepAlive;
    config.allowedOrigins = previousOrigins;
  });

  it('rejects new connections when max clients reached without hijacking', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream } = await import('../src/realtime/loopStream');
    const previousMax = config.sseMaxClients;
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseMaxClients = 0;
    config.sseKeepAliveMs = 0;

    const reply = makeReply();
    registerLoopStream(makeRequest(), reply as any);

    expect(reply.getStatus()).toBe(429);
    expect(reply.getHijacked()).toBe(false);
    expect(reply.getPayload()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Too many active stream connections' },
    });
    config.sseMaxClients = previousMax;
    config.sseKeepAliveMs = previousKeepAlive;
  });

  it('drops a subscriber whose socket throws on write instead of propagating', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream, broadcastLoopEvent, countLoopStreams } = await import('../src/realtime/loopStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseKeepAliveMs = 0;

    const before = countLoopStreams();
    const healthy = makeReply();
    const dead = makeReply({ failWrites: true });
    registerLoopStream(makeRequest(), healthy as any);
    registerLoopStream(makeRequest(), dead as any);
    expect(countLoopStreams()).toBe(before + 2);

    // A broadcast is called from write handlers after the DB commit; a dead
    // socket must not turn that request into a 500 — it is dropped instead.
    expect(() => broadcastLoopEvent({ type: 'test' })).not.toThrow();
    expect(countLoopStreams()).toBe(before + 1);
    expect(healthy.getWrites()).toBe(2);

    // A subsequent broadcast never touches the dropped socket again.
    broadcastLoopEvent({ type: 'test-2' });
    expect(healthy.getWrites()).toBe(3);
    expect(dead.getWrites()).toBe(1);

    healthy.close();
    expect(countLoopStreams()).toBe(before);
    config.sseKeepAliveMs = previousKeepAlive;
  });

  it('skips subscribers whose socket is already destroyed', async () => {
    const { config } = await import('../src/config');
    const { registerLoopStream, broadcastLoopEvent, countLoopStreams } = await import('../src/realtime/loopStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseKeepAliveMs = 0;

    const before = countLoopStreams();
    const reply = makeReply();
    registerLoopStream(makeRequest(), reply as any);
    reply.raw.destroyed = true;

    broadcastLoopEvent({ type: 'test' });
    expect(reply.getWrites()).toBe(1);
    expect(countLoopStreams()).toBe(before);
    config.sseKeepAliveMs = previousKeepAlive;
  });
});
