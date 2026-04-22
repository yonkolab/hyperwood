---
title: Portfolio Module
---

# Portfolio Module

## Purpose

Provides user-facing read models for balances, fills, settlements, exports,
historical orders, and private account realtime updates.

## Key boundary

Portfolio is read-model oriented. It should not own order lifecycle or funding
mutation logic.

## Side effects

- account stream publishes balance, transfer, fill, and settlement updates
- export jobs expose historical account data snapshots
