## Context

Hyperwood already has a clean Fastify app factory in `src/app.ts`, a Drizzle/PostgreSQL persistence layer, split OpenAPI documentation, and containerized local infrastructure. Those are strong building blocks for a serious backend test stack, but the repo currently lacks:

- a test runner
- route tests against the real app bootstrap
- integration tests against migrated PostgreSQL
- a standardized test directory structure

## Decisions

### Decision: Use Vitest as the primary test runner

Vitest fits the TypeScript/Node stack, has first-class ESM support, and can split fast unit tests from slower infrastructure-backed projects.

### Decision: Use Fastify `inject()` for API tests

The app already exports `buildApp()` separately from `src/index.ts`. That means API tests can exercise request/response behavior through the real Fastify routes without binding a socket.

### Decision: Use Testcontainers for PostgreSQL-backed tests

Hyperwood’s external infrastructure in-repo is PostgreSQL. A Testcontainers harness provides isolated, migrated databases without coupling the test suite to `docker-compose.local.yml`.

### Decision: Keep DB-backed tests on real migrations

Tests should exercise the same schema evolution path the application uses. The harness should apply the Drizzle migrations from `drizzle/migrations` instead of duplicating schema setup logic.

### Decision: Preserve the existing OpenAPI spec and connect it to the test workflow

The repo already has a split OpenAPI document under `docs/openapi`. The testing architecture should validate that spec and document it as the foundation for future schema-driven tests such as contract validation and fuzzing.

## Risks and Mitigations

- [DB-backed tests become flaky] Use one reusable PostgreSQL container harness, deterministic cleanup, and real migrations.
- [Route tests require broad app rewrites] Reuse `buildApp()` and only make focused runtime changes when tests reveal missing behavior, such as request validation error mapping.
- [Integration tests are too heavy for every workflow] Keep unit and API tests cheap, and isolate heavier integration coverage behind a dedicated script and CI job.
