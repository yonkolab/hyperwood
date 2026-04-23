import { and, desc, eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  suppressedEmailRecipients,
  transactionalEmailFeedbackEvents,
} from '../../db/schema';
import {
  hmacSha256Hex,
  normalizeEmail,
  safeEqualString,
} from '../../lib/crypto';
import { AppError } from '../../lib/errors';

const MAILERSEND_TEST_WEBHOOK_SECRET = 'test_Am3L1GuOIc4blLUuHqAPxxwkZaJyEk8G';

type MailerSendWebhookPayload = {
  type: string;
  created_at?: string;
  message?: string;
  data?: Record<string, unknown>;
};

type NormalizedMailerSendEvent = {
  eventType: string;
  status:
    | 'sent'
    | 'delivered'
    | 'deferred'
    | 'soft_bounced'
    | 'hard_bounced'
    | 'complained';
  providerEventId: string;
  providerMessageId: string | null;
  recipientEmail: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export class EmailWebhookService {
  /**
   * Verify and process one MailerSend webhook request.
   *
   * Example:
   * `await service.processMailerSendWebhook({ rawBody, signature, body })`
   */
  async processMailerSendWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    body: unknown;
  }) {
    const payload = parseWebhookPayload(input.body);
    this.verifyMailerSendSignature(
      input.rawBody,
      input.signature,
      payload.type,
    );

    if (payload.type === 'webhook.test') {
      return {
        acknowledged: true,
        test: true,
      };
    }

    const event = normalizeMailerSendEvent(payload);
    await this.recordFeedbackEvent(event);
    await this.applySuppressionState(event);

    return {
      acknowledged: true,
      test: false,
    };
  }

  async listEmailFeedbackEvents(input: {
    limit: number;
    recipientEmail?: string;
    status?:
      | 'sent'
      | 'delivered'
      | 'deferred'
      | 'soft_bounced'
      | 'hard_bounced'
      | 'complained';
  }) {
    const conditions = [];

    if (input.recipientEmail) {
      conditions.push(
        eq(
          transactionalEmailFeedbackEvents.recipientEmail,
          normalizeEmail(input.recipientEmail),
        ),
      );
    }

    if (input.status) {
      conditions.push(
        eq(transactionalEmailFeedbackEvents.status, input.status),
      );
    }

    const rows = await db
      .select()
      .from(transactionalEmailFeedbackEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactionalEmailFeedbackEvents.occurredAt))
      .limit(input.limit);

    return rows;
  }

  async listSuppressedRecipients(input: {
    limit: number;
    email?: string;
    reason?: string;
  }) {
    const conditions = [];

    if (input.email) {
      conditions.push(
        eq(suppressedEmailRecipients.email, normalizeEmail(input.email)),
      );
    }

    if (input.reason) {
      conditions.push(eq(suppressedEmailRecipients.reason, input.reason));
    }

    const rows = await db
      .select()
      .from(suppressedEmailRecipients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(suppressedEmailRecipients.updatedAt))
      .limit(input.limit);

    return rows;
  }

  private verifyMailerSendSignature(
    rawBody: string,
    receivedSignature: string | undefined,
    eventType: string,
  ) {
    if (!receivedSignature) {
      throw new AppError(
        401,
        'missing_email_webhook_signature',
        'missing MailerSend webhook signature',
      );
    }

    const signingSecret =
      eventType === 'webhook.test'
        ? MAILERSEND_TEST_WEBHOOK_SECRET
        : env.MAILERSEND_WEBHOOK_SIGNING_SECRET;

    if (signingSecret.length === 0) {
      throw new AppError(
        500,
        'email_webhook_secret_missing',
        'MAILERSEND_WEBHOOK_SIGNING_SECRET must be configured before processing non-test MailerSend webhooks',
      );
    }

    const computedSignature = hmacSha256Hex(signingSecret, rawBody);

    if (!safeEqualString(computedSignature, receivedSignature)) {
      throw new AppError(
        401,
        'invalid_email_webhook_signature',
        'MailerSend webhook signature is invalid',
      );
    }
  }

  private async recordFeedbackEvent(event: NormalizedMailerSendEvent) {
    await db
      .insert(transactionalEmailFeedbackEvents)
      .values({
        provider: 'mailersend',
        eventType: event.eventType,
        status: event.status,
        providerEventId: event.providerEventId,
        providerMessageId: event.providerMessageId,
        recipientEmail: event.recipientEmail,
        payload: event.payload,
        occurredAt: event.occurredAt,
      })
      .onConflictDoNothing();
  }

  private async applySuppressionState(event: NormalizedMailerSendEvent) {
    if (event.status === 'hard_bounced' || event.status === 'complained') {
      const recipientEmail = event.recipientEmail;

      if (!recipientEmail) {
        return;
      }

      const existingRows = await db
        .select({
          id: suppressedEmailRecipients.id,
        })
        .from(suppressedEmailRecipients)
        .where(eq(suppressedEmailRecipients.email, recipientEmail))
        .limit(1);
      const existing = existingRows[0];

      if (existing) {
        await db
          .update(suppressedEmailRecipients)
          .set({
            reason: event.status,
            providerEventId: event.providerEventId,
            providerMessageId: event.providerMessageId,
            sourceType: 'mailersend_activity',
            metadata: event.payload,
            releasedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(suppressedEmailRecipients.id, existing.id));

        return;
      }

      await db.insert(suppressedEmailRecipients).values({
        email: recipientEmail,
        reason: event.status,
        provider: 'mailersend',
        providerEventId: event.providerEventId,
        providerMessageId: event.providerMessageId,
        sourceType: 'mailersend_activity',
        metadata: event.payload,
      });
      return;
    }

    if (event.eventType === 'recipient.on_hold_removed') {
      const recipientEmail = event.recipientEmail;

      if (!recipientEmail) {
        return;
      }

      await db
        .update(suppressedEmailRecipients)
        .set({
          releasedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(suppressedEmailRecipients.email, recipientEmail),
            eq(suppressedEmailRecipients.provider, 'mailersend'),
          ),
        );
    }
  }
}

