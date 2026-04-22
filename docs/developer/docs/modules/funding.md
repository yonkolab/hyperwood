---
title: Funding Module
---

# Funding Module

## Purpose

Owns funding methods, wallet balances, deposits, withdrawals, webhook handling,
reconciliation, and delay alerts.

## Main collaborators

- funding method catalog
- wallet ledger service
- deposit and withdrawal workflow services
- webhook workflow service
- reconciliation and delay-alert services

## Relevant schema families

- `funding`
- `operations`

## Key invariants

- balances are ledger-derived
- provider callbacks must be verified before side effects
- reconciliation discrepancies and delayed callbacks create operational signals
