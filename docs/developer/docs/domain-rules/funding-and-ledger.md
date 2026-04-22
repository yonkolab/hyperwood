---
title: Funding and Ledger Rules
---

# Funding and Ledger Rules

Funding is more than deposits and withdrawals.

## Core rules

- supported payment methods depend on jurisdiction and capability policy
- deposits and withdrawals move through explicit transfer states
- wallet balances are ledger-derived
- reconciliation can detect missing or mismatched transfer states
- delayed provider callbacks create operator alerts

## Invariants

- ledger transactions should balance
- user-owned wallet balances should not drift negative without a modeled reason
- provider-backed transfers must converge to terminal states

:::note PT-BR
“Payment methods” aqui é o termo preferido para legibilidade do time, no lugar
de “rails”, embora o conceito seja o mesmo no contexto de pagamentos.
:::
