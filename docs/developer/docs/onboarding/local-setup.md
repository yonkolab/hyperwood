---
title: Local Setup
---

# Local Setup

Hyperwood has three local surfaces:

- API backend
- PostgreSQL
- developer docs

## Main commands

```bash
npm install
npm run db:migrate
npm run dev
```

Docs surfaces:

```bash
npm run docs:preview
npm run docs:dev:start
```

## Docker workflow

For a containerized local stack:

```bash
npm run docker:local:up
```

That brings up:

- `db` on `localhost:5432`
- `api` on `localhost:3000`
- `docs` on `localhost:3001`

## Environment files

Copy `.env.example` to `.env` and review:

- database URL
- auth/session settings
- bootstrap token
- docs port and API-reference URL

## What each docs surface does

- `docs:preview`: Scalar/OpenAPI reference on port `8081`
- `docs:dev:start`: Docusaurus developer docs on port `3001`

Scalar stays focused on HTTP reference. Docusaurus is for internal engineering
knowledge.
