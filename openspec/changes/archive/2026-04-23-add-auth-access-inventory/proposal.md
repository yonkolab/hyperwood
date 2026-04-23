## Why

Hyperwood already has meaningful auth separation between public routes, user
routes, API-key routes, and internal control-plane routes, but that separation
is only implicit in route code and OpenAPI security sections. The project needs
one explicit inventory that engineering and product can use as the baseline for
future auth middleware and operator RBAC work.

## What Changes

- add a route-by-route auth access inventory grouped by module
- classify routes into the current access classes used by the API
- document that internal routes are bootstrap-token protected today
- call out signed provider webhooks as a distinct external auth shape

## Impact

- makes current access boundaries reviewable without reading every route file
- gives the guard middleware and RBAC work a stable inventory baseline
- reduces ambiguity about which endpoints are for public clients, users, and operators
