## Context

The current identity foundation supports password login, session tokens, MFA TOTP, and API key creation. What is missing is the ability for API clients to authenticate with those keys on actual routes.

## Goals / Non-Goals

**Goals:**
- Authenticate API clients using previously issued API keys.
- Enforce revocation, account state, and scope checks consistently.
- Keep the first implementation small and reusable inside the existing Fastify identity module.
- Support an HMAC-signed request mode for non-interactive clients.

**Non-Goals:**
- Full rate limiting and abuse detection for API clients.
- Trading endpoints.
- API key rotation workflows beyond create/list/revoke.

## Decisions

### Decision: Support both raw bearer-style API keys and HMAC signing

The implementation supports two authentication modes:
- raw API key via `x-api-key` or `Authorization: Bearer <api-key>`
- HMAC signing via key prefix, timestamp, and signature headers

This preserves a simple introspection path while also enabling safer non-interactive clients that do not want to send the full API key on every request.

Alternatives considered:
- Raw API keys only: rejected because the user explicitly requested HMAC signing for API clients.

### Decision: Expose a protected introspection route first

Instead of adding API key auth deep inside future trading endpoints, the first slice adds authenticated introspection routes so both auth paths can be tested independently.

Alternatives considered:
- Wait for trading endpoints: rejected because it would postpone validation of the auth model.

### Decision: Store an encrypted API key secret for HMAC verification

Hashing remains necessary for raw API key lookup, but HMAC verification requires access to a secret that can reproduce the request signature. New API keys therefore store both a lookup hash and an encrypted secret for signing.

Alternatives considered:
- Store only hashes: rejected because HMAC verification would be impossible.

### Decision: Require a nonce on HMAC-signed requests

The first HMAC implementation now requires a caller-provided nonce and persists a per-key nonce hash inside a short validity window. This blocks straight replay within the accepted timestamp skew window.

Alternatives considered:
- Timestamp-only HMAC: rejected because replay inside the skew window would remain trivial.

## Risks / Trade-offs

- Raw API keys are bearer credentials -> Scope checks and revocation must be strict.
- `lastUsedAt` updates on every request add write load -> acceptable for the current scale and useful for auditability.
- Nonce persistence adds a write on every HMAC-authenticated request -> acceptable for the current scale and worth the replay protection.
- Legacy API keys created before encrypted-secret storage cannot participate in HMAC signing -> clients may need key rotation to adopt the HMAC flow.
