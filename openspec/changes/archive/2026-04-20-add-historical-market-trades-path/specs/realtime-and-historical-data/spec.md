## MODIFIED Requirements

### Requirement: Separate historical access paths
The system SHALL expose historical data through dedicated historical access paths for archived markets, orders, fills, trades, charts, and account exports.

#### Scenario: Historical market trades are served through a dedicated path
- **WHEN** a client requests trades for an archived market such as a settled, voided, or cancelled market
- **THEN** the live market trades path rejects the request in favor of a historical path
- **AND** the dedicated historical trades path returns the archived trades for that market
