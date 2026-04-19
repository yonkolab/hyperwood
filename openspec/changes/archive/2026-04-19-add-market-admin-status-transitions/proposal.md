## Why

Hyperwood now supports market creation, matching, resolution, and settlement, but it still lacks an executable admin workflow for changing market lifecycle state after creation. The canonical specs already require halts, resumed trading, and dispute handling, and those states should be persisted and exposed through the API instead of remaining implicit.

## What Changes

- Add an internal market status transition endpoint for admin lifecycle actions.
- Persist market status transitions as audit-friendly records.
- Expose status transition history in market detail.
- Enforce dispute and halt states through existing trading and settlement guards.

## Impact

- Operators can halt, resume, close, cancel, or dispute a market through an explicit API.
- Market detail gains a durable status transition history instead of only the latest status timestamp.
- Disputed markets become a real executable blocker for settlement, matching the portfolio and lifecycle specs.
