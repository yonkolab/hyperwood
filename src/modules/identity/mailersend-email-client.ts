import { env } from '../../config/env';

type MailerSendFetchResponse = {
  ok: boolean;
  status: number;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
};

type MailerSendFetcher = {
  fetch(input: string, init: RequestInit): Promise<MailerSendFetchResponse>;
};

export type MailerSendVerificationEmailInput = {
  toEmail: string;
  toName: string | null;
  subject: string;
  text: string;
  html: string;
};

export type MailerSendVerificationEmailResult = {
  providerMessageId: string | null;
  warningCode: string | null;
  warningMessage: string | null;
};

export class MailerSendRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class MailerSendEmailClient {
  constructor(
    private readonly fetcher: MailerSendFetcher = {
      fetch: (input, init) => fetch(input, init),
    },
  ) {}

  /**
   * Send one verification email through MailerSend.
   *
   * Example:
   * `await client.sendVerificationEmail({ toEmail: 'user@example.com', subject: 'Verify', text: '...', html: '<p>...</p>' })`
   */
  async sendVerificationEmail(
    input: MailerSendVerificationEmailInput,
  ): Promise<MailerSendVerificationEmailResult> {
    const response = await this.fetcher.fetch(
      'https://api.mailersend.com/v1/email',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MAILERSEND_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: {
            email: env.MAILERSEND_FROM_EMAIL,
            name: env.EMAIL_FROM_NAME,
          },
          to: [
            {
              email: input.toEmail,
              ...(input.toName ? { name: input.toName } : {}),
            },
          ],
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      },
    );
    const responseText = await response.text();

    if (!response.ok) {
      throw new MailerSendRequestError(
        `mailersend_http_${String(response.status)}`,
        `MailerSend returned status ${String(response.status)} with body ${responseText || '[empty]'}`,
      );
    }

    const parsedBody =
      responseText.length > 0 ? safeJsonParse(responseText) : {};
    const warning = getFirstWarning(parsedBody);

    return {
      providerMessageId: response.headers.get('x-message-id'),
      warningCode: warning?.type ?? null,
      warningMessage: warning?.warning ?? null,
    };
  }
}

function safeJsonParse(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue);
  } catch {
    return {};
  }
}

function getFirstWarning(payload: unknown):
  | {
      type?: string;
      warning?: string;
    }
  | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('warnings' in payload) ||
    !Array.isArray(payload.warnings)
  ) {
    return undefined;
  }

  const firstWarning = payload.warnings[0];

  if (typeof firstWarning !== 'object' || firstWarning === null) {
    return undefined;
  }

  return firstWarning as {
    type?: string;
    warning?: string;
  };
}
