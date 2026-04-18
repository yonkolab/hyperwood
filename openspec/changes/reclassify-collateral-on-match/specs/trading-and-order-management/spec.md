## MODIFIED Requirements

### Requirement: Order cancellation
The system SHALL allow users to cancel eligible resting orders and receive a stable outcome for repeated cancellation requests.

#### Scenario: Partially-filled order cancels remaining quantity
- **WHEN** a user cancels an order that is partially filled but still has remaining resting quantity
- **THEN** the system cancels only the remaining quantity
- **AND** it releases the order's current remaining reserve amount back to available cash
- **AND** already matched collateral remains locked for the open position
