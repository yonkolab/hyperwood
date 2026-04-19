## 1. Spec Update

- [x] 1.1 Add immutable administrative audit event deltas to the admin operations requirements.

## 2. Implementation

- [x] 2.1 Add persisted administrative audit event storage.
- [x] 2.2 Record audit events for sensitive internal market, compliance, and withdrawal actions.
- [x] 2.3 Add an internal operations audit-event listing endpoint.
- [x] 2.4 Add tests and OpenAPI docs for the audit event API and audited flows.

## 3. Validation

- [x] 3.1 Run `openspec validate add-admin-audit-events`.
- [x] 3.2 Run docs, type, migration, and API validation for the audit slice.
