# Errors

The API uses a consistent JSON error envelope from the Fastify global error handler:

```json
{
  "error": "invalid_session",
  "message": "session is invalid or expired"
}
```

In some framework-produced cases, Fastify may also include:

```json
{
  "statusCode": 401,
  "code": "invalid_session",
  "error": "Unauthorized",
  "message": "session is invalid or expired"
}
```

The stable fields to rely on are:

- `error`
- `message`

## Common statuses

- `400`: malformed request, missing required header, failed input validation
- `401`: missing or invalid authentication
- `403`: authenticated but not allowed to perform the action
- `404`: resource not found
- `409`: state conflict, duplicate identity, non-settleable transfer, non-cancellable order
- `410`: expired verification or MFA challenge
- `429`: temporary login restriction after suspicious failures
- `500`: unexpected internal failure

## Domain examples

Identity:

- `invalid_credentials`
- `invalid_session`
- `invalid_totp_code`
- `verification_expired`

Funding:

- `insufficient_available_balance`
- `funding_method_currency_not_supported`
- `withdrawal_not_reviewable`

Markets and orders:

- `market_not_found`
- `market_not_matchable`
- `missing_idempotency_key`
- `order_not_cancellable`

## Validation behavior

Handlers currently validate inputs with Zod inside the route handlers. That means validation failures are not yet normalized into a dedicated RFC-style validation error schema with per-field details.

Recommended future work:

- standardize field-level validation errors
- add request correlation IDs to every error response
- document retry semantics per error code
