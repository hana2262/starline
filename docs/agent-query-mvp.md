# Agent Query MVP

## Scope

This document describes the current Agent MVP slice for StarLine.

Included:
- local session persistence
- local message persistence
- retrieval-backed suggestions using project and asset context
- API endpoints for query and session retrieval
- desktop Agent page for asking questions, reviewing transcript, and seeing related assets

Not included:
- streaming responses
- external LLM integration
- autonomous multi-step execution

## API

### `POST /api/agent/query`

Request body:

```json
{
  "sessionId": "optional-existing-session-id",
  "projectId": "optional-project-id",
  "query": "Help me refine the neon astronaut poster direction"
}
```

Behavior:
- creates a new session when `sessionId` is omitted
- reuses an existing session when `sessionId` is provided
- binds the session to `projectId` when present
- stores both the user message and assistant reply locally
- retrieves up to 5 related assets from the local library
- falls back to recent project/global assets when direct text search returns no matches

Response shape:
- `session`
- `userMessage`
- `assistantMessage`
- `relatedAssets`
- `project`

### `GET /api/agent/sessions/:id`

Behavior:
- returns the persisted session
- returns all stored messages in chronological order
- returns related assets referenced by prior assistant replies

## Desktop UI

Current desktop support:
- top-level `Agent` navigation entry
- project scope selector before a session starts
- local transcript view for user and assistant messages
- related asset sidebar based on the current session
- session reload by persisted `sessionId`

Current limits:
- no session list/history browser yet
- once a session starts, project scope stays fixed for that session
- no inline asset preview or asset detail deep-link yet

## Retrieval Rules

- direct retrieval uses the existing local asset search path
- search can be scoped to a project when the session has `projectId`
- when direct search returns no match, the service falls back to recent local assets in the same project, or the full library when no project is bound
- the current reply is deterministic and template-based; it does not call an external model

## Storage

New local tables:
- `agent_sessions`
- `agent_messages`

Persisted fields:
- session title and project binding
- user/assistant role
- message content
- referenced asset ids for assistant replies

## Known Limits

- suggestions are retrieval-backed, but not model-generated
- session listing is not implemented yet
- project mismatch across an existing session and a new `projectId` request returns a conflict
- no UI is shipped in this slice; the feature is currently API-accessible only
