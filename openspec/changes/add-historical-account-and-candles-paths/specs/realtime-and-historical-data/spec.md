## ADDED Requirements
### Requirement: Historical account order and fill paths
The system SHALL expose dedicated authenticated historical access paths for account order and fill history.

#### Scenario: User requests historical account orders
- **WHEN** an authenticated user requests the historical account orders path for a supported currency
- **THEN** the system returns the user's order history ordered from newest to oldest
- **AND** each record includes market and order state details needed for historical review

#### Scenario: User requests historical account fills
- **WHEN** an authenticated user requests the historical account fills path for a supported currency
- **THEN** the system returns the user's fill history through a dedicated historical route
- **AND** no other user's account history is exposed

### Requirement: Historical market candles path
The system SHALL expose a dedicated historical candle path for archived markets.

#### Scenario: Archived market candles are served through a historical path
- **WHEN** a client requests candles for an archived market
- **THEN** the system returns bucketed OHLCV candles derived from archived trades
- **AND** the response identifies the requested interval and archived market scope
