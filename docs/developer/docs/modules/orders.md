---
title: Orders Module
---

# Orders Module

## Purpose

Handles order entry, amendment, cancellation, reservation changes, and market
command recording.

## Route surface

- create order
- cancel order
- amend order

## Main collaborators

- funding for balance refresh
- markets for order-book snapshots
- matching for downstream execution
- account and market realtime services

## Key invariants

- order submission is idempotent
- order mutations must keep reservation state coherent
