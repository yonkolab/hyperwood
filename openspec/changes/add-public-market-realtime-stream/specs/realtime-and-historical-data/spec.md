## ADDED Requirements

### Requirement: Public market SSE stream
The system SHALL provide a public streaming channel for one market scope using a documented realtime transport and recovery contract.

#### Scenario: Client subscribes to a market SSE stream
- **WHEN** a client connects to the public market stream for an existing market
- **THEN** the system returns an initial snapshot containing market summary, current order book state, and recent trades
- **AND** the stream remains open for subsequent public market events

#### Scenario: Market stream emits public updates
- **WHEN** market activity changes public state for the subscribed market
- **THEN** the stream emits typed events for order book changes, trades, status changes, or announcements
- **AND** the event payload contains the market identifier and enough state to update the client view without ambiguity
