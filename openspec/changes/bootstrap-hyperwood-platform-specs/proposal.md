## Why

Hyperwood has a detailed root PRD but no OpenSpec artifacts yet, which makes the project hard to drive through a spec-first workflow. Bootstrapping the initial capability specs now creates a shared contract for implementation decisions, API boundaries, and operational priorities before code is written.

## What Changes

- Create a baseline OpenSpec change for Hyperwood derived from the root `PRD.md`.
- Define core product capabilities for identity, compliance, funding, markets, trading, settlement, realtime distribution, administration, and platform controls.
- Capture the recommended architecture, non-goals, and phased implementation path in OpenSpec-friendly form.
- Establish a maintainable spec split so future changes can modify individual capabilities instead of editing one large PRD.

## Capabilities

### New Capabilities

- `identity-and-access`: User registration, authentication, MFA, API key management, and account access controls.
- `compliance-and-regional-controls`: KYC, AML, sanctions, jurisdiction rules, and policy-based access restrictions.
- `funding-and-ledger`: Linked funding methods, deposits, withdrawals, immutable ledger behavior, and reconciliation.
- `market-catalog-and-lifecycle`: Event and market discovery, metadata, lifecycle states, and exchange-visible market behavior.
- `trading-and-order-management`: Order entry, validation, idempotency, cancellations, amendments, and user-visible order state.
- `matching-and-orderbook`: Deterministic sequencing, price-time matching, order book snapshots, and market data generation.
- `portfolio-and-settlement`: Positions, balances, portfolio views, market resolution, dispute handling, and settlement outputs.
- `realtime-and-historical-data`: Streaming channels, sequence recovery, historical access paths, archival, and exports.
- `admin-and-exchange-operations`: Admin workflows for markets, compliance reviews, withdrawals, announcements, and operational controls.
- `platform-security-and-observability`: Auditability, rate limits, secret hygiene, metrics, alerts, and invariant monitoring.

### Modified Capabilities

- None.

## Impact

- Adds initial OpenSpec artifacts under `openspec/changes/bootstrap-hyperwood-platform-specs/`.
- Seeds project-level baseline specs under `openspec/specs/` for future delta changes.
- Turns the root PRD into actionable capability boundaries for the Hyperwood prediction market API.
