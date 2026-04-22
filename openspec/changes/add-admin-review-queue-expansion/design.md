## Design

This slice extends the existing `GET /api/v1/internal/operations/reviews`
response. It does not add mutation workflows.

### Added review sources

- `kycReviews`
  - sourced from `compliance_profiles`
  - includes users whose KYC status is not approved or whose sanctions status is
    not clear

- `flaggedAccounts`
  - sourced from unresolved `account_restrictions`
  - includes restriction scope, reason, source, and user context

### Ordering

- KYC reviews are ordered by the most recently updated compliance profile
- flagged accounts are ordered by newest unresolved restriction

### Non-goals

- settlement retry workflow
- acknowledgment/resolution workflow for review items
- new compliance mutation endpoints
