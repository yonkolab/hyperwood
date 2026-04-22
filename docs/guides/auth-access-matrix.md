# Auth Access Matrix

This guide classifies every current HTTP endpoint by the auth shape it expects.

Current access classes:

- `public`
- `user_session`
- `user_api_key_raw`
- `user_api_key_hmac`
- `internal_bootstrap`
- `mixed_or_step_up`

One current exception exists outside those user/operator classes:

- `provider_webhook_signed`
  Funding provider callbacks are authenticated by timestamped HMAC signatures,
  not by user sessions or the internal bootstrap token.

Internal routes are currently protected by the shared bootstrap token. They are
not yet backed by per-operator identities or role-based permissions.

## Identity

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | `public` | User onboarding |
| `POST` | `/api/v1/auth/login` | `public` | Returns session or MFA challenge |
| `POST` | `/api/v1/auth/request-email-verification` | `public` | Verification challenge resend |
| `POST` | `/api/v1/auth/verify-email` | `public` | Email verification |
| `POST` | `/api/v1/auth/mfa/totp/verify` | `public` | Completes TOTP login challenge |
| `POST` | `/api/v1/auth/mfa/totp/authorize` | `user_session` | Issues short-lived MFA action token |
| `GET` | `/api/v1/auth/me` | `user_session` | Session-authenticated user profile |
| `GET` | `/api/v1/auth/sessions` | `user_session` | Session management |
| `DELETE` | `/api/v1/auth/sessions/current` | `user_session` | Current-session logout |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | `user_session` | Revoke owned session |
| `POST` | `/api/v1/auth/api-keys` | `mixed_or_step_up` | Session auth plus MFA action token when MFA is enabled |
| `GET` | `/api/v1/auth/api-keys` | `user_session` | List owned API keys |
| `GET` | `/api/v1/auth/api-key/me` | `user_api_key_raw` | Raw API key auth |
| `GET` | `/api/v1/auth/api-key/hmac/me` | `user_api_key_hmac` | HMAC API key auth |
| `DELETE` | `/api/v1/auth/api-keys/:apiKeyId` | `mixed_or_step_up` | Session auth plus MFA action token when MFA is enabled |
| `POST` | `/api/v1/auth/api-keys/:apiKeyId/rotate` | `mixed_or_step_up` | Session auth plus MFA action token when MFA is enabled |
| `POST` | `/api/v1/auth/mfa/totp/setup` | `user_session` | Starts TOTP enrollment |
| `POST` | `/api/v1/auth/mfa/totp/confirm` | `user_session` | Finalizes TOTP enrollment |
| `POST` | `/api/v1/internal/auth/link-existing-user` | `internal_bootstrap` | Current internal-only identity linking |

## Compliance

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/compliance/me/capabilities` | `user_session` | User capability evaluation |
| `POST` | `/api/v1/internal/compliance/users/:userId/profile` | `internal_bootstrap` | Internal compliance profile upsert |
| `POST` | `/api/v1/internal/compliance/users/:userId/restrictions` | `internal_bootstrap` | Internal restriction write path |

## Funding

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/funding/methods` | `user_session` | Eligible funding methods |
| `GET` | `/api/v1/wallet/balance` | `user_session` | Wallet balance |
| `GET` | `/api/v1/funding/deposits` | `user_session` | Deposit history |
| `POST` | `/api/v1/funding/deposits` | `user_session` | Create deposit |
| `GET` | `/api/v1/funding/withdrawals` | `user_session` | Withdrawal history |
| `POST` | `/api/v1/funding/withdrawals` | `user_session` | Create withdrawal |
| `POST` | `/api/v1/funding/methods` | `user_session` | Add user funding method |
| `POST` | `/api/v1/internal/funding/users/:userId/methods` | `internal_bootstrap` | Internal method linking |
| `POST` | `/api/v1/internal/funding/users/:userId/wallet/seed` | `internal_bootstrap` | Internal seed helper |
| `POST` | `/api/v1/internal/funding/deposits/:depositId/settle` | `internal_bootstrap` | Internal settlement |
| `POST` | `/api/v1/internal/funding/withdrawals/:withdrawalId/approve` | `internal_bootstrap` | Internal approval |
| `POST` | `/api/v1/internal/funding/withdrawals/:withdrawalId/fail` | `internal_bootstrap` | Internal failure |
| `POST` | `/api/v1/internal/funding/withdrawals/:withdrawalId/settle` | `internal_bootstrap` | Internal settlement |
| `POST` | `/api/v1/internal/funding/reconciliation/runs` | `internal_bootstrap` | Internal reconciliation run |
| `GET` | `/api/v1/internal/funding/reconciliation/discrepancies` | `internal_bootstrap` | Internal discrepancy review |
| `POST` | `/api/v1/internal/funding/webhook-delay-scan` | `internal_bootstrap` | Internal delay scan |
| `POST` | `/api/v1/webhooks/funding/providers/:provider` | `provider_webhook_signed` | Provider callback HMAC verification |

