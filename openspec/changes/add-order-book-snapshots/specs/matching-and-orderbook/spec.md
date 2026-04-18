## ADDED Requirements

### Requirement: Public order book snapshot API
The system SHALL expose a public order book snapshot for each market using current resting limit orders grouped into price-level depth.

#### Scenario: Market order book snapshot is requested
- **WHEN** a client requests the order book snapshot for a market
- **THEN** the system returns grouped YES and NO bid and ask depth, best bid and ask values, and snapshot metadata

#### Scenario: Unknown market order book is requested
- **WHEN** a client requests the order book snapshot for a market that does not exist
- **THEN** the system rejects the request with a not-found error
