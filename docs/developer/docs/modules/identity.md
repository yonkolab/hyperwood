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
