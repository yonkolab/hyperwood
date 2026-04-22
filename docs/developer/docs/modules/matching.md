---
title: Matching Module
---

# Matching Module

## Purpose

Runs internal matching on eligible orders and applies trade-side ledger effects.

## Main collaborators

- matchable order queries
- trade planning
- settlement ledger application
- market command sequencing

## Key invariants

- matching is blocked when the exchange is closed
- fills and order-book updates must stay sequence-consistent
