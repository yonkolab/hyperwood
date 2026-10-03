import { env } from '../../config/env';

export type ResendVerificationEmailInput = {
  toEmail: string;
  toName: string | null;
  subject: string;
  text: string;
  html: string;
};

export type ResendVerificationEmailResult = {
  providerMessageId: string | null;
  warningCode: string | null;
  warningMessage: string | null;
};

export class ResendRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type ResendSendResponse = {
  id?: unknown;
  message?: unknown;
};

export class ResendEmailClient {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /**
   * Send one transactional email through the Resend API.
   *
   * Example:
   * `await client.sendVerificationEmail({ toEmail: 'user@example.com', subject: 'Verify', text: '...', html: '<p>...</p>' })`
   */
  async sendVerificationEmail(
    input: ResendVerificationEmailInput,
  ): Promise<ResendVerificationEmailResult> {
    let response: Response;

    try {
      response = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: `${env.EMAIL_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
          to: [formatRecipient(input.toEmail, input.toName)],
          reply_to: env.RESEND_FROM_EMAIL,
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      });
    } catch (error) {
      throw normalizeResendNetworkError(error);
    }

    if (!response.ok) {
      const responseBody = await safeReadBody(response);
      throw new ResendRequestError(
        `resend_http_${String(response.status)}`,
        `Resend returned status ${String(response.status)} with body ${responseBody}`,
      );
    }

    const payload = (await safeParseJson(response)) as ResendSendResponse;

    return {
      providerMessageId: typeof payload.id === 'string' ? payload.id : null,
      warningCode: null,
      warningMessage: null,
    };
  }
}

function formatRecipient(email: string, name: string | null) {
  if (!name) {
    return email;
  }

  return `${name} <${email}>`;
}

async function safeReadBody(response: Response) {
  const rawBody = await response.text();

  return rawBody.length > 0 ? rawBody : '[empty]';
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeResendNetworkError(error: unknown) {
  if (error instanceof Error) {
    return new ResendRequestError('resend_request_failed', error.message);
  }

  return new ResendRequestError(
    'resend_request_failed',
    `Resend request failed with unexpected error ${String(error)}`,
  );
}
