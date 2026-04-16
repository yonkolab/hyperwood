## Why

Hyperwood already has basic user identity and access controls, but it still lacks a concrete compliance model that can decide whether a user may trade, fund, withdraw, or access region-limited capabilities.

## What Changes

- Add persisted compliance profile data for KYC provider state, sanctions review state, jurisdiction, and legal-entity context.
- Add account-level compliance restrictions and review holds.
- Expose a capability-evaluation route that tells an authenticated user which actions are currently allowed or blocked.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `compliance-and-regional-controls`: move from baseline requirements to an executable compliance profile and capability gating slice.

## Impact

- Adds an OpenSpec delta under `openspec/changes/add-compliance-capability-gating/specs/compliance-and-regional-controls/spec.md`.
- Introduces a compliance module, database state, and internal bootstrap routes for compliance administration.
- Provides capability evaluation that downstream trading and funding modules can reuse.
