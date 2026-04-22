## Why

The admin review queue currently exposes withdrawal reviews and reconciliation
investigations, but the canonical admin spec also calls for KYC cases and flagged
accounts. Those review sources already exist in persisted compliance state and
restrictions, but they are not surfaced through the queue.

## What Changes

- add pending and non-approved KYC profiles to the internal review queue
- add unresolved account restrictions to the internal review queue as flagged accounts
- document the expanded queue response
- add API coverage for the new review sources

## Impact

- makes the internal review queue materially closer to the canonical admin spec
- gives operators a single read path for common manual-review work
