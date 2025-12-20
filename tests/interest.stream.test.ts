import { describe, expect, it } from 'bun:test';

const makeReply = () => {
  const headers: Record<string, string> = {};
  return {
    raw: {
      writeHead: (_status: number, nextHeaders: Record<string, string>) => {
        Object.assign(headers, nextHeaders);
      },
      write: () => undefined,
    },
    getHeaders: () => headers,
  };
};

describe('interest stream', () => {
  it('adds CORS headers for allowed origins', async () => {
    process.env.ALLOWED_ORIGINS = 'https://local-loop-io.github.io';
    const { registerInterestStream } = await import('../src/realtime/interestStream');

    const reply = makeReply();
    const request = {
      headers: { origin: 'https://local-loop-io.github.io' },
      raw: { on: () => undefined },
    } as any;

    registerInterestStream(request, reply as any);

    const headers = reply.getHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('https://local-loop-io.github.io');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers.Vary).toBe('Origin');
  });
});
