# Windows Manual Validation Checklist

Use this checklist before calling the current StarLine build an MVP release candidate.

## Preflight

From the workspace root:

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm --dir apps/desktop-ui tauri:check`

## Dev Desktop Flow

From `apps/desktop-ui`:

- [ ] Run `pnpm tauri:dev`
- [ ] Desktop shell launches
- [ ] Local API auto-starts
- [ ] UI reaches ready state
- [ ] `http://127.0.0.1:3001/health` returns `200`

## Projects Flow

- [ ] Open `Projects`
- [ ] Create a project
- [ ] Open project detail
- [ ] Archive flow still works

## Assets Flow

- [ ] Open `Assets`
- [ ] Import a local file
- [ ] Search/filter returns the expected asset
- [ ] Project-scoped asset filtering still works

## Connectors Flow

- [ ] Open `Connectors`
- [ ] `stable-diffusion` settings load
- [ ] `minimax` settings load
- [ ] Save connector config succeeds
- [ ] Test connector succeeds when the target is available

## Generation Flow

- [ ] Submit a generation job through an available connector
- [ ] Job reaches a terminal state
- [ ] Output is persisted into the asset library

## Agent Flow

- [ ] Open `Agent`
- [ ] Submit a query
- [ ] Transcript persists
- [ ] Related assets are shown

## Analytics Flow

- [ ] Open `Analytics`
- [ ] Overview cards load
- [ ] Latest event timestamp loads
- [ ] `7D`, `14D`, and `30D` range switching works
- [ ] Connector mix panel renders without error

## Packaged Desktop Flow

From the workspace root:

- [ ] Run `pnpm --dir apps/desktop-ui tauri:build:minimal`
- [ ] Launch `apps/desktop-ui/src-tauri/target/release/starline-desktop-shell.exe`
- [ ] Packaged local API auto-starts
- [ ] `Projects`, `Assets`, `Connectors`, `Agent`, and `Analytics` are usable

## Release Decision

- [ ] Automated verification passed
- [ ] Manual desktop validation passed
- [ ] Remaining deferred items are explicitly accepted
- [ ] Final pass/fail result is recorded with date and tester
