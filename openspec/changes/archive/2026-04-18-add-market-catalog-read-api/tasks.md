## 1. Spec Update

- [x] 1.1 Add a delta spec for the first executable market catalog read APIs.
- [x] 1.2 Define the initial event and market fields needed for catalog listing and detail views.

## 2. Implementation

- [x] 2.1 Add event and market persistence with lifecycle status, pricing, timeline, and metadata fields.
- [x] 2.2 Add internal bootstrap routes to create events and markets.
- [x] 2.3 Add public routes to list markets and fetch market detail.

## 3. Validation

- [x] 3.1 Generate the schema migration for the new market tables.
- [x] 3.2 Run `openspec validate`, `npm run check`, and `npm run build`.
