## Context

Hyperwood currently exposes only private identity, compliance, and funding endpoints. The baseline `market-catalog-and-lifecycle` spec describes public discovery and lifecycle behavior, but the codebase has no market persistence or read APIs yet. The first executable slice should stay narrow enough to implement cleanly while still creating durable primitives for later admin, trading, and settlement work.

## Goals / Non-Goals

**Goals:**

- Add durable event and market records with explicit lifecycle status.
- Expose public market catalog and market detail endpoints that cover the first discovery workflow.
- Keep seeding simple with internal bootstrap routes that match existing bootstrap-token patterns.

**Non-Goals:**

- Full market authoring workflows, reviewer approval chains, or admin dashboards.
- Orderbook, trading, or settlement behavior.
- Historical status transition storage beyond the current lifecycle milestone fields returned by the read API.

## Decisions

### Decision: Separate events from markets

Events and markets change at different rates, and market list responses need event grouping metadata. A dedicated `market_events` table and a child `markets` table keep the data model aligned with the baseline capability and future multi-market event expansion.

Alternatives considered:

- Single flat `markets` table with repeated event fields: rejected because it duplicates event metadata and complicates grouped responses.

### Decision: Store tags and resolution sources as JSONB arrays

The first slice needs lightweight tagging and source-reference support without introducing extra join tables. JSONB arrays are enough for catalog filtering and detail responses, and they can be normalized later if richer taxonomy management is needed.

Alternatives considered:

- Fully normalized tag and source tables: rejected because they add complexity before there is any write-side admin tooling.

### Decision: Keep the executable slice read-only for public clients

The public API only needs discovery and detail now. Internal bootstrap write routes seed data for development and tests while avoiding premature commitments to long-term admin workflows.

Alternatives considered:

- Building admin CRUD now: rejected because it would expand scope into authorization, validation, and audit design that the current roadmap does not need yet.

## Risks / Trade-offs

- [Bootstrap routes are not a long-term admin interface] -> Keep them internal behind `x-bootstrap-token` and treat them as setup tooling only.
- [Catalog filtering uses a simple initial implementation] -> Limit filters to category, status, tag, search, and a small sort set that can be optimized later.
- [Lifecycle history is not fully auditable yet] -> Return milestone-derived timeline data now and introduce dedicated transition history in a later lifecycle/admin change.

## Migration Plan

1. Add the new event and market schema tables and generate a migration.
2. Register the market catalog routes alongside existing modules.
3. Seed catalog data through internal bootstrap routes in local or test environments.
4. Follow with admin and trading changes that build on the same event and market identifiers.

Rollback strategy:

- Revert the application changes and roll back the new market tables if the slice needs to be withdrawn before production use.

## Open Questions

- Whether public market detail should eventually use slugs instead of UUIDs for canonical reads.
- Whether category taxonomy will stay free-form or move to a controlled enum/set managed by admin tooling.
