## MODIFIED Requirements

### Requirement: Price-time priority matching
The matching engine SHALL maintain a central limit order book and match resting and incoming orders according to price-time priority.

#### Scenario: Best-priced order matches first
- **WHEN** an incoming order can trade against multiple resting orders on the opposite side
- **THEN** the system matches the best-priced eligible liquidity first
- **AND** time priority breaks ties within the same price level

#### Scenario: Partial fill leaves residual quantity
- **WHEN** an order is only partially satisfied by available liquidity
- **THEN** the system emits trade and fill events for the executed quantity
- **AND** the remaining quantity keeps the correct resting or terminal state

#### Scenario: Internal match run executes crossable limit liquidity
- **WHEN** an internal matching run is triggered for a market
- **THEN** the system evaluates queued and partially-filled limit orders in authoritative price-time order
- **AND** it records durable trade outputs plus updated order states for each resulting fill
