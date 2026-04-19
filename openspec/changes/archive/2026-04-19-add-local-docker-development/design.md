## Context

The current setup instructions require a manually installed PostgreSQL instance and a local Node runtime. That is workable for an existing maintainer, but it is a poor default for a new project that needs a reproducible local stack.

## Decisions

### Decision: Use Docker Compose with separate app and database services

Hyperwood has a clean two-service local topology today: API plus PostgreSQL. Compose is the smallest operational unit that matches that architecture.

### Decision: Run migrations on app startup

The local stack should converge on a usable state without a second command. Running `npm run db:migrate` before the app process ensures a newly started database is ready for requests.

### Decision: Keep the app container in development mode

The purpose of this workflow is iterative local development, not a production artifact. The app container should bind-mount the repo and run the existing `npm run dev` command.

## Risks and Mitigations

- [App starts before the database is ready] The app service waits on the PostgreSQL health check before running migrations.
- [Local dependency mismatch] Dependencies are installed inside the container and isolated from the host through a dedicated `node_modules` volume.
- [Developers accidentally treat this as production deployment] The files and documentation are explicitly named for local development.
