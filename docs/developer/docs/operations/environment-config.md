---
title: Environment Config
---

# Environment Config

Core runtime configuration lives in `src/config/env.ts`.

## Important groups

- HTTP and CORS
- database connection
- session and MFA policy
- rate limits
- transactional email delivery
- webhook verification
- alert thresholds
- primary and supported market currencies
- internal bootstrap token
- docs local development URLs

## Practical rule

If a value changes system behavior or operational thresholds, document it here
and in `.env.example`.

## Currency configuration

- `PRIMARY_MARKET_CURRENCY`
  Used as the runtime default when a request omits `currency`.
- `SUPPORTED_MARKET_CURRENCIES`
  Comma-separated list of accepted currency codes such as `BRL,USD,EUR`.

The app validates that the primary currency is included in the supported list at startup.

## Transactional email delivery

- `EMAIL_DELIVERY_PROVIDER`
  Selects `development_override` or `mailersend`.
- `EMAIL_FROM_NAME`
  Sender display name for transactional mail.
- `MAILERSEND_API_TOKEN`
  API token used when `EMAIL_DELIVERY_PROVIDER=mailersend`.
- `MAILERSEND_DOMAIN`
  Verified MailerSend sending domain.
- `MAILERSEND_FROM_EMAIL`
  Sender email used for transactional delivery. It must use the configured MailerSend domain.
