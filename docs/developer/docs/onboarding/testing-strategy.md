---
title: Testing Strategy
---

# Testing Strategy

Hyperwood uses layered backend tests.

## Layers

- `tests/unit`: pure logic, policies, helpers
- `tests/api`: real Fastify app via `inject()`
- `tests/integration`: PostgreSQL-backed service behavior

## Primary commands

```bash
npm test
npm run test:unit
npm run test:api
npm run test:integration
```

## What to choose

- policy or helper change: unit
- route, auth, status code, or response behavior: api
- ledger, settlement, reconciliation, persistence-heavy flows: integration

## Rule of thumb

If you change:

- public API behavior, update OpenAPI and API tests
- business rules, add unit tests
- money movement or persistence semantics, add integration coverage
