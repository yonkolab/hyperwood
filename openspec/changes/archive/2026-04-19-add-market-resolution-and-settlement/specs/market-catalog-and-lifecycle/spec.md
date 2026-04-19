## ADDED Requirements

### Requirement: Market detail includes resolution and settlement state

The system MUST expose market-level resolution and settlement metadata in market detail responses once those events exist.

#### Scenario: Consumer requests a resolved market

- **WHEN** a client requests market detail for a market that has been resolved or settled
- **THEN** the system returns the recorded resolution outcome, evidence summary, and settlement timestamp alongside the existing market lifecycle fields
