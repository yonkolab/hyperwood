---
title: Request Flow
---

# Request Flow

Typical request flow:

1. Fastify receives the request in `src/app.ts`
2. shared hooks apply request IDs, CORS, rate limits, and error handling
3. route-level auth guards resolve session or internal auth context
4. route schemas parse request params/body/query
5. module services execute business logic
6. side effects may publish realtime events, alerts, or audit records
7. the response returns a structured payload plus `X-Request-Id`

## Important cross-cutting concerns

- request correlation: `x-request-id`
- rate limiting: external APIs only
- structured errors: `AppError` plus normalized error handler
- observability: workflow events and correlation-aware logs

## Realtime side effects

Some write paths also publish SSE updates:

- orders can update order book and account balance state
- matching can publish trade batches and fill/balance updates
- settlements can publish settlement and balance updates
