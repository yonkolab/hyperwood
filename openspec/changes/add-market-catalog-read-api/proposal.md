## Why

Hyperwood has identity, compliance, and initial funding foundations, but it still exposes no executable public market data. The next useful slice is a read-only market catalog so clients can discover events and inspect market detail before order-entry work begins.

## What Changes

- Add event and market persistence for binary prediction markets with explicit lifecycle status, pricing snapshots, category metadata, and resolution references.
- Add public routes to list markets with basic filtering, search, and sorting, and to fetch market detail.
- Add internal bootstrap routes to create events and markets so the catalog can be seeded without waiting for full admin tooling.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `market-catalog-and-lifecycle`: add the first executable public market catalog and market detail API slice.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-market-catalog-read-api/specs/market-catalog-and-lifecycle/spec.md`.
- Introduces a market catalog module with public read APIs and internal bootstrap writes.
- Adds event and market schema tables plus a new migration.
