# Rate Limits

Hyperwood applies server-side rate limits to external HTTP routes.

Current behavior:

- public auth routes use the stricter `AUTH_RATE_LIMIT_MAX_REQUESTS` / `AUTH_RATE_LIMIT_WINDOW_SECONDS` window
- other external `/api/v1` routes use `API_RATE_LIMIT_MAX_REQUESTS` / `API_RATE_LIMIT_WINDOW_SECONDS`
- internal bootstrap routes under `/api/v1/internal/*` are excluded from these external throttles

Current scoped buckets:

- auth routes prefer the request email when present
- API key traffic uses the API key identifier when available
- other traffic falls back to the caller IP address

When a limit is exceeded:

- the API returns `429`
- the error code is `rate_limit_exceeded`
- the response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`
- the first exceed event for that scope/window is persisted for operator review

Operator visibility:

- use `GET /api/v1/internal/operations/rate-limit-events`
- filter by `bucket`, `scopeType`, `scopeKey`, or `path` as needed

Notes:

- these limits are currently process-local, which is acceptable for local development and single-instance deployments
- for multi-instance production scaling, move the counter store to shared infrastructure such as Redis or a dedicated gateway layer
