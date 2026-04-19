## 1. Spec Update

- [x] 1.1 Add exchange fee configuration deltas to admin and exchange operations.

## 2. Implementation

- [x] 2.1 Add persisted exchange fee schedule storage.
- [x] 2.2 Add public read and internal publish endpoints for active fee schedules.
- [x] 2.3 Add OpenAPI docs and API tests for the new fee endpoints.

## 3. Validation

- [x] 3.1 Run `openspec validate add-exchange-fee-configuration`.
- [x] 3.2 Run migration, lint, docs, type, build, and API validation for the fee slice.
