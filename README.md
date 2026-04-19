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
- compliance capability evaluation and review holds
- funding method registry with ledger-backed wallet balances
- public market catalog and market detail bootstrap
- authenticated order intake with idempotent reservation

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Generate or review migrations with `npm run db:generate` when the schema changes.
4. Apply the current migration set with `npm run db:migrate`.
5. Run the server with `npm run dev`.

If you need browser-based clients such as the Scalar docs preview to call the API from a different origin, set `CORS_ALLOWED_ORIGINS` to a comma-separated allowlist. In development, Hyperwood also accepts localhost and private-network origins by default so WSL-hosted docs previews can reach the API.

Hyperwood applies default external API throttles:

- public auth routes: `AUTH_RATE_LIMIT_MAX_REQUESTS` within `AUTH_RATE_LIMIT_WINDOW_SECONDS`
- other external API routes: `API_RATE_LIMIT_MAX_REQUESTS` within `API_RATE_LIMIT_WINDOW_SECONDS`

Exceeded windows return `429 rate_limit_exceeded` and are available to operators through the internal rate-limit event feed.

## Local Docker

1. Copy `.env.example` to `.env`.
2. Start the stack with `npm run docker:local:up`.
3. The API will be available at `http://localhost:3000` and PostgreSQL at `localhost:5432`.

The local Docker stack uses `docker-compose.local.yml`, starts PostgreSQL 17, overrides `DATABASE_URL` to the internal `db` service, and runs `npm run db:migrate` before the development server starts.

## API Docs

The API documentation source lives in:

- `docs/openapi/openapi.yaml`
- `docs/openapi/paths/`
- `docs/openapi/components/`
- `docs/guides/`

OpenAPI is the source of truth for HTTP reference documentation. Human guides live alongside it under `docs/guides`.
The interactive reference is rendered with Scalar.

Useful commands:

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run check:biome`
- `npm run docs:lint`
- `npm run docs:build`
- `npm run docs:preview`

`docs:preview` starts a small Fastify server with Scalar at `/reference`.
`docs:build` generates a static Scalar reference into `docs/reference/`.

Relevant guides:

- `docs/guides/getting-started.md`
- `docs/guides/authentication.md`
- `docs/guides/errors.md`
- `docs/guides/idempotency.md`
- `docs/guides/rate-limits.md`

When adding or changing endpoints:

1. update the relevant route and service code
2. update the matching OpenAPI path and component files
3. add or update API and integration coverage for the new behavior
4. update or add guides if the behavior affects client integration
5. run `npm run check:biome`, `npm run docs:lint`, `npm run test:api`, and the relevant integration tests

## Linting and Formatting

Hyperwood uses Biome for formatting and linting.

Current repository policy:

- 2-space indentation
- single quotes in JavaScript and TypeScript
- no unused imports
- no unused variables

Useful commands:

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run check:biome`

## Testing

The test suite is split by intent:

- `tests/unit/`: pure logic with no infrastructure dependency
- `tests/api/`: Fastify `inject()` tests against the real app instance
- `tests/integration/`: PostgreSQL-backed service tests using Testcontainers and real Drizzle migrations
- `tests/helpers/`: small reusable bootstrapping helpers
- `tests/fixtures/`: deterministic payload builders and test data shapes
- `tests/setup/`: shared Vitest setup and DB lifecycle hooks

Useful commands:

- `npm test`
- `npm run test:unit`
- `npm run test:api`
- `npm run test:integration`
- `npm run test:coverage`
- `npm run test:openapi`

Notes:

- `npm test` runs the fast unit and API layers.
- `npm run test:integration` requires Docker because it starts PostgreSQL with Testcontainers.
- DB-backed tests apply the real migrations from `drizzle/migrations` and reset state between tests.
- The OpenAPI spec remains under `docs/openapi/` and is validated with `npm run docs:lint` or `npm run test:openapi`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run check:biome`
- `npm run check`
- `npm test`
- `npm run test:unit`
- `npm run test:api`
- `npm run test:integration`
- `npm run test:coverage`
- `npm run test:openapi`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run docker:local:up`
- `npm run docker:local:down`

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
- `GET /api/v1/compliance/me/capabilities`
- `GET /api/v1/funding/methods`
- `GET /api/v1/exchange/schedule`
- `GET /api/v1/funding/deposits`
- `POST /api/v1/funding/deposits`
- `GET /api/v1/funding/withdrawals`
- `POST /api/v1/funding/withdrawals`
- `GET /api/v1/wallet/balance`
- `GET /api/v1/markets`
- `GET /api/v1/markets/:marketId`
- `GET /api/v1/markets/:marketId/order-book`
- `GET /api/v1/markets/:marketId/order-book/deltas`
- `GET /api/v1/markets/:marketId/trades`
- `GET /api/v1/markets/:marketId/announcements`
- `GET /api/v1/portfolio`
- `GET /api/v1/portfolio/fills`
- `GET /api/v1/portfolio/settlements`
- `POST /api/v1/orders`
- `DELETE /api/v1/orders/:orderId`
- `POST /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-key/me`
- `GET /api/v1/auth/api-key/hmac/me`
- `DELETE /api/v1/auth/api-keys/:apiKeyId`
- `POST /api/v1/auth/mfa/totp/setup`
- `POST /api/v1/auth/mfa/totp/confirm`
- `POST /api/v1/internal/auth/link-existing-user`
- `POST /api/v1/internal/compliance/users/:userId/profile`
- `POST /api/v1/internal/compliance/users/:userId/restrictions`
- `POST /api/v1/internal/funding/users/:userId/methods`
- `POST /api/v1/internal/funding/users/:userId/wallet/seed`
- `POST /api/v1/internal/funding/deposits/:depositId/settle`
- `POST /api/v1/internal/funding/withdrawals/:withdrawalId/approve`
- `POST /api/v1/internal/funding/withdrawals/:withdrawalId/fail`
- `POST /api/v1/internal/funding/withdrawals/:withdrawalId/settle`
- `POST /api/v1/internal/funding/reconciliation/runs`
- `GET /api/v1/internal/funding/reconciliation/discrepancies`
- `POST /api/v1/internal/exchange/schedule`
- `GET /api/v1/internal/operations/reviews`
- `GET /api/v1/internal/operations/audit-events`
- `GET /api/v1/internal/operations/rate-limit-events`
- `POST /api/v1/internal/markets/events`
- `POST /api/v1/internal/markets`
- `POST /api/v1/internal/markets/:marketId/match`
- `POST /api/v1/internal/markets/:marketId/announcements`
- `POST /api/v1/internal/markets/:marketId/status`
- `POST /api/v1/internal/markets/:marketId/resolve`
- `POST /api/v1/internal/markets/:marketId/settle`

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

For order creation requests, send:

- `Authorization: Bearer <session-token>`
- `idempotency-key`: stable client-generated key for retried submissions

Funding method discovery and wallet or portfolio reads accept an optional `currency` query, for example `GET /api/v1/funding/methods?currency=BRL`.

The internal link route requires the `x-bootstrap-token` header matching `INTERNAL_BOOTSTRAP_TOKEN`.

The internal compliance routes use the same `x-bootstrap-token` header and let you upsert KYC/jurisdiction state or place an account under a compliance hold.
