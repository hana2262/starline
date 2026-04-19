# Analytics Aggregation MVP

## Scope

This document describes the D2 analytics slice for StarLine.

Included:
- domain analytics aggregation service
- overview aggregation from local event rows
- usage aggregation by day across a requested date range

Not included:
- dashboard UI
- advanced segmentation

## Service Outputs

### Overview

Current overview shape:
- total projects created
- total assets imported
- total agent queries
- total generation submitted/completed/failed/cancelled
- generation aggregates grouped by connector
- latest event timestamp

### Usage

Current usage shape:
- explicit `from`
- explicit `to`
- daily points between the two dates, inclusive
- per-day counts for:
  - projects created
  - assets imported
  - agent queries
  - generation submitted/completed/failed/cancelled

## Aggregation Rules

- aggregation reads from the local `events` table only
- usage buckets are grouped by UTC day using the event `createdAt` timestamp
- missing days are still returned as zero-value points
- invalid ranges where `from > to` are rejected

## Known Limits

- no analytics desktop page yet
- no project-level filter yet
- no connector breakdown in usage points yet
- overview is all-time only in this phase
