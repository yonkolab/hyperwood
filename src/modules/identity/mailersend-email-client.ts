import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import { env } from '../../config/env';

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

type MailerSendSdkResponse = {
  headers: Record<string, string | undefined>;
  body: unknown;
  statusCode: number;
};

type MailerSendSdkClient = {
  email: {
    send(params: EmailParams): Promise<MailerSendSdkResponse>;
  };
};

export class MailerSendEmailClient {
  private readonly sdkClient: MailerSendSdkClient;

  constructor(sdkClient?: MailerSendSdkClient) {
    this.sdkClient =
      sdkClient ??
      new MailerSend({
        apiKey: env.MAILERSEND_API_TOKEN,
      });
  }

  /**
   * Send one verification email through MailerSend.
   *
   * Example:
   * `await client.sendVerificationEmail({ toEmail: 'user@example.com', subject: 'Verify', text: '...', html: '<p>...</p>' })`
   */
  async sendVerificationEmail(
    input: MailerSendVerificationEmailInput,
  ): Promise<MailerSendVerificationEmailResult> {
    const sender = new Sender(env.MAILERSEND_FROM_EMAIL, env.EMAIL_FROM_NAME);
    const replyTo = new Recipient(
      env.MAILERSEND_FROM_EMAIL,
      env.EMAIL_FROM_NAME,
    );
    const recipient = new Recipient(input.toEmail, input.toName ?? undefined);
    const emailParams = new EmailParams()
      .setFrom(sender)
      .setTo([recipient])
      .setReplyTo(replyTo)
      .setSubject(input.subject)
      .setText(input.text)
      .setHtml(input.html);

    try {
      const response = await this.sdkClient.email.send(emailParams);
      const warning = getFirstWarning(response.body);

      return {
        providerMessageId: getProviderMessageId(response.headers),
        warningCode: warning?.type ?? null,
        warningMessage: warning?.warning ?? null,
      };
    } catch (error) {
      throw normalizeMailerSendError(error);
    }
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

function getProviderMessageId(headers: Record<string, string | undefined>) {
  return headers['x-message-id'] ?? headers['X-Message-Id'] ?? null;
}

function normalizeMailerSendError(error: unknown) {
  if (isMailerSendApiError(error)) {
    const responseBody = safeStringify(error.body);

    return new MailerSendRequestError(
      `mailersend_http_${String(error.statusCode)}`,
      `MailerSend returned status ${String(error.statusCode)} with body ${responseBody}`,
    );
  }

  if (error instanceof Error) {
    return new MailerSendRequestError(
      'mailersend_request_failed',
      error.message,
    );
  }

  return new MailerSendRequestError(
    'mailersend_request_failed',
    `MailerSend request failed with unexpected error ${String(error)}`,
  );
}

function isMailerSendApiError(value: unknown): value is {
  body: unknown;
  statusCode: number;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number' &&
    'body' in value
  );
}

function safeStringify(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
