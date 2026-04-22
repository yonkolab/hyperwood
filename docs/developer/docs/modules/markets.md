---
title: Markets Module
---

# Markets Module

## Purpose

Owns market catalog reads, announcements, lifecycle transitions, public
realtime, resolution, settlement, historical trades, and candles.

## Route surface

- public market reads
- public market stream
- internal creation and administration
- internal resolution and settlement

## Key invariants

- market status changes are explicit administrative actions
- resolution is distinct from settlement
- historical data paths diverge from live market paths after archival boundaries
