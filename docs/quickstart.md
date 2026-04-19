# Quickstart

This is the shortest path to run the StarLine MVP locally on Windows and validate the core product flow.

## Prerequisites

- Windows
- Node.js `>= 20`
- `pnpm >= 9`
- Rust toolchain for Tauri desktop validation

Optional for real connector validation:
- Stable Diffusion WebUI running locally
- MiniMax API key

## Install

From the workspace root:

```powershell
pnpm install
```

## Core Verification

From the workspace root:

```powershell
pnpm typecheck
pnpm test
pnpm --dir apps/desktop-ui tauri:check
```

## Run Desktop App

From `apps/desktop-ui`:

```powershell
pnpm tauri:dev
```

Expected behavior:
- the desktop shell launches
- the local API auto-starts
- the UI leaves the startup wait state

## Core MVP Flow

### Projects

- open `Projects`
- create a project
- open project detail

### Assets

- open `Assets`
- import a local file
- search or filter the imported asset

### Connectors

- open `Connectors`
- configure `stable-diffusion` or `minimax`
- run `Test Connector`

### Agent

- open `Agent`
- choose a project scope if needed
- ask a question
- confirm the session transcript and related assets appear

### Analytics

- open `Analytics`
- confirm overview cards load
- confirm recent usage data renders for the selected date preset

## Packaged Desktop Check

From the workspace root:

```powershell
pnpm --dir apps/desktop-ui tauri:build:minimal
```

Expected artifact:
- `apps/desktop-ui/src-tauri/target/release/starline-desktop-shell.exe`

## Related Docs

- [windows-manual-validation-checklist.md](./windows-manual-validation-checklist.md)
- [mvp-acceptance-report.md](./mvp-acceptance-report.md)