function parseWebhookPayload(body: unknown): MailerSendWebhookPayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(
      400,
      'invalid_email_webhook_payload',
      `expected MailerSend webhook object body but received ${String(body)}`,
    );
  }

  const type = 'type' in body ? body.type : undefined;

  if (typeof type !== 'string' || type.length === 0) {
    throw new AppError(
      400,
      'invalid_email_webhook_payload',
      `expected MailerSend webhook type string but received ${String(type)}`,
    );
  }

  return body as MailerSendWebhookPayload;
}

function normalizeMailerSendEvent(
  payload: MailerSendWebhookPayload,
): NormalizedMailerSendEvent {
  const mappedStatus = mapMailerSendStatus(payload.type);
  const data = payload.data ?? {};
  const recipientEmail = getOptionalEmail(data.email);
  const providerMessageId = getOptionalString(data.message_id);
  const occurredAt = parseOccurredAt(payload.created_at);
  const providerEventId = getProviderEventId(
    payload.type,
    data,
    recipientEmail,
    occurredAt,
  );

  return {
    eventType: payload.type,
    status: mappedStatus,
    providerEventId,
    providerMessageId,
    recipientEmail,
    occurredAt,
    payload: {
      ...(payload.data ?? {}),
    },
  };
}

function getProviderEventId(
  eventType: string,
  data: Record<string, unknown>,
  recipientEmail: string | null,
  occurredAt: Date,
) {
  const explicitId = getOptionalString(data.id);

  if (explicitId) {
    return explicitId;
  }

  if (eventType.startsWith('recipient.on_hold_') && recipientEmail) {
    return `${eventType}:${recipientEmail}:${occurredAt.toISOString()}`;
  }

  throw new AppError(
    400,
    'invalid_email_webhook_payload',
    `expected data.id to be a non-empty string for event type "${eventType}"`,
  );
}

function mapMailerSendStatus(eventType: string) {
  switch (eventType) {
    case 'activity.sent':
      return 'sent';
    case 'activity.delivered':
      return 'delivered';
    case 'activity.deferred':
      return 'deferred';
    case 'activity.soft_bounced':
      return 'soft_bounced';
    case 'activity.hard_bounced':
      return 'hard_bounced';
    case 'activity.spam_complaint':
      return 'complained';
    case 'recipient.on_hold_added':
      return 'hard_bounced';
    case 'recipient.on_hold_removed':
      return 'delivered';
    default:
      throw new AppError(
        400,
        'unsupported_email_webhook_event',
        `unsupported MailerSend webhook type "${eventType}" expected one of activity.sent, activity.delivered, activity.deferred, activity.soft_bounced, activity.hard_bounced, activity.spam_complaint, recipient.on_hold_added, recipient.on_hold_removed`,
      );
  }
}

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getOptionalEmail(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0
    ? normalizeEmail(value)
    : null;
}

function parseOccurredAt(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      400,
      'invalid_email_webhook_payload',
      `expected created_at to be an ISO timestamp but received ${String(value)}`,
    );
  }

  return parsed;
}
