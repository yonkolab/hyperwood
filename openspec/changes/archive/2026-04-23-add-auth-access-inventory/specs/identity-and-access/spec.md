## MODIFIED Requirements

### Requirement: Strong authenticated access
The system MUST provide session-based authentication for interactive clients, support MFA for sensitive account access, record and restrict suspicious login activity according to policy, and maintain a documented inventory of route access classes for public, user, API-key, and internal surfaces.

#### Scenario: Route access inventory is published
- **WHEN** contributors review the authenticated API surface
- **THEN** the system provides a route inventory grouped by module
- **AND** each route is classified into its current access class

#### Scenario: Internal route model is documented
- **WHEN** contributors review internal operator routes
- **THEN** the inventory states that current internal access is protected by the bootstrap token
- **AND** the inventory distinguishes that current model from future per-operator RBAC
