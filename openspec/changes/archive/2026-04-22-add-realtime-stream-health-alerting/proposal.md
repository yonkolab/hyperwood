## Why

Hyperwood now exposes public and private realtime delivery over SSE, but operators
still have no alert source for stale or effectively dead stream subscriptions.
The platform-security spec already requires outage alerting for realtime delivery.

## What Changes

- add internal realtime stream health scan endpoint
- detect stale SSE subscriptions from live in-process stream state
- persist operational alerts for stale public and private realtime streams
- document the scan path and alert category
- add API coverage for stale stream alert creation

## Impact

- closes the remaining realtime outage alerting gap in platform observability
- gives operators a concrete internal scan path for stale SSE subscriptions
- keeps the implementation honest to the current SSE architecture
