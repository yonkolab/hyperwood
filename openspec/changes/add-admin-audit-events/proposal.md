## Why

Hyperwood now supports a growing set of sensitive internal actions: compliance overrides, withdrawal review actions, market lifecycle changes, market resolution, and settlement. The canonical specs already require immutable audit records for those actions, but the implementation still has no first-class audit event store or retrieval API.

## What Changes

- Add persisted administrative audit events for sensitive internal actions.
- Record audit events for compliance overrides, withdrawal review actions, and market admin actions.
- Expose an internal operations API to query recent audit events by target.

## Impact

- Sensitive internal workflows become reviewable after the fact instead of relying on ad hoc logs.
- The operations surface gains a durable audit history endpoint.
- Future admin actions can reuse the same audit layer instead of inventing one-off tracking fields.
