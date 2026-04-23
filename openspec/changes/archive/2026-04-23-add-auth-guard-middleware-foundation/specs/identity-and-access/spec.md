## MODIFIED Requirements

### Requirement: Strong authenticated access
The system MUST provide session-based authentication for interactive clients, support MFA for sensitive account access, record and restrict suspicious login activity according to policy, and resolve protected route auth through shared guard middleware instead of per-route token parsing.

#### Scenario: Session guard resolves authenticated user context
- **WHEN** a session-protected route executes
- **THEN** shared guard middleware validates the bearer token once
- **AND** attaches the resolved user context to the request before the handler runs

#### Scenario: Internal guard resolves current internal auth model
- **WHEN** an internal route executes
- **THEN** shared guard middleware validates the bootstrap token once
- **AND** attaches internal auth context to the request before the handler runs

#### Scenario: MFA step-up token is standardized on the request
- **WHEN** a session-protected route requires a step-up action token
- **THEN** shared guard middleware captures the optional MFA authorization header
- **AND** exposes the action context on the request without changing downstream domain rules
