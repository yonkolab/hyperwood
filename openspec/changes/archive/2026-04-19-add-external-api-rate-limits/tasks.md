## 1. Spec Update

- [x] 1.1 Add external API rate-limit operational visibility deltas to the platform security requirements.

## 2. Implementation

- [x] 2.1 Add configurable external API rate limiting in the Fastify app bootstrap.
- [x] 2.2 Persist first-exceed rate-limit events for operator review.
- [x] 2.3 Add an internal operations endpoint to list rate-limit events.
- [x] 2.4 Add tests and OpenAPI or guide documentation for the throttling behavior.

## 3. Validation

- [x] 3.1 Run `openspec validate add-external-api-rate-limits`.
- [x] 3.2 Run docs, type, build, migration, and API validation for the slice.
