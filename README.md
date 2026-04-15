# hyperwood

Prediction market API skeleton focused on the day-1 `identity-and-access` foundation.

## Stack

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM

## Identity foundation included

- user registration with password identity
- password login with opaque session tokens
- linking a password identity to an existing user record
- scoped API key creation for authenticated users

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Run the server with `npm run dev`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run db:generate`
- `npm run db:migrate`

## Initial routes

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/api-keys`
- `POST /api/v1/internal/auth/link-existing-user`

The internal link route requires the `x-bootstrap-token` header matching `INTERNAL_BOOTSTRAP_TOKEN`.

