## ADDED Requirements

### Requirement: Internal operator authorization foundation
The system MUST define a phased authorization model for internal operator access so that bootstrap-token-only protection can be replaced with per-operator identities and route-family permissions without breaking existing internal workflows during migration.

#### Scenario: Bootstrap compatibility remains available during migration
- **WHEN** the platform begins migrating internal routes to operator auth
- **THEN** the current bootstrap-token model remains compatible during the transition phase
- **AND** the shared internal guard abstraction hides whether the caller is bootstrap-authenticated or operator-authenticated

#### Scenario: Internal route family maps to operator permission
- **WHEN** the platform introduces first-class operator identities
- **THEN** each internal route family has an explicit permission mapping
- **AND** permission checks are evaluated before the internal handler executes
