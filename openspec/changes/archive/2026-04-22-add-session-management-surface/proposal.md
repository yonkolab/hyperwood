## Why

Hyperwood issues opaque bearer sessions, but users currently cannot inspect or
revoke them after login. Stronger session management requires a concrete surface
for session visibility and revocation.

## What Changes

- add authenticated session listing
- add current-session logout
- add targeted session revocation by session id
- document the session-management surface in OpenAPI and guides
- add API coverage for listing and revoking sessions

## Impact

- improves account recovery from leaked or stale bearer tokens
- hardens the existing opaque-session model without replacing it
