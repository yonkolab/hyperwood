## Design

This change keeps the existing opaque bearer session model and adds inactivity enforcement.

### Policy

- `SESSION_TTL_HOURS` remains the absolute upper bound
- `SESSION_IDLE_TTL_HOURS` adds an inactivity window based on `lastSeenAt`
- authenticated session validation refreshes `lastSeenAt` when enough time has passed to avoid a write on every request

### Response shape

`GET /api/v1/auth/sessions` now includes:

- `expiresAt`
- `idleExpiresAt`

This allows clients to surface both absolute and inactivity-based expiry to the user.
