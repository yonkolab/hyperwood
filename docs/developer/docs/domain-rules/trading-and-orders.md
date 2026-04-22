---
title: Trading and Order Rules
---

# Trading and Order Rules

## Order lifecycle

- create
- amend
- cancel
- match
- settle downstream through market settlement

## Key rules

- order creation requires an idempotency key
- exchange schedule can block new order entry
- reservation/release logic updates user balances
- matching emits market and account realtime events

## Boundary

The `orders` module owns order lifecycle commands. The `portfolio` module owns
user-facing historical and reporting read models.
