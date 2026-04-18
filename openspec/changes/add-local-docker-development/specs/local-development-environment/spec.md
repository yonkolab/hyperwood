## ADDED Requirements

### Requirement: Local Docker development stack
The system SHALL provide a local containerized development workflow for the API and its required PostgreSQL database.

#### Scenario: Developer boots the local stack
- **WHEN** a developer starts the documented local Docker workflow
- **THEN** the system starts a PostgreSQL container and an API container on the same local network
- **AND** the API container is configured to connect to the database container without requiring a host-installed PostgreSQL instance

#### Scenario: Local stack applies schema before serving traffic
- **WHEN** the API container starts against the local database container
- **THEN** it applies the current migration set before starting the development server
- **AND** the API becomes available on the documented local port after the database health check passes
