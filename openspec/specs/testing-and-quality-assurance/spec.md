# testing-and-quality-assurance Specification

## Purpose
TBD - created by archiving change add-api-testing-architecture. Update Purpose after archive.
## Requirements
### Requirement: Layered backend test architecture

Hyperwood MUST provide separate test layers for unit, API, and infrastructure-backed integration coverage.

#### Scenario: Fast unit feedback for pure logic

- **WHEN** contributors validate pure helpers, business rules, or policy logic
- **THEN** the repo MUST provide a fast unit test command that does not require external infrastructure
- **AND** unit tests MUST live separately from DB-backed suites

#### Scenario: Route behavior through the real Fastify app

- **WHEN** contributors validate HTTP behavior
- **THEN** the repo MUST support API tests through the real Fastify app instance without binding a network port
- **AND** those tests MUST exercise real route parsing, auth handling, status codes, and response bodies

#### Scenario: Real PostgreSQL-backed integration validation

- **WHEN** contributors validate persistence-heavy services or ledger behavior
- **THEN** the repo MUST support isolated PostgreSQL-backed integration tests
- **AND** those tests MUST apply the real Drizzle migrations before assertions run

### Requirement: Reusable test infrastructure helpers

Hyperwood MUST provide reusable helpers for DB-backed test setup and teardown.

#### Scenario: Isolated DB state between tests

- **WHEN** DB-backed tests run
- **THEN** the test harness MUST provide a deterministic way to reset persisted state between tests
- **AND** it MUST avoid coupling test execution to the local Docker Compose stack

### Requirement: OpenAPI-aware quality workflow

Hyperwood MUST keep the OpenAPI document as part of the test and validation workflow.

#### Scenario: Validate the API spec in automation

- **WHEN** contributors change the HTTP API surface or docs
- **THEN** the repo MUST provide a command that validates the split OpenAPI document
- **AND** CI MUST be able to run that validation

#### Scenario: Prepare for future schema-based API testing

- **WHEN** the team expands automated contract or fuzz testing
- **THEN** the repo MUST have a documented path to build on the existing OpenAPI spec instead of introducing a second API contract source

### Requirement: Repository linting and formatting workflow

Hyperwood MUST provide a repository-wide linting and formatting workflow for day-to-day development and CI validation.

#### Scenario: Contributor checks repository style locally

- **WHEN** a contributor changes source files, tests, or supported scripts
- **THEN** the repo MUST provide commands to format code and validate lint rules locally
- **AND** the workflow MUST use Biome as the formatter and linter

#### Scenario: Unused code hygiene is rejected

- **WHEN** a contributor introduces an unused import or unused variable into a supported file
- **THEN** the validation workflow MUST fail
- **AND** the issue MUST be attributable to the Biome lint configuration

#### Scenario: Repository formatting is consistent

- **WHEN** supported files are formatted through the repository toolchain
- **THEN** indentation MUST use 2 spaces
- **AND** strings MUST default to single quotes

#### Scenario: CI validates repository lint and format rules

- **WHEN** repository validation runs in CI
- **THEN** the workflow MUST execute the non-writing Biome validation command
- **AND** CI MUST fail on lint or formatting drift
