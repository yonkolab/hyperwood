## Why

Hyperwood already supports password login, MFA, and API credentials, but it still does not persist login risk signals or apply any access restriction when repeated suspicious activity is detected.

## What Changes

- Record login events and outcomes for authentication attempts.
- Flag suspicious login activity based on repeated failed attempts within a short time window.
- Apply a temporary login restriction when the suspicious-activity threshold is exceeded.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `identity-and-access`: Extend strong authenticated access with persistent suspicious-login signals and a first restriction policy.

## Impact

- Adds an OpenSpec delta under `openspec/changes/flag-suspicious-logins/specs/identity-and-access/spec.md`.
- Updates the identity service to record login outcomes and enforce temporary restrictions on repeated failures.
- Introduces database state for login events and heuristics.
