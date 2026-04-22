---
title: Auth and Access Model
---

# Auth and Access Model

Current access shapes:

- public
- user session
- raw API key
- HMAC API key
- internal bootstrap
- MFA step-up for sensitive actions

Use the detailed [auth access matrix](/guides/auth-access-matrix).

## Current internal model

Internal routes are still protected by a shared bootstrap token.

That means the platform already separates user and operator surfaces, but it
does not yet have full per-operator RBAC enforcement.

## Current guard foundation

Shared route guards now resolve:

- session auth
- internal bootstrap auth
- step-up token capture

This reduces per-route token parsing and prepares the route layer for future
operator identities and permissions.
