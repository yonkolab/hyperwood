## Why

Hyperwood currently separates operator features from user features with a shared
bootstrap token. That is acceptable for the current phase, but it is not a
durable internal auth model once multiple operators, permissions, and audited
actor identities are required.

## What Changes

- define a phased operator auth model
- preserve bootstrap-token compatibility during migration
- define the initial operator permission set and route-family mapping
- document operator RBAC as the next implementation slice after guard extraction

## Impact

- turns internal auth replacement into an explicit planned change instead of an ad hoc rewrite
- creates a stable permission vocabulary for future operator identities
- keeps current routes compatible while the platform transitions away from one shared secret
