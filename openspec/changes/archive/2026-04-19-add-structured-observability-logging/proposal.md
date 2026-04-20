## Why

The platform spec requires structured observability with correlation identifiers, but the current runtime only emits default Fastify logging. Critical financial and trading flows do not consistently log request or domain references.

## What Changes

- add request correlation via `x-request-id`
- return the request identifier on responses
- emit structured logs for critical order, funding, matching, and settlement flows
- document and test the correlation behavior

## Impact

- operators can correlate client errors with backend logs
- critical flows carry stable request, user, market, order, and transfer references
- the platform security spec gains a real observability foundation without introducing external metrics infrastructure yet
