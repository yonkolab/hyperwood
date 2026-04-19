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

#### Scenario: Order inherits market currency
- **WHEN** an authenticated user submits an order for a market
- **THEN** the accepted order records the market's declared trading currency
- **AND** collateral checks and ledger postings use that same currency

### Requirement: Order lifecycle management
The system SHALL support cancellation, decrease, and amendment workflows with user-visible order status updates.

#### Scenario: Resting limit order is amended
- **WHEN** a user amends a resting limit order with a new lower quantity, a new limit price, or both
- **THEN** the system updates the resting order fields without affecting already-filled quantity
- **AND** collateral is released or additionally reserved to match the amended remaining exposure

#### Scenario: Partially-filled order decreases remaining quantity
- **WHEN** a user decreases the total quantity of a partially-filled resting limit order
- **THEN** the system preserves the already-filled quantity
- **AND** only the remaining resting quantity is reduced

#### Scenario: Partially-filled order cancels remaining quantity
- **WHEN** a user cancels an order that is partially filled but still has remaining resting quantity
- **THEN** the system cancels only the remaining quantity
- **AND** it releases the order's current remaining reserve amount back to available cash
- **AND** already matched collateral remains locked for the open position
