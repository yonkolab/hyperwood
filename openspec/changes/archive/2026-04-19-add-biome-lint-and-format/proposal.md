## Why

The repo currently has testing and OpenAPI validation, but it does not have a single enforced formatting and linting standard. That leaves style drift, unused imports, and unused variables unchecked, and makes contributor output inconsistent across modules.

## What Changes

- adopt Biome as the repository linter and formatter
- enforce a consistent style baseline:
  - 2-space indentation
  - single quotes
  - no unused imports
  - no unused variables
- add local scripts for linting, formatting, and validation
- add CI validation for the Biome checks

## Impact

- contributors get a single formatting and linting toolchain
- pull requests fail early on style and hygiene regressions
- future endpoint and module work can rely on a stable code-style contract
