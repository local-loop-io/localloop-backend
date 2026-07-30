import { describe, expect, it } from 'bun:test';
import { handleAuth } from '../src/auth';

const makeReply = () => {
  return {
    statusCode: 200,
    payload: null as unknown,
    code(status: number) {
      this.statusCode = status;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
    header() {
      return this;
    },
  };
};

describe('handleAuth', () => {
  it('returns 503 §8.3 envelope when auth is disabled', async () => {
    const reply = makeReply();
    const request = {
      url: '/api/auth/sign-in/email',
      method: 'POST',
      headers: {},
      body: { email: 'a@example.com', password: 'secret' },
    } as any;

    await handleAuth(request, reply as any);

    expect(reply.statusCode).toBe(503);
    const body = reply.payload as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Auth is disabled');
  });
});
