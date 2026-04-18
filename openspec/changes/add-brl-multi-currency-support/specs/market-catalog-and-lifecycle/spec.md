## MODIFIED Requirements

### Requirement: Rich market detail metadata
The system MUST expose market detail fields required for informed trading, including pricing, summary data, resolution rules, sources, timelines, and related markets.

#### Scenario: Market detail is requested
- **WHEN** a client fetches a market detail resource
- **THEN** the system returns the current YES and NO prices, resolution criteria, source references, time properties, and status timeline
- **AND** the market response includes the market's quote and settlement currency

#### Scenario: Market currency constrains trading
- **WHEN** a market is created or activated
- **THEN** the market declares a single authoritative trading currency
- **AND** all orders, fills, collateral, and settlement flows for that market inherit that currency
