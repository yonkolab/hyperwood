## Why

Session and internal route protection is currently repeated across multiple
route files. That duplication makes the auth model harder to audit, complicates
future RBAC work, and increases the chance of route-level inconsistencies.

## What Changes

- add shared route auth guards for session and internal access
- standardize request auth context on Fastify requests
- standardize step-up token capture for MFA-gated session routes
- migrate existing session and bootstrap-protected routes to the shared guards

## Impact

- removes duplicated bearer and bootstrap parsing from route modules
- preserves current API behavior while creating a stable auth abstraction
- prepares the route layer for operator RBAC without introducing it yet
