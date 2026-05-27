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

describe('interest stream', () => {
  it('adds CORS headers for allowed origins', async () => {
    const { config } = await import('../src/config');
    const { registerInterestStream } = await import('../src/realtime/interestStream');
    const previousKeepAlive = config.sseKeepAliveMs;
    const previousOrigins = config.allowedOrigins;
    config.sseKeepAliveMs = 0;
    config.allowedOrigins = ['https://localloop.urbnia.com'];

    const reply = makeReply();
    const request = {
      headers: { origin: 'https://localloop.urbnia.com' },
      raw: { on: () => undefined },
    } as any;

    registerInterestStream(request, reply as any);

    const headers = reply.getHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('https://localloop.urbnia.com');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers.Vary).toBe('Origin');
    config.sseKeepAliveMs = previousKeepAlive;
    config.allowedOrigins = previousOrigins;
  });

  it('rejects new connections when max clients reached', async () => {
    const { config } = await import('../src/config');
    const { registerInterestStream } = await import('../src/realtime/interestStream');
    const previousMax = config.sseMaxClients;
    const previousKeepAlive = config.sseKeepAliveMs;
    config.sseMaxClients = 0;
    config.sseKeepAliveMs = 0;

    const reply = makeReply();
    const request = {
      headers: {},
      raw: { on: () => undefined },
    } as any;

    registerInterestStream(request, reply as any);

    expect(reply.getStatus()).toBe(429);
    expect(reply.getPayload()).toEqual({ error: 'Too many active stream connections' });
    config.sseMaxClients = previousMax;
    config.sseKeepAliveMs = previousKeepAlive;
  });
});
