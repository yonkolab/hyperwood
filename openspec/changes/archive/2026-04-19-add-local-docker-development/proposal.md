## Why

Hyperwood currently assumes the developer has Node.js and PostgreSQL installed locally. That is unnecessary friction for a backend project that already has a well-defined app process and database dependency.

## What Changes

- Add a local development spec for running the API and PostgreSQL with Docker Compose.
- Add a containerized app runtime that installs dependencies and starts the server against the local database container.
- Run database migrations automatically before the app process starts.

## Impact

- New contributors can boot Hyperwood with a single Docker Compose workflow.
- Local environments become more consistent because the app and database run with pinned container images.
- Schema migrations are applied in the same startup path used by the local containerized app.
