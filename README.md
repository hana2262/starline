# StarLine

[English README](./README_en.md)

StarLine 是一个面向 AI 创作者的 Windows 本地优先工作台，用来统一管理项目、素材、模型连接器、生成任务、Agent 辅助能力和本地分析数据。

当前仓库对应的 `v1.0` 已完成 MVP 主线，重点是把“本地可运行、桌面可用、核心链路打通”作为第一目标，而不是做云端化或团队协作平台。

## 核心特性

- 项目管理：支持项目创建、查看详情、更新和归档。
- 本地资产管理：支持本地文件导入、去重、索引、检索和筛选。
- 接入多个平台：当前已支持 `MiniMax` 与 `Stable Diffusion`。（v1.0）
- 异步生成任务：支持提交、查询、取消、重试、恢复和基础指标。
- Agent 工作台：支持基于本地项目和资产检索的建议式对话，并持久化 session。
- 本地分析面板：支持事件采集、聚合 API 和桌面端分析页面。
- Windows 本地优先：基于 `Tauri + React + Fastify + SQLite`，打包后可在本机独立运行。
- 多语言支持：当前桌面端支持简体中文与 English 切换。

## 适用场景

- 个人 AI 创作者统一管理不同项目下的素材与生成结果
- 基于已有的ai创作资产（包括生成图片，视频，提示词等）快速获得 Agent 检索增强建议
- 云端多平台管理ai创作资产（后续计划开发）

## 技术栈

- Desktop shell: `Tauri`
- Frontend: `React + TypeScript + TanStack Query`
- Local backend: `Fastify`
- Database: `SQLite + FTS5`
- Shared packages: `pnpm workspace`

## 仓库结构

```text
apps/
  desktop-ui/   Tauri 桌面应用与 React 前端
  local-api/    本地 Fastify API，负责业务逻辑与数据库访问

packages/
  domain/       领域服务
  shared/       共享类型与 schema
  storage/      SQLite schema、repository、migration
```

## 当前 MVP 已完成内容

- Monorepo skeleton 与桌面应用启动链路
- Project CRUD
- Asset import、去重、索引与搜索/筛选
- MiniMax connector
- Stable Diffusion connector
- Generation job lifecycle
- Basic Agent query MVP
- Local analytics pipeline 与 dashboard MVP

## 快速开始

详细步骤见 [docs/quickstart.md](./docs/quickstart.md)。

常用命令示例：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --dir apps/desktop-ui tauri:dev
```

打包最小发布版：

```bash
pnpm --dir apps/desktop-ui tauri:build:minimal
```

## 运行架构说明

StarLine 不是“纯前端桌面壳”。它由两部分组成：

- `desktop-ui`：负责界面、交互和状态展示
- `local-api`：负责本地数据库、业务逻辑、连接器调用、Agent 查询和 analytics 聚合

打包版启动后，桌面端会先拉起本地 API，再通过本地 HTTP 接口进行通信。这种结构让 UI 与业务逻辑保持分层，也让测试、扩展和打包行为更稳定。

## 主要文档

- [Quick Start](./docs/quickstart.md)
- [Agent Query MVP](./docs/agent-query-mvp.md)
- [Analytics Events MVP](./docs/analytics-events-mvp.md)
- [Analytics Aggregation MVP](./docs/analytics-aggregation-mvp.md)
- [Analytics API MVP](./docs/analytics-api-mvp.md)
- [Analytics Dashboard MVP](./docs/analytics-dashboard-mvp.md)
- [Windows Manual Validation Checklist](./docs/windows-manual-validation-checklist.md)
- [MVP Acceptance Report](./docs/mvp-acceptance-report.md)
- [v1.0.0 Release Notes](./docs/v1.0.0-release-notes.md)

## 当前边界

`v1.0` 仍然是 MVP，不包含以下方向：

- 企业多租户 / RBAC
- 移动端 App
- 完整计费系统
- 自研模型训练
- 实时协作

这些能力会放到后续版本，而不是在当前本地优先 MVP 阶段完成。

