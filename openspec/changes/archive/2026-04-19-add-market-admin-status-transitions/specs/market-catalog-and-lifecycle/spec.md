## MODIFIED Requirements

### Requirement: Explicit market lifecycle states
The system SHALL model markets with explicit lifecycle states including draft, scheduled, active, halted, trading closed, awaiting resolution, settled, cancelled, disputed, and voided.

#### Scenario: Admin applies a lifecycle transition
- **WHEN** an authorized internal workflow changes a market from one lifecycle state to another allowed state
- **THEN** the system updates the market status
- **AND** it records the from-state, to-state, reason, and actor in durable transition history

#### Scenario: Disputed market blocks settlement
- **WHEN** a market is marked as disputed before final settlement execution
- **THEN** the system rejects settlement attempts until the market leaves the disputed state
