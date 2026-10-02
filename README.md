# hyperwood

Prediction market API. auth, security, KYC and more.

## Stack

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM

## Identity foundation included

- user registration with password identity
- password login with opaque session tokens
- idle-expiring bearer sessions with explicit session management
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

Primary currency behavior is configurable:

- `PRIMARY_MARKET_CURRENCY` controls the default currency used when external requests omit `currency`
- `SUPPORTED_MARKET_CURRENCIES` controls which market/account currencies the API accepts at runtime

The current database schema stores market, order, and exchange-fee currencies as `varchar(3)` so adding a new code no longer requires a PostgreSQL enum change.

Hyperwood applies default external API throttles:

- public auth routes: `AUTH_RATE_LIMIT_MAX_REQUESTS` within `AUTH_RATE_LIMIT_WINDOW_SECONDS`
- other external API routes: `API_RATE_LIMIT_MAX_REQUESTS` within `API_RATE_LIMIT_WINDOW_SECONDS`

Exceeded windows return `429 rate_limit_exceeded` and are available to operators through the internal rate-limit event feed.

Every HTTP response also includes `X-Request-Id`. Clients may send `x-request-id` to preserve their own correlation identifier across API logs and support workflows.

Verification email delivery is configurable:

- `EMAIL_DELIVERY_PROVIDER` selects `development_override` or `mailersend`
- `EMAIL_FROM_NAME` controls the sender display name
- `MAILERSEND_API_TOKEN` authenticates MailerSend API requests
- `MAILERSEND_DOMAIN` identifies the verified MailerSend domain
- `MAILERSEND_FROM_EMAIL` must use the configured MailerSend domain

In development and test, `development_override` keeps the raw verification token in the API response for local workflows. Production deployments should switch to `mailersend`.

## Local Docker

1. Copy `.env.example` to `.env`.
2. Start the stack with `npm run docker:local:up`.
3. The API will be available at `http://localhost:3000` and PostgreSQL at `localhost:5432`.

The local Docker stack uses `docker-compose.local.yml`, starts PostgreSQL 17, overrides `DATABASE_URL` to the internal `db` service, and runs `npm run db:migrate` before the development server starts.
The same stack also runs the Docusaurus developer-doc app on `http://localhost:3001`.

## Production Docker

Deployment targets Oracle Cloud free tier behind Caddy with automatic HTTPS — see [docs/deploy/oracle-cloud.md](docs/deploy/oracle-cloud.md).

Local production stack (builds the image and runs `db` + `api` locally):

1. Copy `.env.example` to `.env`.
2. Start the stack with `npm run docker:prod:up`.
3. The API will be available at `http://localhost:${API_PORT:-3000}` and PostgreSQL at `localhost:${POSTGRES_PORT:-5432}`.

The production image is multi-stage: dependencies and TypeScript are compiled during `docker build`, and the runtime stage ships production dependencies only. Database migrations run on container start via the `drizzle-orm` runtime migrator (`scripts/db-migrate.mjs`), then `dist/index.js` starts. `npm run deploy` builds the image locally, ships it to the VM over SSH, and brings up `db`, `api`, and `caddy` with `docker-compose.prod.yml`.

## API Docs

The API documentation source lives in:

- `docs/openapi/openapi.yaml`
- `docs/openapi/paths/`
- `docs/openapi/components/`
- `docs/guides/`
- `docs/developer/`

OpenAPI is the source of truth for HTTP reference documentation. Developer onboarding, architecture, business rules, and module documentation now live in the Docusaurus app under `docs/developer`. Narrower integration guides still live under `docs/guides` and are mounted inside that Docusaurus site.
The interactive API reference is rendered with Scalar.

