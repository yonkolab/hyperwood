---
title: Repo Workflow
---

# Repo Workflow

## Day-to-day loop

1. Run the API locally.
2. Run the relevant tests.
3. Update API reference docs when HTTP behavior changes.
4. Update developer docs when code shape, business rules, or operating model changes.
5. Update OpenSpec when requirements or behaviors change materially.

## Quality gates

Primary repo validation commands:

```bash
npm run check:biome
npm run check
npm run test:api
npm run docs:lint
```

Add `npm run test:integration` when persistence-heavy behavior changes.

## Documentation rules

- Scalar/OpenAPI is the source of truth for endpoint contracts.
- Docusaurus is the source of truth for internal developer guidance.
- OpenSpec is the source of truth for accepted platform requirements.

## When to update which docs

- endpoint or schema change: OpenAPI
- internal architecture or business rule clarification: Docusaurus
- requirement or workflow contract change: OpenSpec
