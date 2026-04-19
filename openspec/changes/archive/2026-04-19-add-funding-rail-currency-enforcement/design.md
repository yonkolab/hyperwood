## Context

`GET /funding/methods` currently returns verified methods based only on compliance eligibility and the rail list allowed for a user's country. It does not consider the requested currency, and `POST /internal/funding/users/:userId/methods` accepts any rail-country pairing.

## Decisions

### Decision: Make funding method discovery currency-scoped

The funding methods endpoint should accept a requested currency and only return linked methods whose rails support that currency.

### Decision: Centralize rail policy

Country-to-rail eligibility and rail-to-currency support should live in a shared policy module so compliance and funding services evaluate the same rules.

### Decision: Reject incompatible rail registrations

Internal method registration should reject pairings like `pix` plus `US` or `ach` plus `BR` before the data is persisted.

## Risks and Mitigations

- [Policy drift across modules] Shared helpers keep compliance and funding decisions consistent.
- [Legacy inconsistent rows] Public discovery re-applies policy filtering so inconsistent records remain hidden even if inserted earlier.
- [Future currency expansion] Rail support is modeled as a per-rail list so new currencies can be added without rewriting endpoint contracts.
