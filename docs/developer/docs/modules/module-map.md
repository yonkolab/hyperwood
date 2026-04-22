---
title: Module Map
---

# Module Map

`src/modules` is organized by business domain.

## Main domains

- `identity`
- `compliance`
- `funding`
- `orders`
- `matching`
- `markets`
- `portfolio`
- `exchange`
- `operations`

## Common shape

Each domain usually contains:

- `routes.ts` for HTTP wiring
- `schema.ts` for Zod request parsing
- `types.ts` for module-local type contracts
- a thin `service.ts` facade
- workflow/query services split by responsibility

Use the individual module pages to find the best entrypoints for reading code.
