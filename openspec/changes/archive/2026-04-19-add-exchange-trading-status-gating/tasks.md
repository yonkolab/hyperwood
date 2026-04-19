## 1. Spec Update

- [x] 1.1 Add exchange status and trading gate deltas to admin and exchange operations.

## 2. Implementation

- [x] 2.1 Add derived exchange status evaluation from the active schedule.
- [x] 2.2 Add a public exchange status endpoint.
- [x] 2.3 Enforce exchange-open checks in order entry and matching.
- [x] 2.4 Add OpenAPI docs and API coverage for exchange status and gating.

## 3. Validation

- [x] 3.1 Run `openspec validate add-exchange-trading-status-gating`.
- [x] 3.2 Run lint, docs, type, build, and API validation for the trading status slice.
