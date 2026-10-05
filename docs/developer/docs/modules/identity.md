---
title: Identity Module
---

# Identity Module

## Purpose

Owns registration, login, sessions, MFA, API keys, and request auth guards.

## Route surface

- public auth onboarding
- session management
- MFA flows
- API key lifecycle
- internal identity linking

## Social sign-in

Google and Apple use an OAuth authorization-code flow with PKCE, state, and
nonce validation. Configure each provider's credentials and registered
callback URI in the API environment (`GOOGLE_OAUTH_*` and `APPLE_OAUTH_*`),
and set `SOCIAL_AUTH_FRONTEND_CALLBACK_URL` to the frontend `/auth/callback`
route. Apple returns to the API with `form_post`.

Accounts are created only from provider-verified email addresses. A matching
existing email is never linked automatically; the user must sign in using the
original method. Existing TOTP MFA remains required after provider sign-in.

## Main collaborators

- session service
- registration/login services
- TOTP factor service
- API key authentication/lifecycle services
- auth guard module

## Key invariants

- bearer sessions are opaque
- idle expiry is enforced on active sessions
- MFA step-up is action-scoped
- internal linking must not create duplicate users
