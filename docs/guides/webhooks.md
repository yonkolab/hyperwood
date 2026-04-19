# Webhooks

Hyperwood currently supports signed funding provider callbacks at:

- `POST /api/v1/webhooks/funding/providers/:provider`

Current behavior:

- the caller sends `x-webhook-timestamp` and `x-webhook-signature`
- Hyperwood rejects missing, expired, or invalid signatures before applying transfer state changes
- accepted events are deduplicated by provider and event ID
- the webhook can move funding transfers through supported provider states without using bootstrap-only internal routes

Supported event shape:

- `eventType`: `funding.transfer.updated`
- `transferId`: existing Hyperwood funding transfer UUID
- `status`: `pending`, `in_review`, `settled`, or `failed`
- `providerTransferReference`: optional provider-side transfer identifier
- `failureReason`: optional failure detail for failed transfers

Signature contract:

- canonical payload:
  `timestamp + "\\n" + provider + "\\n" + eventId + "\\n" + eventType + "\\n" + transferId + "\\n" + status + "\\n" + occurredAt + "\\n" + providerTransferReference + "\\n" + failureReason`
- algorithm: HMAC-SHA256
- secret: `FUNDING_PROVIDER_WEBHOOK_SECRET`
- freshness window: `FUNDING_PROVIDER_WEBHOOK_MAX_SKEW_SECONDS`

Operational notes:

- invalid signatures are rejected and logged with request correlation data
- successful processing writes a durable provider webhook event record for idempotent replay handling
- callers should record `X-Request-Id` when debugging callback failures

Current limitations:

- reversal handling is not implemented yet
- realtime outbound event delivery is still future work
