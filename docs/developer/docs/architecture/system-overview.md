---
title: System Overview
---

# System Overview

Hyperwood is a backend-first prediction market platform with:

- session and API-key authentication
- compliance gating
- funding and internal ledger accounting
- order entry and matching
- market resolution and settlement
- operator review, audit, and alerting workflows

## Main runtime surfaces

- public REST endpoints for market and exchange data
- authenticated user endpoints for funding, trading, and portfolio state
- internal control-plane endpoints protected by bootstrap auth
- SSE streams for public market and private account updates

## Main subsystems

- `identity`: login, sessions, MFA, API keys
- `compliance`: restrictions and capability evaluation
- `funding`: methods, deposits, withdrawals, reconciliation, provider callbacks
- `orders` and `matching`: order lifecycle and trade execution
- `markets`: catalog, order book, announcements, resolution, settlement
- `portfolio`: user-facing history, balances, fills, settlements, exports
- `operations`: review queues, audit, rate-limit events, alerts, scans

## System style

The repo is organized around domain modules, not technical layers alone. Route
files stay thin and delegate to module services and workflow services.
