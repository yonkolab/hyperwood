## 1. Spec Update

- [x] 1.1 Add a testing architecture requirement covering unit, API, integration, and OpenAPI validation layers.

## 2. Tooling

- [x] 2.1 Add Vitest and coverage configuration.
- [x] 2.2 Add a reusable Testcontainers PostgreSQL harness and test helpers.
- [x] 2.3 Add package scripts for unit, API, integration, and coverage runs.

## 3. Tests

- [x] 3.1 Add meaningful unit tests for pure logic.
- [x] 3.2 Add Fastify `inject()` API tests for core routes and failure paths.
- [x] 3.3 Add PostgreSQL-backed integration tests that run real Drizzle migrations.

## 4. Documentation and CI

- [x] 4.1 Document the test architecture and local workflows.
- [x] 4.2 Add CI coverage for unit, API, integration, and OpenAPI validation where practical.

## 5. Validation

- [x] 5.1 Run `openspec validate add-api-testing-architecture`.
- [x] 5.2 Run the implemented test commands and repo checks that are feasible in the current environment. Note: DB-backed Vitest projects require a working container runtime and could not execute in this sandbox.
