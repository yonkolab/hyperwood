## 1. Spec Update

- [x] 1.1 Add lifecycle admin transition deltas to market lifecycle and admin operations requirements.

## 2. Implementation

- [x] 2.1 Add persisted market status transition records.
- [x] 2.2 Add an internal market status transition endpoint with validated allowed transitions.
- [x] 2.3 Expose status transition history in market detail responses.
- [x] 2.4 Add tests and OpenAPI docs for the new endpoint and response fields.

## 3. Validation

- [x] 3.1 Run `openspec validate add-market-admin-status-transitions`.
- [x] 3.2 Run docs, type, and API validation for the new market admin workflow.
