# Getting Started

This API is served under `/api/v1` on the application host. In local development the default base URL is:

`http://localhost:3000`

## First requests

1. Register a user with `POST /api/v1/auth/register`.
2. In non-production environments, the response includes `verificationChallenge.token`.
3. Verify the email with `POST /api/v1/auth/verify-email`.
4. Log in with `POST /api/v1/auth/login`.
5. Use the returned `sessionToken` as `Authorization: Bearer <token>`.

## Example flow

Register:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "username": "hyperwooduser",
    "password": "supersecure123"
  }'
```

Verify email in development:

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "TOKEN_FROM_VERIFICATION_CHALLENGE"
  }'
```

Log in and store the session token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "supersecure123"
  }' | jq -r '.sessionToken')
```

Fetch the wallet balance:

```bash
curl "http://localhost:3000/api/v1/wallet/balance?currency=BRL" \
  -H "Authorization: Bearer $TOKEN"
```

## Internal endpoints

Internal routes use `x-bootstrap-token` instead of bearer session auth. Set that header to the value of `INTERNAL_BOOTSTRAP_TOKEN`.

## Markets and orders

- Market catalog endpoints are public.
- Order creation requires bearer auth and an `idempotency-key` header.
- Wallet, funding, compliance, and portfolio endpoints are authenticated.

## Current scope

Implemented today:

- REST endpoints
- bearer session auth
- API keys
- HMAC-signed API key auth
- internal bootstrap-protected endpoints

Not implemented today:

- webhook delivery
- websocket or streaming APIs
- public developer portal
