## Purpose

Define Hyperwood's user-facing trading behavior for binary contract orders, including accepted order types, validations, idempotency, and lifecycle actions.
## Requirements
### Requirement: Order types and sides
The system SHALL support YES and NO contract trading with limit and market orders on both buy and sell sides for tradable binary markets.

#### Scenario: Limit order is accepted
- **WHEN** an authenticated eligible user submits a valid limit order for an active market
- **THEN** the system accepts the order intent
- **AND** the order enters downstream matching or resting-order processing with collateral reserved for its maximum loss

#### Scenario: Market order is constrained by protections
- **WHEN** a user submits a market order
- **THEN** the system applies configured quantity, exposure, and market-status protections before acceptance
- **AND** the order is recorded for downstream matching only when those protections pass

### Requirement: Order validation and idempotency
The system MUST validate sufficient available funds, order bounds, outcome validity, market tradability, and self-trade prevention configuration before accepting order intents.

#### Scenario: Duplicate order create is idempotent
- **WHEN** a client repeats an order creation request with the same idempotency key and materially identical payload
- **THEN** the system returns the original result instead of creating a second order
- **AND** the system does not create a second reservation in the ledger

#### Scenario: Invalid order is rejected
- **WHEN** an order request violates balance, quantity, price, market-status, or trading-eligibility requirements
- **THEN** the system rejects the request
- **AND** no executable order is created

### Requirement: Order lifecycle management
The system SHALL support cancellation, decrease, and amendment workflows with user-visible order status updates.

#### Scenario: Partially-filled order cancels remaining quantity
- **WHEN** a user cancels an order that is partially filled but still has remaining resting quantity
- **THEN** the system cancels only the remaining quantity
- **AND** it releases the order's current remaining reserve amount back to available cash
- **AND** already matched collateral remains locked for the open position

