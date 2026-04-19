## Why

Hyperwood now has executable funding transfers, but provider callbacks are still missing. That leaves transfer progression dependent on bootstrap-only internal routes and creates a security gap around external money movement updates.

## What Changes

- Add a signed funding provider webhook endpoint.
- Verify timestamped HMAC signatures before applying transfer side effects.
- Deduplicate provider events by provider and event ID.
- Apply supported funding transfer updates from verified callbacks.
- Document the webhook contract and add tests.

## Impact

- Funding providers can advance deposits and withdrawals without using internal bootstrap routes.
- Invalid or replayed callbacks are rejected safely.
- The platform security spec gains a concrete signed webhook implementation.
