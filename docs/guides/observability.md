# Observability

Hyperwood returns an `X-Request-Id` header on every HTTP response.

Current behavior:

- if the client sends `x-request-id`, Hyperwood reuses that value
- otherwise the API generates a request identifier automatically
- the same identifier is attached to structured application logs for the request lifecycle

Client guidance:

- log `X-Request-Id` for failed requests and unexpected responses
- when you already have a client-side correlation identifier, send it as `x-request-id`
- include the request ID when escalating support, operational incidents, or settlement disputes

Structured workflow logging currently covers:

- order creation, cancellation, and amendment
- deposit and withdrawal lifecycle changes
- reconciliation run completion
- matching executions
- market announcements, status changes, resolution, and settlement

Notes:

- the current implementation is request-scoped structured logging inside the API process
- log shipping, metrics pipelines, and distributed tracing are still future work
