# Analytics Events MVP

## Scope

This document describes the D1 analytics slice for StarLine.

Included:
- local `events` table
- event repository for structured writes
- event writes from core domain services

Not included:
- aggregate analytics service
- analytics read APIs
- analytics dashboard UI
- remote telemetry export

## Event Model

Table: `events`

Fields:
- `id`
- `eventType`
- `entityType`
- `entityId`
- `projectId`
- `payload`
- `createdAt`

Indexes:
- `events_event_type_created_idx`
- `events_project_created_idx`

## Event Types In Scope

- `project.created`
- `asset.imported`
- `generation.submitted`
- `generation.completed`
- `generation.failed`
- `generation.cancelled`
- `agent.queried`

## Write Rules

- routes do not write analytics events directly
- events are emitted from domain services after the business action succeeds
- failed writes do not introduce a new public API surface in this phase
- payload stays intentionally small and JSON-based so D2 can aggregate without needing another schema migration first

## Current Payload Shape

Examples:

- `project.created`
  - `status`
- `asset.imported`
  - `type`
  - `fileSize`
  - `mimeType`
  - `source`
- `generation.submitted`
  - `connectorId`
  - `type`
- `generation.completed`
  - `connectorId`
  - `type`
  - `assetId`
- `generation.failed`
  - `connectorId`
  - `type`
  - `errorCode`
  - `retryable`
- `generation.cancelled`
  - `connectorId`
  - `type`
  - `cancelReason`
- `agent.queried`
  - `relatedAssetCount`
  - `queryLength`

## Known Limits

- no event read API yet
- no aggregation layer yet
- event payloads are stable enough for MVP work, but not yet versioned
- only the core MVP actions above emit events in this phase
