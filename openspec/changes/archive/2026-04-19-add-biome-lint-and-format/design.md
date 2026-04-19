## Overview

This change standardizes source formatting and linting with Biome. The goal is not just code style; it also adds static hygiene checks that are currently missing from the workflow.

## Scope

Biome should cover the TypeScript and JavaScript source tree, test files, scripts, and configuration files that Biome supports cleanly.

## Rules

- indentation uses 2 spaces
- strings use single quotes
- unused imports are rejected
- unused variables are rejected

## Workflow

- contributors run Biome locally through package scripts
- CI runs the non-writing validation mode
- formatting fixes should be safe to apply automatically

## Rollout

This should be implemented in a separate pass from the spec:

1. add Biome configuration and scripts
2. apply the formatter to the current tree
3. fix or suppress legitimate lint violations intentionally and minimally
4. wire Biome into CI

## Notes

If Biome defaults conflict with established repo behavior, the config should explicitly choose the repo policy rather than relying on defaults.
