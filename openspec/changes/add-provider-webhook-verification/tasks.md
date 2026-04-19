## 1. Spec Update

- [x] 1.1 Add signed provider webhook deltas to platform security and funding requirements.

## 2. Implementation

- [x] 2.1 Add a signed funding provider webhook endpoint and signature verification.
- [x] 2.2 Persist processed provider webhook events for idempotent replay handling.
- [x] 2.3 Apply supported transfer status transitions from verified provider callbacks.
- [x] 2.4 Add docs and test coverage for the webhook contract.

## 3. Validation

- [x] 3.1 Run `openspec validate add-provider-webhook-verification`.
- [x] 3.2 Run migration, lint, docs, type, build, and API validation for the webhook slice.
