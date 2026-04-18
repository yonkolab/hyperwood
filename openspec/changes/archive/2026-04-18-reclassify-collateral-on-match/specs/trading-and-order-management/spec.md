## MODIFIED Requirements

### Requirement: Order lifecycle management
The system SHALL support cancellation, decrease, and amendment workflows with user-visible order status updates.

#### Scenario: Partially-filled order cancels remaining quantity
- **WHEN** a user cancels an order that is partially filled but still has remaining resting quantity
- **THEN** the system cancels only the remaining quantity
- **AND** it releases the order's current remaining reserve amount back to available cash
- **AND** already matched collateral remains locked for the open position
