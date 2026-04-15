## Purpose

Define Hyperwood's user-facing trading behavior for binary contract orders, including accepted order types, validations, idempotency, and lifecycle actions.

## Requirements

### Requirement: Order types and sides
The system SHALL support YES and NO contract trading with limit and market orders on both buy and sell sides for tradable binary markets.

#### Scenario: Limit order is accepted
- **WHEN** an authenticated eligible user submits a valid limit order for an active market
- **THEN** the system accepts the order intent
- **AND** the order enters matching or resting order processing according to available liquidity

#### Scenario: Market order is constrained by protections
- **WHEN** a user submits a market order
- **THEN** the system applies configured quantity, exposure, and market-status protections before execution

### Requirement: Order validation and idempotency
The system MUST validate sufficient available funds, order bounds, outcome validity, market tradability, and self-trade prevention configuration before accepting order intents.

#### Scenario: Duplicate order create is idempotent
- **WHEN** a client repeats an order creation request with the same idempotency key and materially identical payload
- **THEN** the system returns the original result instead of creating a second order

#### Scenario: Invalid order is rejected
- **WHEN** an order request violates balance, quantity, price, or market-status requirements
- **THEN** the system rejects the request
- **AND** no executable order is created

### Requirement: Order lifecycle management
The system SHALL support cancellation, decrease, and amendment workflows with user-visible order status updates.

#### Scenario: Resting order is canceled
- **WHEN** a user cancels an eligible resting order
- **THEN** the system changes the order state to reflect cancellation
- **AND** any releasable reserved funds are returned through the reservation workflow

#### Scenario: Order amendment is processed
- **WHEN** a client submits a valid amend or decrease request for an eligible order
- **THEN** the system records the updated order state
- **AND** the change preserves deterministic sequencing in the target market
