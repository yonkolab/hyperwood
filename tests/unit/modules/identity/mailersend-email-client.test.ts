import { EmailParams } from 'mailersend';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MailerSendEmailClient,
  type MailerSendRequestError,
} from '../../../../src/modules/identity/mailersend-email-client';

class FakeMailerSendSdk {
  private nextResponse: {
    headers: Record<string, string | undefined>;
    body: unknown;
    statusCode: number;
  } = {
    headers: {},
    body: {},
    statusCode: 202,
  };

  private nextError:
    | {
        body: unknown;
        statusCode: number;
      }
    | Error
    | null = null;

  lastParams: EmailParams | null = null;

  readonly email = {
    send: async (params: EmailParams) => {
      this.lastParams = params;

      if (this.nextError) {
        throw this.nextError;
      }

      return this.nextResponse;
    },
  };

  queueResponse(response: {
    headers: Record<string, string | undefined>;
    body: unknown;
    statusCode: number;
  }) {
    this.nextError = null;
    this.nextResponse = response;
  }

  queueError(
    error:
      | {
          body: unknown;
          statusCode: number;
        }
      | Error,
  ) {
    this.nextError = error;
  }
}

describe('MailerSendEmailClient', () => {
  let fakeSdk: FakeMailerSendSdk;
  let client: MailerSendEmailClient;

  beforeEach(() => {
    fakeSdk = new FakeMailerSendSdk();
    client = new MailerSendEmailClient(fakeSdk);
  });

  it('returns the provider message id for accepted deliveries', async () => {
    fakeSdk.queueResponse({
      headers: {
        'x-message-id': 'message_123',
      },
      body: {},
      statusCode: 202,
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
    expect(fakeSdk.lastParams).toBeInstanceOf(EmailParams);
  });

  it('surfaces warning payloads from MailerSend', async () => {
    fakeSdk.queueResponse({
      headers: {
        'x-message-id': 'message_123',
      },
      body: {
        warnings: [
          {
            type: 'SOME_SUPPRESSED',
            warning: 'Some recipients are suppressed.',
          },
        ],
      },
      statusCode: 202,
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
    fakeSdk.queueError({
      body: {
        message: 'The given data was invalid.',
      },
      statusCode: 422,
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
