## Design

Hyperwood currently delivers realtime updates through in-process SSE registries:

- public market streams
- private account streams

This slice adds health introspection to those registries by tracking:

- subscription id
- connected timestamp
- last delivery timestamp

The internal operations scan path reads those registries, computes idle duration,
and creates persisted alerts for subscriptions that exceed the configured staleness
threshold.

### Threshold

The default threshold is configured through `REALTIME_STREAM_STALE_SECONDS`.
The internal scan path may accept a smaller explicit override for targeted operator
checks and tests.

### Alert model

- category: `realtime_stream_outage`
- severity: `critical`
- source types:
  - `realtime_market_stream`
  - `realtime_account_stream`

### Non-goals

- multi-node stream fanout
- WebSocket transport
- external paging integration
