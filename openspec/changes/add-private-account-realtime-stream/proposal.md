## Why

Hyperwood now exposes a public market stream, but authenticated users still have no live account channel for their own orders, balances, transfers, fills, and settlements. The realtime spec requires a private user stream in addition to public market data.

## What Changes

- add an authenticated SSE endpoint for one user and currency scope
- emit an initial account snapshot with portfolio summary, recent fills, and recent settlements
- publish private account events from order, funding, matching, and settlement workflows
- document the authenticated stream and its event types
- add API coverage for authenticated stream delivery

## Impact

- completes the second concrete realtime channel required by the canonical spec
- gives clients a live account-update surface without introducing websocket infrastructure
- reuses the existing portfolio and wallet read models as authoritative snapshot payloads
