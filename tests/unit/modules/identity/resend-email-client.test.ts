import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../../../src/config/env';
import {
  ResendEmailClient,
  type ResendRequestError,
} from '../../../../src/modules/identity/resend-email-client';

class FakeFetch {
  private nextResponse: {
    status: number;
    body: unknown;
  } = {
    status: 200,
    body: { id: 'msg-123' },
  };

  private nextError: unknown = null;

  lastInput: {
    url: string;
    init: RequestInit;
  } | null = null;

  readonly handler: typeof fetch = (async (url: unknown, init: unknown) => {
    this.lastInput = {
      url: String(url),
      init: init as RequestInit,
    };

    if (this.nextError) {
      throw this.nextError;
    }

    const { status, body } = this.nextResponse;

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  queueResponse(response: { status: number; body: unknown }) {
    this.nextError = null;
    this.nextResponse = response;
  }

  queueError(error: unknown) {
    this.nextError = error;
  }
}

describe('resend email client', () => {
  let fetchImpl: FakeFetch;
  let client: ResendEmailClient;

  beforeEach(() => {
    fetchImpl = new FakeFetch();
    client = new ResendEmailClient(fetchImpl.handler);
  });

  it('sends the verification email payload to the Resend API', async () => {
    const result = await client.sendVerificationEmail({
      toEmail: 'user@example.com',
      toName: 'User',
      subject: 'Verify your email',
      text: 'token',
      html: '<p>token</p>',
    });

    expect(result).toEqual({
      providerMessageId: 'msg-123',
      warningCode: null,
      warningMessage: null,
    });
    expect(fetchImpl.lastInput?.url).toBe('https://api.resend.com/emails');

    const body = JSON.parse(String(fetchImpl.lastInput?.init.body)) as Record<
      string,
      unknown
    >;
    expect(body.subject).toBe('Verify your email');
    expect(body.to).toEqual(['User <user@example.com>']);
    expect(body.from).toContain(env.RESEND_FROM_EMAIL);
  });

  it('uses the bare recipient email when no name is provided', async () => {
    await client.sendVerificationEmail({
      toEmail: 'user@example.com',
      toName: null,
      subject: 'Verify your email',
      text: 'token',
      html: '<p>token</p>',
    });

    const body = JSON.parse(String(fetchImpl.lastInput?.init.body)) as Record<
      string,
      unknown
    >;
    expect(body.to).toEqual(['user@example.com']);
  });

  it('throws a normalized error for non-2xx responses', async () => {
    fetchImpl.queueResponse({
      status: 401,
      body: { message: 'Unauthenticated.' },
    });

    await expect(
      client.sendVerificationEmail({
        toEmail: 'user@example.com',
        toName: null,
        subject: 'Verify your email',
        text: 'token',
        html: '<p>token</p>',
      }),
    ).rejects.toMatchObject({
      code: 'resend_http_401',
      message: expect.stringContaining('Resend returned status 401'),
    } satisfies Partial<ResendRequestError>);
  });

  it('throws a normalized error for network failures', async () => {
    fetchImpl.queueError(new Error('connection reset'));

    await expect(
      client.sendVerificationEmail({
        toEmail: 'user@example.com',
        toName: null,
        subject: 'Verify your email',
        text: 'token',
        html: '<p>token</p>',
      }),
    ).rejects.toMatchObject({
      code: 'resend_request_failed',
    } satisfies Partial<ResendRequestError>);
  });
});