Useful commands:

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`
- `npm run check:biome`
- `npm run check:biome:fix`
- `npm run docs:lint`
- `npm run docs:build`
- `npm run docs:preview`
- `npm run docs:dev:install`
- `npm run docs:dev:start`
- `npm run docs:dev:build`
- `npm run docs:dev:serve`
- `npm run docker:prod:up`
- `npm run docker:prod:down`

`docs:preview` starts a small Fastify server with Scalar at `/reference`.
`docs:build` generates a static Scalar reference into `docs/reference/`.
`docs:dev:start` starts the Docusaurus developer-doc site on port `3001` by default.

Relevant guides:

- `docs/developer/docs/`
- `docs/guides/getting-started.md`
- `docs/guides/auth-access-matrix.md`
- `docs/guides/authentication.md`
- `docs/guides/alerts.md`
- `docs/guides/errors.md`
- `docs/guides/historical-data.md`
- `docs/guides/historical-exports.md`
- `docs/guides/idempotency.md`
- `docs/guides/observability.md`
- `docs/guides/rate-limits.md`
- `docs/guides/realtime.md`
- `docs/guides/webhooks.md`

When adding or changing endpoints:

1. update the relevant route and service code
2. update the matching OpenAPI path and component files
3. add or update API and integration coverage for the new behavior
4. update the Docusaurus developer docs if the change affects architecture, business rules, module responsibilities, or local workflow
5. update or add guides if the behavior affects client integration
6. run `npm run check:biome`, `npm run docs:lint`, `npm run test:api`, and the relevant integration tests

Realtime stream health scans use `REALTIME_STREAM_STALE_SECONDS` to decide when an
active SSE subscription is stale enough to create an operational alert.

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
- `npm run check:biome:fix`

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
- `npm run docs:dev:start`
- `npm run docs:dev:install`
- `npm run docs:dev:build`
- `npm run docs:dev:serve`
- `npm run docker:prod:up`
- `npm run docker:prod:down`
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
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/current`
- `DELETE /api/v1/auth/sessions/:sessionId`
- `GET /api/v1/compliance/me/capabilities`
- `GET /api/v1/funding/methods`
- `GET /api/v1/exchange/schedule`
- `GET /api/v1/exchange/status`
- `GET /api/v1/exchange/fees`
- `GET /api/v1/funding/deposits`
- `POST /api/v1/funding/deposits`
- `GET /api/v1/funding/withdrawals`
- `POST /api/v1/funding/withdrawals`
- `POST /api/v1/webhooks/funding/providers/:provider`
- `GET /api/v1/wallet/balance`
- `GET /api/v1/markets`
- `GET /api/v1/markets/:marketId`
- `GET /api/v1/markets/:marketId/stream`
- `GET /api/v1/markets/:marketId/order-book`
- `GET /api/v1/markets/:marketId/order-book/deltas`
- `GET /api/v1/markets/:marketId/trades`
- `GET /api/v1/historical/markets/:marketId/trades`
- `GET /api/v1/historical/markets/:marketId/candles`
- `GET /api/v1/markets/:marketId/announcements`
- `GET /api/v1/portfolio`
- `GET /api/v1/portfolio/stream`
- `GET /api/v1/portfolio/fills`
- `GET /api/v1/historical/portfolio/orders`
- `GET /api/v1/historical/portfolio/fills`
- `GET /api/v1/portfolio/settlements`
- `POST /api/v1/portfolio/exports`
- `GET /api/v1/portfolio/exports`
- `GET /api/v1/portfolio/exports/:exportJobId`
- `POST /api/v1/orders`
- `PATCH /api/v1/orders/:orderId`
- `DELETE /api/v1/orders/:orderId`
- `POST /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-keys`
- `GET /api/v1/auth/api-key/me`
- `GET /api/v1/auth/api-key/hmac/me`
- `DELETE /api/v1/auth/api-keys/:apiKeyId`
- `POST /api/v1/auth/api-keys/:apiKeyId/rotate`
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
- `POST /api/v1/internal/funding/webhook-delay-scan`
- `POST /api/v1/internal/exchange/schedule`
- `POST /api/v1/internal/exchange/fees`
- `GET /api/v1/internal/operations/reviews`
- `GET /api/v1/internal/operations/audit-events`
- `GET /api/v1/internal/operations/rate-limit-events`
- `GET /api/v1/internal/operations/alerts`
- `POST /api/v1/internal/operations/ledger-invariant-scan`
- `POST /api/v1/internal/operations/settlement-failure-scan`
- `POST /api/v1/internal/operations/settlement-retries/:marketId`
- `POST /api/v1/internal/operations/trading-condition-scan`
- `POST /api/v1/internal/operations/realtime-stream-health-scan`
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

Funding provider callbacks use:

- `x-webhook-timestamp`
- `x-webhook-signature`

and are verified with `FUNDING_PROVIDER_WEBHOOK_SECRET`.

The internal link route requires the `x-bootstrap-token` header matching `INTERNAL_BOOTSTRAP_TOKEN`.

The internal compliance routes use the same `x-bootstrap-token` header and let you upsert KYC/jurisdiction state or place an account under a compliance hold.
