# Authentication

Hyperwood currently supports three practical authentication modes for HTTP APIs plus one internal bootstrap mode.

## 1. Bearer session tokens

User-facing authenticated endpoints use opaque bearer session tokens returned by:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/mfa/totp/verify`

Send them as:

```http
Authorization: Bearer <sessionToken>
```

Used by:

- `/api/v1/auth/me`
- `/api/v1/auth/sessions`
- `/api/v1/compliance/me/capabilities`
- `/api/v1/funding/*`
- `/api/v1/orders`
- `/api/v1/portfolio*`

Session management endpoints:

- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/current`
- `DELETE /api/v1/auth/sessions/{sessionId}`

Session hardening behavior:

- sessions have an absolute expiry from `SESSION_TTL_HOURS`
- sessions also have an inactivity expiry from `SESSION_IDLE_TTL_HOURS`
- authenticated requests refresh `lastSeenAt`
- `GET /api/v1/auth/sessions` returns `idleExpiresAt` so clients can reason about inactivity expiry

## 2. MFA step-up authorization

Some sensitive actions require a short-lived step-up token when the user has active MFA configured.

Request it with:

- `POST /api/v1/auth/mfa/totp/authorize`

Send it as:

```http
x-mfa-authorization: <authorizationToken>
```

Currently relevant for API key creation and revocation.

## 3. Raw API keys

API keys are created with `POST /api/v1/auth/api-keys`.
API keys are rotated with `POST /api/v1/auth/api-keys/{apiKeyId}/rotate`.

The current reference endpoint for raw API key authentication is:

- `GET /api/v1/auth/api-key/me`

Preferred header:

```http
x-api-key: <rawApiKey>
```

The implementation also accepts the raw API key as a bearer token when the value starts with `hw_`, but `x-api-key` is the clearer documented choice.

## 4. HMAC-signed API key requests

For signed requests use:

- `GET /api/v1/auth/api-key/hmac/me`

Required headers:

```http
x-api-key: <keyPrefix>
x-api-timestamp: <unix-seconds>
x-api-nonce: <unique-nonce>
x-api-signature: <hex-hmac-sha256>
```

The signature payload is:

```text
METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE
```

Important constraints from the current implementation:

- the timestamp must be within `API_HMAC_MAX_SKEW_SECONDS`
- the nonce is persisted and cannot be reused
- the key must support HMAC signing, older legacy keys do not
- rotating a key immediately invalidates the previous raw key and HMAC secret

## 5. Internal bootstrap token

Private administrative endpoints use:

```http
x-bootstrap-token: <INTERNAL_BOOTSTRAP_TOKEN>
```

Used by:

- internal auth linking
- internal compliance writes
- internal funding writes
- internal market bootstrap and matching
- internal operations review queue

## Current limitations

- There is no OAuth flow today.
- There is no token introspection endpoint.
- There are no role-based admin tokens beyond the shared bootstrap token.
