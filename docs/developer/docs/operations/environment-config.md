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
- webhook verification
- alert thresholds
- internal bootstrap token
- docs local development URLs

## Practical rule

If a value changes system behavior or operational thresholds, document it here
and in `.env.example`.
