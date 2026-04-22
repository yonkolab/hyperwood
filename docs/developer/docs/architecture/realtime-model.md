---
title: Realtime Model
---

# Realtime Model

Hyperwood currently uses SSE, not WebSockets.

## Streams

- public market stream: market detail, book updates, trades, announcements
- private account stream: portfolio, fills, settlements, transfer and balance updates

## Why SSE

- simpler one-way delivery model
- enough for current platform state propagation
- easier operational model than bidirectional sockets

## Operational implication

The platform has stream-health alerting for stale subscriptions. That is why
the security/observability spec talks about outage-style alerting even though
the transport is SSE rather than WebSocket.
