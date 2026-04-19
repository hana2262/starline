# Analytics API MVP

## Scope

This document describes the D3 analytics slice for StarLine.

Included:
- `GET /api/analytics/overview`
- `GET /api/analytics/usage`
- API-level validation and error handling for invalid usage ranges

Not included:
- analytics dashboard UI
- project-scoped analytics filters
- connector-level usage breakdown
- export/report features

## Endpoints

### `GET /api/analytics/overview`

Returns all-time analytics totals aggregated from the local `events` table.

Current response includes:
- total projects created
- total assets imported
- total agent queries
- total generation submitted/completed/failed/cancelled
- generation totals grouped by connector id
- latest event timestamp

### `GET /api/analytics/usage`

Query params:
- `from`
- `to`

Returns inclusive UTC day buckets aggregated from the local `events` table.

Current response includes:
- explicit `from`
- explicit `to`
- `points`
- per-day counts for:
  - projects created
  - assets imported
  - agent queries
  - generation submitted/completed/failed/cancelled

## Validation Rules

- both endpoints are read-only
- `usage` input is validated through shared Zod schemas
- invalid ranges where `from > to` return `400`
- analytics service errors are mapped through the local API error handler

## Known Limits

- no analytics desktop page yet
- no project filter yet
- no connector breakdown in usage points yet
- overview remains all-time only in this phase
