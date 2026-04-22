---
title: Operations Module
---

# Operations Module

## Purpose

Aggregates operator-facing review queues, alerts, audit feeds, rate-limit
events, and scan/retry workflows.

## Key responsibilities

- list review items
- persist and expose audit events
- persist and expose alerts
- run operational scans
- retry stalled settlement workflows

## Important note

Today these routes are still bootstrap-token protected. They represent operator
surfaces, but not full RBAC yet.
