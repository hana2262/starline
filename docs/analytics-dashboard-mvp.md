# Analytics Dashboard MVP

## Scope

This document describes the D4 analytics slice for StarLine.

Included:
- desktop navigation entry for `Analytics`
- local analytics overview cards
- recent usage activity panel with selectable 7/14/30 day ranges
- generation outcome and connector mix panels

Not included:
- advanced charting libraries
- project-scoped filters
- export/download flows
- drill-down from analytics into individual jobs or assets

## Current UI Sections

- overview cards for:
  - projects
  - assets
  - agent queries
  - generation submissions
- latest event timestamp
- recent local activity list using `GET /api/analytics/usage`
- generation outcome summary
- connector-level generation mix using `GET /api/analytics/overview`

## UX Rules

- dashboard reads local analytics APIs only
- date ranges are preset to `7D`, `14D`, and `30D`
- empty states are explicit when no analytics events exist yet
- the page stays read-only in this phase

## Known Limits

- no chart export
- no custom date picker
- no project filter
- no deep links back into project, asset, or generation detail views
