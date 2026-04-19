# StarLine

[中文说明 / Chinese README](./README.md)

StarLine is a Windows local-first workspace for AI creators. It is designed to unify project management, asset organization, model connectors, generation jobs, agent assistance, and local analytics in one desktop application.

The current repository corresponds to the `v1.0` release line. The MVP focus is to make the product runnable locally, usable on desktop, and complete across the core workflows, rather than turning it into a cloud-first or collaboration-heavy platform at this stage.

## Core Features

- Project management: create, inspect, update, and archive projects.
- Local asset management: import local files, deduplicate, index, search, and filter them.
- Multi-platform connector access: currently supports `MiniMax` and `Stable Diffusion` in `v1.0`.
- Async generation jobs: submit, inspect, cancel, retry, recover, and track basic metrics.
- Agent workspace: retrieval-backed suggestion conversations based on local projects and assets, with persisted sessions.
- Local analytics dashboard: includes event ingestion, aggregation APIs, and a desktop analytics page.
- Windows local-first runtime: built with `Tauri + React + Fastify + SQLite` and packaged for standalone local use.
- Multilingual UI: the desktop app currently supports Simplified Chinese and English.

## Use Cases

- Manage assets and generated outputs across multiple personal AI creation projects
- Get retrieval-augmented agent suggestions based on existing AI creation assets, including generated images, videos, prompts, and related materials
- Manage AI creation assets across multiple cloud platforms in later versions

## Tech Stack

- Desktop shell: `Tauri`
- Frontend: `React + TypeScript + TanStack Query`
- Local backend: `Fastify`
- Database: `SQLite + FTS5`
- Shared packages: `pnpm workspace`

## Repository Layout

```text
apps/
  desktop-ui/   Tauri desktop app and React frontend
  local-api/    Local Fastify API for business logic and database access

packages/
  domain/       Domain services
  shared/       Shared types and schemas
  storage/      SQLite schema, repositories, and migrations
```

## Current MVP Coverage

- Monorepo skeleton and desktop app boot flow
- Project CRUD
- Asset import, deduplication, indexing, search, and filters
- MiniMax connector
- Stable Diffusion connector
- Generation job lifecycle
- Basic Agent query MVP
- Local analytics pipeline and dashboard MVP

## Quick Start

See [docs/quickstart.md](./docs/quickstart.md) for the full setup guide.

Common commands:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --dir apps/desktop-ui tauri:dev
```

Build the minimal release package:

```bash
pnpm --dir apps/desktop-ui tauri:build:minimal
```

## Runtime Architecture

StarLine is not just a frontend shell. It consists of two runtime layers:

- `desktop-ui`: responsible for UI, interactions, and state presentation
- `local-api`: responsible for the local database, business logic, connector calls, agent queries, and analytics aggregation

In packaged mode, the desktop app launches the local API first and then communicates with it through local HTTP endpoints. This keeps the UI separated from the workflow and data layers, and makes testing, extension, and packaging behavior more stable.

## Documentation

- [Quick Start](./docs/quickstart.md)
- [Agent Query MVP](./docs/agent-query-mvp.md)
- [Analytics Events MVP](./docs/analytics-events-mvp.md)
- [Analytics Aggregation MVP](./docs/analytics-aggregation-mvp.md)
- [Analytics API MVP](./docs/analytics-api-mvp.md)
- [Analytics Dashboard MVP](./docs/analytics-dashboard-mvp.md)
- [Windows Manual Validation Checklist](./docs/windows-manual-validation-checklist.md)
- [MVP Acceptance Report](./docs/mvp-acceptance-report.md)
- [v1.0.0 Release Notes](./docs/v1.0.0-release-notes.md)

## Current Boundaries

`v1.0` is still an MVP and does not include:

- enterprise multi-tenancy / RBAC
- mobile apps
- full billing systems
- in-house model training
- real-time collaboration

Those directions belong to later versions rather than the current local-first MVP stage.