## Orders

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/orders` | `user_session` | Create order |
| `DELETE` | `/api/v1/orders/:orderId` | `user_session` | Cancel order |
| `PATCH` | `/api/v1/orders/:orderId` | `user_session` | Amend order |

## Portfolio

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/portfolio` | `user_session` | Portfolio summary |
| `GET` | `/api/v1/portfolio/stream` | `user_session` | Private SSE account stream |
| `GET` | `/api/v1/portfolio/fills` | `user_session` | Current fills |
| `GET` | `/api/v1/historical/portfolio/orders` | `user_session` | Historical orders |
| `GET` | `/api/v1/historical/portfolio/fills` | `user_session` | Historical fills |
| `GET` | `/api/v1/portfolio/settlements` | `user_session` | Settlement history |
| `POST` | `/api/v1/portfolio/exports` | `user_session` | Export request |
| `GET` | `/api/v1/portfolio/exports` | `user_session` | Export job listing |
| `GET` | `/api/v1/portfolio/exports/:exportJobId` | `user_session` | Export job detail |

## Markets

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/markets` | `public` | Market catalog |
| `GET` | `/api/v1/markets/:marketId` | `public` | Market detail |
| `GET` | `/api/v1/markets/:marketId/stream` | `public` | Public SSE market stream |
| `GET` | `/api/v1/markets/:marketId/order-book` | `public` | Order book snapshot |
| `GET` | `/api/v1/markets/:marketId/order-book/deltas` | `public` | Order book delta recovery |
| `GET` | `/api/v1/markets/:marketId/trades` | `public` | Recent trades |
| `GET` | `/api/v1/historical/markets/:marketId/trades` | `public` | Historical trades |
| `GET` | `/api/v1/historical/markets/:marketId/candles` | `public` | Historical candles |
| `GET` | `/api/v1/markets/:marketId/announcements` | `public` | Published announcements |
| `POST` | `/api/v1/internal/markets/events` | `internal_bootstrap` | Create event |
| `POST` | `/api/v1/internal/markets` | `internal_bootstrap` | Create market |
| `POST` | `/api/v1/internal/markets/:marketId/match` | `internal_bootstrap` | Internal matching trigger |
| `POST` | `/api/v1/internal/markets/:marketId/announcements` | `internal_bootstrap` | Publish market announcement |
| `POST` | `/api/v1/internal/markets/:marketId/status` | `internal_bootstrap` | Update market status |
| `POST` | `/api/v1/internal/markets/:marketId/resolve` | `internal_bootstrap` | Resolve market |
| `POST` | `/api/v1/internal/markets/:marketId/settle` | `internal_bootstrap` | Settle market |

## Exchange

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/exchange/schedule` | `public` | Active schedule |
| `GET` | `/api/v1/exchange/status` | `public` | Derived exchange status |
| `GET` | `/api/v1/exchange/fees` | `public` | Active fee schedules |
| `POST` | `/api/v1/internal/exchange/schedule` | `internal_bootstrap` | Publish schedule |
| `POST` | `/api/v1/internal/exchange/fees` | `internal_bootstrap` | Publish fees |

## Operations

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/internal/operations/reviews` | `internal_bootstrap` | Review queue |
| `GET` | `/api/v1/internal/operations/audit-events` | `internal_bootstrap` | Audit feed |
| `GET` | `/api/v1/internal/operations/rate-limit-events` | `internal_bootstrap` | Rate-limit review feed |
| `GET` | `/api/v1/internal/operations/alerts` | `internal_bootstrap` | Alert feed |
| `POST` | `/api/v1/internal/operations/ledger-invariant-scan` | `internal_bootstrap` | Ledger scan |
| `POST` | `/api/v1/internal/operations/settlement-failure-scan` | `internal_bootstrap` | Settlement scan |
| `POST` | `/api/v1/internal/operations/settlement-retries/:marketId` | `internal_bootstrap` | Settlement retry |
| `POST` | `/api/v1/internal/operations/trading-condition-scan` | `internal_bootstrap` | Trading condition scan |
| `POST` | `/api/v1/internal/operations/realtime-stream-health-scan` | `internal_bootstrap` | SSE health scan |

## Health

| Method | Path | Access class | Notes |
| --- | --- | --- | --- |
| `GET` | `/health` | `public` | Process health |
