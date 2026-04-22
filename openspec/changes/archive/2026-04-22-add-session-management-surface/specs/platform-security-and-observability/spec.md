## ADDED Requirements
### Requirement: Authenticated session management surface
The system MUST provide authenticated session-management endpoints so users can inspect and revoke bearer sessions.

#### Scenario: User lists active sessions
- **WHEN** an authenticated user requests their session list
- **THEN** the system returns session records owned by that user ordered from newest to oldest
- **AND** the currently presented session is identified in the response

#### Scenario: User revokes the current session
- **WHEN** an authenticated user revokes the current session
- **THEN** the system marks that session revoked
- **AND** the same bearer token is rejected on subsequent authenticated requests

#### Scenario: User revokes a specific session
- **WHEN** an authenticated user revokes another owned session by session id
- **THEN** the system marks that session revoked
- **AND** no other user's session can be revoked through that path
