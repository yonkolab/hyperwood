# hyperwood

Prediction market API skeleton focused on the day-1 `identity-and-access` foundation.

## Stack

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM

## Identity foundation included

- user registration with password identity
- password login with opaque session tokens
- linking a password identity to an existing user record
- suspicious login auditing with temporary restriction thresholds
- scoped API key creation for authenticated users

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Generate or review migrations with `npm run db:generate` when the schema changes.
4. Apply the current migration set with `npm run db:migrate`.
5. Run the server with `npm run dev`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run db:generate`
- `npm run db:migrate`

## Database bootstrap

The first identity migration already exists under `drizzle/migrations/` and creates:

- `users`
- `user_identities`
- `user_sessions`
- `user_mfa_factors`
- `api_keys`

## Initial routes

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/request-email-verification`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/mfa/totp/verify`
- `POST /api/v1/auth/mfa/totp/authorize`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-key/me`
- `GET /api/v1/auth/api-key/hmac/me`
- `DELETE /api/v1/auth/api-keys/:apiKeyId`
- `POST /api/v1/auth/mfa/totp/setup`
- `POST /api/v1/auth/mfa/totp/confirm`
- `POST /api/v1/internal/auth/link-existing-user`

For users with active MFA, sensitive account actions like API key creation and revocation require a short-lived step-up authorization from `POST /api/v1/auth/mfa/totp/authorize`.

For step-up MFA requests, send:

- `Authorization: Bearer <session-token>`
- JSON body with `action` and the 6-digit TOTP `code`

For MFA-gated sensitive routes, send:

- `x-mfa-authorization`: short-lived token returned by the authorize route

For HMAC requests, send:

- `x-api-key`: API key prefix
- `x-api-timestamp`: unix timestamp in seconds
- `x-api-nonce`: unique client nonce
- `x-api-signature`: hex HMAC-SHA256 of `METHOD + "\\n" + PATH + "\\n" + TIMESTAMP + "\\n" + NONCE`

The internal link route requires the `x-bootstrap-token` header matching `INTERNAL_BOOTSTRAP_TOKEN`.
