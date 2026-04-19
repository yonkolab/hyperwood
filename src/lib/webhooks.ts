import { hmacSha256Hex, safeEqualString } from './crypto';

type FundingWebhookInput = {
  timestamp: number;
  provider: string;
  eventId: string;
  eventType: string;
  transferId: string;
  status: string;
  occurredAt: string;
  providerTransferReference?: string;
  failureReason?: string;
};

export function buildFundingWebhookSignaturePayload(
  input: FundingWebhookInput,
) {
  return [
    String(input.timestamp),
    input.provider,
    input.eventId,
    input.eventType,
    input.transferId,
    input.status,
    input.occurredAt,
    input.providerTransferReference ?? '',
    input.failureReason ?? '',
  ].join('\n');
}

export function signFundingWebhookPayload(
  secret: string,
  input: FundingWebhookInput,
) {
  return hmacSha256Hex(secret, buildFundingWebhookSignaturePayload(input));
}

export function verifyFundingWebhookSignature(input: {
  secret: string;
  signature: string;
  timestamp: number;
  provider: string;
  eventId: string;
  eventType: string;
  transferId: string;
  status: string;
  occurredAt: string;
  providerTransferReference?: string;
  failureReason?: string;
}) {
  const expectedSignature = signFundingWebhookPayload(input.secret, input);

  return safeEqualString(expectedSignature, input.signature);
}
