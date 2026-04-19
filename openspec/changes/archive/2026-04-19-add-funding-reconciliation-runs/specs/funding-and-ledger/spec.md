## MODIFIED Requirements

### Requirement: Reconciliation workflows
The system SHALL run intraday and daily reconciliation against providers, transfer states, reservations, ledger invariants, and settlement outputs.

#### Scenario: Funding reconciliation run is executed
- **WHEN** the platform runs reconciliation against an authoritative set of funding transfer states
- **THEN** it records a reconciliation run with compared record counts and discrepancy counts
- **AND** each detected issue is persisted as a discrepancy linked to that run

#### Scenario: Reconciliation detects transfer state mismatch
- **WHEN** an authoritative transfer snapshot disagrees with the internal transfer state or the transfer is missing internally
- **THEN** the platform records a discrepancy describing the mismatch
- **AND** operations can query the discrepancy later

#### Scenario: Reconciliation detects ledger invariant failure
- **WHEN** a transfer's internal status implies a required ledger transaction and that transaction is missing
- **THEN** the platform records a ledger invariant discrepancy
- **AND** the discrepancy is marked with critical severity
