## Overview

This slice adds lightweight application-level throttling for the current single-process Fastify deployment model. It does not introduce a gateway or distributed counter store yet.

## Policy

- public auth endpoints use `AUTH_RATE_LIMIT_MAX_REQUESTS` over `AUTH_RATE_LIMIT_WINDOW_SECONDS`
- other external `/api/v1` endpoints use `API_RATE_LIMIT_MAX_REQUESTS` over `API_RATE_LIMIT_WINDOW_SECONDS`
- `/api/v1/internal/*` is excluded

## Scope Keys

- auth requests prefer the request email when present
- API key requests prefer the API key identifier
- all other requests fall back to caller IP

## Event Recording

The first exceeded request for a `(bucket, scope, path, window)` combination is persisted as a rate-limit event. That keeps operator visibility without flooding storage on every blocked retry.

## Future Work

- replace in-memory counters with a shared store for horizontally scaled deployments
- move rate-limit policy to edge or gateway infrastructure when traffic volume requires it
