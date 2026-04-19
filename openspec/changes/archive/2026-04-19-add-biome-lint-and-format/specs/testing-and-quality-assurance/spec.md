## MODIFIED Requirements

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
