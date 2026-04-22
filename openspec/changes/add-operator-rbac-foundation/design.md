## Design

This slice is specification-only. It does not change runtime behavior yet.

### Phase A: compatibility

- bootstrap token remains valid for current internal routes
- guard middleware hides whether internal auth came from bootstrap or a future operator identity
- audit events continue to accept actor strings

### Phase B: operator identity

Introduce first-class operator principals with:

- operator identity records
- operator session or operator API token auth
- role assignment
- permission checks by route family

### Initial permissions

- `operations:read`
- `operations:scan`
- `markets:write`
- `markets:settle`
- `compliance:write`
- `funding:approve`
- `funding:reconcile`
- `exchange:write`
- `identity:link`

### Route-family mapping

- operations feeds -> `operations:read`
- operations scans and retries -> `operations:scan`
- market create, status, and announcements -> `markets:write`
- market resolve and settle -> `markets:settle`
- compliance overrides and restrictions -> `compliance:write`
- funding approvals -> `funding:approve`
- funding reconciliation and delay scans -> `funding:reconcile`
- exchange schedule and fee writes -> `exchange:write`
- internal auth linking -> `identity:link`
