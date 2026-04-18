## MODIFIED Requirements

### Requirement: Order validation and idempotency
The system MUST validate sufficient available funds, order bounds, outcome validity, market tradability, and self-trade prevention configuration before accepting order intents.

#### Scenario: Order inherits market currency
- **WHEN** an authenticated user submits an order for a market
- **THEN** the accepted order records the market's declared trading currency
- **AND** collateral checks and ledger postings use that same currency
