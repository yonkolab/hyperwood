## Why

Hyperwood has no automated test suite yet. That leaves core trading, funding, identity, and ledger behavior exposed to regression risk as the platform grows.

## What Changes

- Add a dedicated testing architecture covering unit, API, and infrastructure-backed integration tests.
- Standardize on Vitest as the test runner and Fastify `inject()` for HTTP-layer API tests.
- Add a Testcontainers-backed PostgreSQL harness that runs the real Drizzle migrations for DB-backed tests.
- Document how the existing OpenAPI spec supports future contract and schema-driven API tests.

## Impact

- Core logic can be validated quickly with unit tests.
- Route behavior can be verified without binding a real port.
- Persistence-heavy flows can be exercised against real PostgreSQL infrastructure in isolation.
- The OpenAPI spec becomes part of the testing story instead of a disconnected documentation artifact.
