## Context

Current order book snapshots are derived from resting limit orders and now expose the authoritative market sequence at read time. Market writes also persist a per-market command log. That is enough to implement snapshot-plus-delta recovery over HTTP without introducing a live streaming transport yet.

## Decisions

### Decision: Reuse the market command log as the first delta source

The command log already provides ordered, gap-free market sequences for order creation and cancellation. Reusing it avoids duplicating sequencing state and keeps recovery semantics aligned with the same source of truth used by write paths.

### Decision: Return every sequenced command, even when it does not mutate the visible book

Some accepted commands, such as market orders in the current codebase, do not create resting depth. Omitting them would create apparent sequence gaps for consumers. The delta API therefore returns every command with an explicit `bookEffect` field so clients can advance their cursor while ignoring non-book-affecting events.

### Decision: Keep recovery transport as pull-based HTTP in this slice

The base spec calls for realtime channels eventually, but there is no transport layer or fanout pipeline in the current project. A paginated HTTP delta endpoint is the smallest slice that satisfies recovery behavior and gives future streaming work a concrete payload contract.

## Risks and Mitigations

- [Historical event shape drift] Future order lifecycle changes may require richer event payloads than the current command metadata. Mitigation: persist fuller immutable order details on new command events now and keep the delta endpoint tolerant of older sparse metadata.
- [Large recovery windows] Long gaps could produce heavy responses. Mitigation: cap page size and return `hasMore` plus `nextAfterSequence` for chunked replay.
