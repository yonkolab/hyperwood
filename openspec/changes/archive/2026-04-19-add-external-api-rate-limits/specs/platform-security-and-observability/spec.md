## MODIFIED Requirements

### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

#### Scenario: Public auth route is rate limited by account scope
- **WHEN** a caller exceeds the configured threshold for a public auth route such as registration, login, or email verification
- **THEN** the system rejects the request with a rate-limit response
- **AND** the throttling window is tracked against the account-scoped identifier when available

#### Scenario: Rate-limit event is reviewed internally
- **WHEN** an internal operator queries persisted rate-limit exceed events
- **THEN** the system returns matching events with scope, route, window, and observed count details
- **AND** the results are ordered from newest to oldest
