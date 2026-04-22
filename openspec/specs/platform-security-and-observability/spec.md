## Purpose

Define the platform-level security, auditability, logging, metrics, and alerting controls that protect Hyperwood and make its critical workflows operable.

## Requirements

### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

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

#### Scenario: Idle session is rejected
- **WHEN** a bearer session exceeds the configured inactivity timeout
- **THEN** the system rejects further use of that session
- **AND** the session listing surface reflects inactivity expiry information

#### Scenario: Authenticated session activity refreshes last seen time
- **WHEN** a valid bearer session is used on an authenticated endpoint
- **THEN** the system refreshes the session activity timestamp according to policy

#### Scenario: Authenticated user rotates an API key secret
- **WHEN** an authenticated user requests rotation for an owned API key
- **THEN** the system preserves the key identity and scopes
- **AND** replaces the underlying secret material
- **AND** returns the new raw key exactly once

#### Scenario: Rotated API key invalidates previous secret material
- **WHEN** an API key secret has been rotated
- **THEN** the previous raw API key is rejected
- **AND** HMAC signatures produced with the previous secret are rejected

#### Scenario: Signed webhook is verified
- **WHEN** a provider callback is received on a signed webhook endpoint
- **THEN** the system verifies the signature before applying side effects
- **AND** invalid signatures are rejected and logged

#### Scenario: Signed funding webhook is verified
- **WHEN** a funding provider callback is received on the signed webhook endpoint
- **THEN** the system validates the timestamped HMAC signature before applying transfer side effects
- **AND** invalid signatures are rejected and logged with request correlation data

#### Scenario: Rate limit is exceeded
- **WHEN** a client exceeds a configured API or account rate limit
- **THEN** the system rejects excess requests according to policy
- **AND** the event is available for operational review

#### Scenario: Public auth route is rate limited by account scope
- **WHEN** a caller exceeds the configured threshold for a public auth route such as registration, login, or email verification
- **THEN** the system rejects the request with a rate-limit response
- **AND** the throttling window is tracked against the account-scoped identifier when available

#### Scenario: Rate-limit event is reviewed internally
- **WHEN** an internal operator queries persisted rate-limit exceed events
- **THEN** the system returns matching events with scope, route, window, and observed count details
- **AND** the results are ordered from newest to oldest

### Requirement: Structured observability
The system SHALL emit structured logs and metrics for critical financial, trading, funding, and realtime workflows using correlation identifiers.

#### Scenario: Critical flow is logged with references
- **WHEN** a critical flow such as order entry, transfer handling, or settlement execution occurs
- **THEN** the system emits logs and metrics containing relevant correlation identifiers such as request, user, market, order, provider, or ledger references

#### Scenario: Client receives a correlation identifier
- **WHEN** a client sends a request to the API
- **THEN** the system returns a request correlation identifier on the response
- **AND** the same identifier is attached to backend workflow logs generated from that request

### Requirement: Invariant and outage alerting
The system MUST alert operators on balance invariant failures, settlement failures, reconciliation drift, callback delays, websocket outages, and unusual trading conditions.

#### Scenario: Ledger invariant failure triggers alert
- **WHEN** monitoring detects a ledger or balance invariant failure
- **THEN** the system generates an operational alert with enough context for investigation

#### Scenario: Reconciliation drift creates an operational alert
- **WHEN** reconciliation records a critical discrepancy such as a missing internal transfer, a status mismatch, or a ledger invariant violation
- **THEN** the system creates a persisted operational alert linked to that source record
- **AND** operators can query the alert through an internal operations endpoint

#### Scenario: Funding callback delay triggers alert
- **WHEN** monitoring detects a provider-backed funding transfer that has exceeded the configured callback delay threshold without reaching a terminal state
- **THEN** the system creates a persisted operational alert linked to that transfer
- **AND** operators can query the alert through an internal operations endpoint

#### Scenario: Stale realtime stream triggers alert
- **WHEN** an internal operator runs a realtime stream health scan
- **AND** the scan detects a public or private realtime subscription whose last delivery exceeds the configured staleness threshold
- **THEN** the system creates a persisted critical operational alert for that subscription
- **AND** the scan response returns the stale stream details and the number of newly created alerts

### Requirement: Internal ledger invariant scans create alerts
The system MUST provide an internal scan path that detects ledger invariant failures and persists operational alerts for the offending source records.

#### Scenario: Ledger invariant failure triggers alert
- **WHEN** an internal operator runs a ledger invariant scan
- **AND** the scan detects an imbalanced ledger transaction or a negative user wallet balance
- **THEN** the system creates a persisted critical operational alert for each offending source
- **AND** the scan response returns the detected failures and the number of newly created alerts

### Requirement: Settlement failure scans create alerts
The system MUST provide an internal scan path that detects resolved markets stalled before settlement and persists operational alerts for the affected market records.

#### Scenario: Settlement failure triggers alert
- **WHEN** an internal operator runs a settlement failure scan
- **AND** the scan detects a resolved market that has exceeded the configured settlement failure threshold without a settlement record
- **THEN** the system creates a persisted critical operational alert for that market
- **AND** the scan response returns the detected failures and the number of newly created alerts

### Requirement: Unusual trading condition scans create alerts
The system MUST provide an internal scan path that detects abnormal trading conditions and persists operational alerts for the affected market records.

#### Scenario: Crossed resting book triggers alert
- **WHEN** an internal operator runs a trading-condition scan
- **AND** the scan detects an active market with a crossed resting book where the best bid is greater than or equal to the best ask for the same outcome
- **THEN** the system creates a persisted critical operational alert for that market
- **AND** the scan response returns the detected failures and the number of newly created alerts
