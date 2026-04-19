## MODIFIED Requirements

### Requirement: Order validation and idempotency
The system MUST validate sufficient available funds, order bounds, outcome validity, market tradability, and self-trade prevention configuration before accepting order intents.

#### Scenario: Order inherits market currency
- **WHEN** an authenticated user submits an order for a market
- **THEN** the order currency is derived from the market's declared trading currency
- **AND** the platform validates balances and collateral in that same currency

#### Scenario: Cross-currency execution is rejected
- **WHEN** an order or matching flow would require execution across different currencies
- **THEN** the system rejects the action
- **AND** the platform does not perform implicit FX conversion inside trading workflows
