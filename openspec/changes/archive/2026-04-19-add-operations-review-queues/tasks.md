## 1. Spec Update

- [x] 1.1 Add operations review queue deltas to admin-and-exchange-operations requirements.

## 2. Implementation

- [x] 2.1 Add an internal operations review queue route and service.
- [x] 2.2 Expose withdrawals awaiting review with supporting user, funding method, and review context.
- [x] 2.3 Expose unresolved reconciliation discrepancies as investigation queue items.

## 3. Validation

- [x] 3.1 Run `openspec validate add-operations-review-queues`.
- [x] 3.2 Run `npm run check` and `npm run build`.
