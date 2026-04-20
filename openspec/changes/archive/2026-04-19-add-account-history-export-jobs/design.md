## Context

The historical-data spec requires account or market history exports, but the codebase currently only exposes live-style paged endpoints. There is no persisted export job model or artifact retrieval path.

## Decisions

### Decision: Start with authenticated account history exports

Account history is already derivable from portfolio, settlements, fills, and ledger activity. That makes it the lowest-risk first export surface.

### Decision: Generate JSON artifacts synchronously

The current backend has no background worker or object storage path. The initial slice creates a job record and completes it within the request, storing the generated JSON artifact in the database. This is sufficient to establish the export contract and retrieval path.

### Decision: Keep exports currency-scoped

The current portfolio model is currency-scoped. Export jobs therefore require a currency and preserve the same scoped semantics in the resulting artifact.
