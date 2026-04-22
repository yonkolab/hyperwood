---
title: Persistence and Ledger
---

# Persistence and Ledger

PostgreSQL is the system of record. Drizzle schemas live under `src/db/schema`.

## Schema families

- `users`: user, session, MFA, API key state
- `compliance`: profiles and restrictions
- `funding`: funding methods, transfers, wallet accounts, ledger entries
- `orders` and `matching`: orders, fills, market commands, order book state
- `markets`: events, markets, resolutions, settlements, announcements
- `operations`: audit, alerts, rate-limit events, review surfaces
- `historical`: exported historical data artifacts

## Ledger model

Funding and balance changes are not tracked as simple mutable counters. The
system derives balances from wallet and ledger entries, which is why invariant
scans exist for:

- imbalanced transactions
- negative user wallet balances

:::note PT-BR
“Ledger” aqui significa o razão contábil interno da plataforma, não apenas um
saldo agregado por usuário.
:::
