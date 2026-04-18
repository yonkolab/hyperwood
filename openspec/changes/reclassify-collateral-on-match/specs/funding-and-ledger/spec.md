## MODIFIED Requirements

### Requirement: Ledger-backed balances and reservations
The system MUST use an append-only double-entry ledger as the source of truth for wallet balances, reservations, settlements, and transfer adjustments.

#### Scenario: Match reclassifies resting reserve
- **WHEN** an order fill occurs
- **THEN** the system debits the consumed amount from the user's resting order reserve wallet
- **AND** it credits the matched exposure to a dedicated user position collateral wallet
- **AND** any price-improvement excess is credited back to available cash through the same append-only ledger model
