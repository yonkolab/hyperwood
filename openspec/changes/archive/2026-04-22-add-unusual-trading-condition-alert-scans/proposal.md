## Why

Hyperwood still lacks a concrete alert source for unusual trading conditions, which remains an explicit requirement in platform-security-and-observability. The cleanest current signal is a crossed resting book on an active market, because matching should clear crossable resting orders.

## What Changes

- add an internal trading-condition scan endpoint
- detect active markets with crossed resting books
- persist critical operational alerts for affected markets
- document and test the scan workflow

## Impact

- closes the unusual trading condition alerting gap in platform-security-and-observability
- gives operators a deterministic internal scan path for matching backlog or inconsistent market state
