## MODIFIED Requirements
### Requirement: Access path hardening
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

#### Scenario: Authenticated user rotates an API key secret
- **WHEN** an authenticated user requests rotation for an owned API key
- **THEN** the system preserves the key identity and scopes
- **AND** replaces the underlying secret material
- **AND** returns the new raw key exactly once

#### Scenario: Rotated API key invalidates previous secret material
- **WHEN** an API key secret has been rotated
- **THEN** the previous raw API key is rejected
- **AND** HMAC signatures produced with the previous secret are rejected
