## MODIFIED Requirements

### Requirement: Order lifecycle management
The system SHALL support cancellation, decrease, and amendment workflows with user-visible order status updates.

#### Scenario: Resting order is canceled
- **WHEN** a user cancels an eligible resting order
- **THEN** the system changes the order state to `cancelled`
- **AND** any releasable reserved funds are returned through the reservation workflow

#### Scenario: Repeated cancellation retry is stable
- **WHEN** a user retries cancellation for an order that has already been cancelled successfully
- **THEN** the system returns the current cancelled order state
- **AND** the system does not create a second reservation-release transaction

#### Scenario: Order amendment is processed
- **WHEN** a client submits a valid amend or decrease request for an eligible order
- **THEN** the system records the updated order state
- **AND** the change preserves deterministic sequencing in the target market
