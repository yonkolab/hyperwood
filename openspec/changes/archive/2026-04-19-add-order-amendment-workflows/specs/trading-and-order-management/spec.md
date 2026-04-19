## MODIFIED Requirements

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
