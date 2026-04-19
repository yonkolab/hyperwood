## MODIFIED Requirements

### Requirement: Structured observability
The system SHALL emit structured logs and metrics for critical financial, trading, funding, and realtime workflows using correlation identifiers.

#### Scenario: Critical flow is logged with references
- **WHEN** a critical flow such as order entry, transfer handling, matching, or settlement execution occurs
- **THEN** the system emits structured logs containing relevant correlation identifiers such as request, user, market, order, provider, or ledger references

#### Scenario: Client receives a correlation identifier
- **WHEN** a client sends a request to the API
- **THEN** the system returns a request correlation identifier on the response
- **AND** the same identifier is attached to backend workflow logs generated from that request
