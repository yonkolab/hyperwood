---
title: Docs Map
---

# Docs Map

## Documentation layers

### 1. Developer Docs

This Docusaurus site explains:

- why the system is shaped the way it is
- how modules interact
- business rules and invariants
- operator workflows and runtime expectations

### 2. Guides

The existing Markdown guides are mounted under `/guides`. They cover narrower
integration topics such as:

- authentication
- realtime
- rate limits
- webhooks
- errors

### 3. API Reference

Scalar renders the bundled OpenAPI spec and should be used for:

- paths
- payloads
- query parameters
- response shapes

### 4. Canonical Specs

OpenSpec under `/specs` captures the accepted requirements that drove the
implemented behavior.
