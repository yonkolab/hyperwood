import { beforeEach, describe, expect, it } from 'vitest';
import {
  MailerSendEmailClient,
  type MailerSendRequestError,
} from '../../../../src/modules/identity/mailersend-email-client';

class FakeMailerSendFetch {
  private nextResponse: {
    ok: boolean;
    status: number;
    body: string;
    messageId?: string;
  } = {
    ok: true,
    status: 202,
    body: '',
  };

  lastRequest: {
    url: string;
    init: RequestInit;
  } | null = null;

  queueResponse(response: {
    ok: boolean;
    status: number;
    body: string;
    messageId?: string;
  }) {
    this.nextResponse = response;
  }

  async fetch(url: string, init: RequestInit) {
    this.lastRequest = {
      url,
      init,
    };

    return {
      ok: this.nextResponse.ok,
      status: this.nextResponse.status,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'x-message-id'
            ? (this.nextResponse.messageId ?? null)
            : null,
      },
      text: async () => this.nextResponse.body,
    };
  }
}

describe('MailerSendEmailClient', () => {
  let fakeFetch: FakeMailerSendFetch;
  let client: MailerSendEmailClient;

  beforeEach(() => {
    fakeFetch = new FakeMailerSendFetch();
    client = new MailerSendEmailClient({
      fetch: (url, init) => fakeFetch.fetch(url, init),
    });
  });

  it('returns the provider message id for accepted deliveries', async () => {
    fakeFetch.queueResponse({
      ok: true,
      status: 202,
      body: '',
      messageId: 'message_123',
    });

    const result = await client.sendVerificationEmail({
      toEmail: 'trader@example.com',
      toName: 'Trader',
      subject: 'Verify',
      text: 'token',
      html: '<p>token</p>',
    });

    expect(result).toEqual({
      providerMessageId: 'message_123',
      warningCode: null,
      warningMessage: null,
    });
    expect(fakeFetch.lastRequest?.url).toBe(
      'https://api.mailersend.com/v1/email',
    );
  });

  it('surfaces warning payloads from MailerSend', async () => {
    fakeFetch.queueResponse({
      ok: true,
      status: 202,
      body: JSON.stringify({
        warnings: [
          {
            type: 'SOME_SUPPRESSED',
            warning: 'Some recipients are suppressed.',
          },
        ],
      }),
      messageId: 'message_123',
    });

    const result = await client.sendVerificationEmail({
      toEmail: 'trader@example.com',
      toName: null,
      subject: 'Verify',
      text: 'token',
      html: '<p>token</p>',
    });

    expect(result).toEqual({
      providerMessageId: 'message_123',
      warningCode: 'SOME_SUPPRESSED',
      warningMessage: 'Some recipients are suppressed.',
    });
  });

  it('throws a provider error for non-success responses', async () => {
    fakeFetch.queueResponse({
      ok: false,
      status: 422,
      body: '{"message":"The given data was invalid."}',
    });

    await expect(
      client.sendVerificationEmail({
        toEmail: 'trader@example.com',
        toName: null,
        subject: 'Verify',
        text: 'token',
        html: '<p>token</p>',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MailerSendRequestError>>({
        code: 'mailersend_http_422',
      }),
    );
  });
});
