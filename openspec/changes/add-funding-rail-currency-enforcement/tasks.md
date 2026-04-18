## 1. Spec Update

- [x] 1.1 Add deltas for currency-scoped funding method discovery.
- [x] 1.2 Add deltas for region and rail compatibility enforcement.

## 2. Implementation

- [x] 2.1 Add a shared funding rail policy for country and currency compatibility.
- [x] 2.2 Add `currency` query support to `GET /funding/methods`.
- [x] 2.3 Reject invalid rail-country combinations during funding method registration.

## 3. Validation

- [x] 3.1 Run `openspec validate add-funding-rail-currency-enforcement`.
- [x] 3.2 Run `npm run check` and `npm run build`.
