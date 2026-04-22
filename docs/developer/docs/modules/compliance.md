---
title: Compliance Module
---

# Compliance Module

## Purpose

Calculates whether a user can fund or trade and manages internal compliance
state such as profiles and restrictions.

## Route surface

- user capability read
- internal profile upsert
- internal restriction write

## Key invariants

- capability evaluation is the gating layer, not a UI hint
- unresolved restrictions must surface into operator review workflows
