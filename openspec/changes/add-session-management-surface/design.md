## Design

Hyperwood already stores bearer sessions in `user_sessions`. This slice adds
management endpoints on top of that table without changing token format or login
behavior.

### Endpoints

- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/current`
- `DELETE /api/v1/auth/sessions/{sessionId}`

### Semantics

- listing returns the authenticated user's persisted sessions ordered newest first
- the current session is identified by comparing the presented bearer token hash
- revocation is modeled through `revokedAt`
- revoking the current session invalidates that bearer token immediately

### Non-goals

- refresh tokens
- sliding rotation
- device trust
- external identity-provider sessions
