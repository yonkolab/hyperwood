## Purpose

Define the platform-level security, auditability, logging, metrics, and alerting controls that protect Hyperwood and make its critical workflows operable.

## Requirements

### Requirement: API and credential security controls
The system MUST support MFA, strong session management, scoped secrets, secret rotation, signed provider webhooks, and rate limiting for external access paths.

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
