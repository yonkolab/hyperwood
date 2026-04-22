## ADDED Requirements

### Requirement: Authenticated account SSE stream
The system SHALL provide an authenticated SSE stream for one user and currency scope.

#### Scenario: Client subscribes to an authenticated account stream
- **WHEN** an authenticated client connects to the private account stream for a supported currency
- **THEN** the system returns an initial account snapshot containing portfolio summary, recent fills, and recent settlements for that user and currency
- **AND** the stream remains open for subsequent account events

#### Scenario: Account stream emits private user updates
- **WHEN** an authenticated user's orders, balances, transfers, fills, or settlements change
- **THEN** the account stream emits typed events scoped to that user and currency
- **AND** no other user's account updates are exposed through that stream
