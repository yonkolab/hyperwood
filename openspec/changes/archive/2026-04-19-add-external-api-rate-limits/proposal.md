## Why

`platform-security-and-observability` already requires external rate limiting, but the current API accepts unlimited request volume on public auth and general external routes. That leaves login, registration, and write flows exposed to abuse and gives operators no visibility into throttling decisions.

## What Changes

- add configurable rate limiting for external API paths
- apply a stricter bucket to public auth endpoints and a broader bucket to other external routes
- persist first-exceed events for each rate-limit window
- add an internal operations endpoint to review rate-limit events
- document the new behavior in OpenAPI and human guides

## Impact

- external clients can receive `429 rate_limit_exceeded`
- operators get explicit visibility into exceeded windows
- internal bootstrap routes remain excluded from these external throttles
