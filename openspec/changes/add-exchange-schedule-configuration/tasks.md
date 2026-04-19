## 1. Spec Update

- [x] 1.1 Add exchange schedule configuration deltas to admin and exchange operations.

## 2. Implementation

- [x] 2.1 Add persisted exchange schedule storage.
- [x] 2.2 Add public read and internal upsert endpoints for the active schedule.
- [x] 2.3 Add OpenAPI docs and API tests for the new schedule endpoints.

## 3. Validation

- [x] 3.1 Run `openspec validate add-exchange-schedule-configuration`.
- [x] 3.2 Run migration, lint, docs, type, build, and API validation for the schedule slice.
