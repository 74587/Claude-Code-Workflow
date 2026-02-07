# CCW Frontend 功能盘点 & 前后端对齐审计

日期：2026-02-07  
范围：`ccw/frontend`（前端）对比 `ccw/src`（后端 Dashboard Server 路由）

## 1) 前端现有功能（路由/页面）

路由定义：`ccw/frontend/src/router.tsx`

已接入的主要页面：
- Sessions：`/sessions`、`/sessions/:sessionId`
- Session Detail：`/sessions/:sessionId/*`（tasks/context/summary/impl-plan/review 等）
- Lite Tasks：`/lite-tasks`
- Orchestrator：`/orchestrator`
- Issues Hub：`/issues`（含 legacy redirect：`/issues/queue`、`/issues/discovery`）
- Skills / Commands / Memory / Prompt History：`/skills`、`/commands`、`/memory`、`/prompts`
- Settings：`/settings`（含 MCP/Endpoints/Installations/Rules/CodexLens 子页）、`/api-settings`
- Hooks：`/hooks`
- Explorer / Graph：`/explorer`、`/graph`
- CLI Viewer：`/cli-viewer`

路由摘录文件（自动生成）：  
`ccw/frontend/.workflow/.lite-plan/frontend-feature-audit-2026-02-07/frontend-routes.extract.md`

## 2) 前端未开发/未打通功能（可直接定位的 TODO / 占位实现）

以下为“代码中明确标注 TODO 或明显占位”的点（不代表全部缺口）：

- 统计图相关（后端接口缺失）
  - Activity Timeline：`ccw/frontend/src/hooks/useActivityTimeline.ts` 使用 `/api/activity-timeline`（后端未实现）
  - Task Type Counts：`ccw/frontend/src/hooks/useTaskTypeCounts.ts` 使用 `/api/task-type-counts`（后端未实现）
- Dashboard 个性化布局“后端同步”未实现
  - `ccw/frontend/src/hooks/useUserDashboardLayout.ts` 仅 localStorage/Zustand，注释了 `/api/user/dashboard-layout`
- Dashboard 趋势火花线为 mock
  - `ccw/frontend/src/components/dashboard/widgets/DetailedStatsWidget.tsx` sparkline 为随机生成
- Config Sync 备份列表 UI 未实现
  - `ccw/frontend/src/components/shared/ConfigSync.tsx` 备份列表 `_backupList` 仅加载、未展示
- CLI Stream Monitor
  - `ccw/frontend/src/components/shared/CliStreamMonitor/CliStreamMonitorNew.tsx`：存在 “retry logic” TODO
  - `ccw/frontend/src/components/shared/LogBlock/LogBlockList.tsx`：re-run 功能 TODO
- WorkspaceSelector 手动路径校验提示 TODO
  - `ccw/frontend/src/components/workspace/WorkspaceSelector.tsx`

## 3) API 端点对齐：前端引用 vs 后端实现（核心差异）

本次对比方式：
- 从前端 `ccw/frontend/src` 抽取 `/api/...` 字面量引用
- 从后端 `ccw/src` 抽取 `/api/...` 字面量引用
- 做“路径集合”层面的存在性对比（**注意：不能覆盖 method/参数/返回结构的差异**）

自动生成的原始清单：
- 前端端点全集：`ccw/frontend/.workflow/.lite-plan/frontend-feature-audit-2026-02-07/frontend-api-endpoints.txt`
- 后端端点全集：`ccw/frontend/.workflow/.lite-plan/frontend-feature-audit-2026-02-07/backend-api-endpoints.txt`
- 前端存在、后端缺失：`ccw/frontend/.workflow/.lite-plan/frontend-feature-audit-2026-02-07/endpoints-missing-in-backend.txt`
- 缺失端点引用定位：`ccw/frontend/.workflow/.lite-plan/frontend-feature-audit-2026-02-07/missing-endpoints.references.md`

### 3.1 前端引用但后端未实现的关键端点（会导致页面/功能不可用）

（以“影响面 + 出现频率”为优先）

- Graph Explorer 依赖图：`/api/graph/dependencies`
  - 前端：`ccw/frontend/src/hooks/useGraphData.ts`、`ccw/frontend/src/lib/api.ts`
  - 后端：存在 `/api/graph/nodes`、`/api/graph/edges`、`/api/graph/files`、`/api/graph/impact`，但**无** `/api/graph/dependencies`
- File Explorer：`/api/explorer/*`（tree/file/search/roots）
  - 前端：`ccw/frontend/src/hooks/useFileExplorer.ts`、`ccw/frontend/src/lib/api.ts`
  - 后端：实现的是 `/api/files` 与 `/api/file-content`（见 `ccw/src/core/routes/files-routes.ts`），路径/返回结构均不一致
- Sessions CRUD：`/api/sessions*`
  - 前端：`ccw/frontend/src/lib/api.ts`（`fetchSession/createSession/updateSession/archiveSession/deleteSession` 等）
  - 后端：当前 Session 路由只实现了 `/api/session-detail`、`/api/update-task-status`、`/api/bulk-update-task-status`（见 `ccw/src/core/routes/session-routes.ts`），**无** `/api/sessions`
- Hooks 增删改模板化端点：`/api/hooks/create`、`/api/hooks/update`、`/api/hooks/delete/*`、`/api/hooks/install-template`
  - 后端仅实现：`GET/POST/DELETE /api/hooks`（见 `ccw/src/core/routes/hooks-routes.ts`）
- Index 管理：`/api/index/status`、`/api/index/rebuild`
  - 后端没有 `/api/index/*`，CodexLens 的 index/status 体系在 `/api/codexlens/*`（见 `ccw/src/core/routes/codexlens/index-handlers.ts`）
- 其他明显缺口：
  - `/api/activity-timeline`、`/api/task-type-counts`（统计图）
  - `/api/fix-progress`（ReviewSessionPage 使用）
  - `/api/cli/installations`、`/api/cli/history/tool/*`

### 3.2 “接口已改名/已迁移”的对齐风险（端点存在但路径/方法/结构不一致）

以下属于“端点看似缺失，但实际上后端以其它路径提供类似能力”：

- Commands groups config：
  - 前端：`/api/commands/groups/config`（`ccw/frontend/src/lib/api.ts:getCommandsGroupsConfig`）
  - 后端：`/api/commands/groups`（GET/PUT，见 `ccw/src/core/routes/commands-routes.ts`）
- Memory insights analyze：
  - 前端：`/api/memory/analyze`（`ccw/frontend/src/lib/api.ts:analyzePrompts`）
  - 后端：`/api/memory/insights/analyze`（见 `ccw/src/core/routes/memory-routes.ts`）
  - 且请求/响应结构也不同：后端需要 `prompts[]`，返回 `{ success, insights, tool, executionId }`

## 4) 数据结构对齐检查（已发现的“真实 schema 差异”示例）

### 4.1 `/api/data` 的 session.created_at 可能为 null

- 后端聚合：`ccw/src/core/data-aggregator.ts` 中 `created_at: session.created || session.created_at || null`
- 前端类型：`ccw/frontend/src/lib/api.ts` 的 `BackendSessionData.created_at` 当前写死为 `string`，且 `SessionMetadata.created_at` 在 `ccw/frontend/src/types/store.ts` 为必填 `string`

风险：某些 session 的 `created_at` 为空时，前端 UI 的排序/时间格式化可能出现异常或渲染错误。

## 5) 建议的落地路线（按收益/风险排序）

1) **先做“兼容层”**（推荐）
   - 在后端补一组兼容端点（或在前端统一重定向到现有端点），优先打通：
     - File Explorer：`/api/explorer/*` ↔ `/api/files` + `/api/file-content`
     - Graph Explorer：提供 `/api/graph/dependencies`（聚合 nodes/edges/files）
     - Sessions：实现 `/api/sessions*`（至少 archive/delete），或让前端完全基于 `/api/data` + `/api/session-detail`
2) **统计图端点明确归属**
   - 若后端短期不做：前端用 `/api/data` 在客户端计算 timeline/type counts（并显式标注来源/准确性限制）
3) **Hooks / Prompt History / Index 三块做“接口契约重构”**
   - 这三块目前存在“路径 + method + schema”多重不一致，需要先定契约，再统一实现。

---

如果你希望我“直接修复对齐”（而不仅是出报告），我建议按下面顺序做最小可用：
1) 后端实现 `/api/graph/dependencies`（GraphExplorer 立即可用）
2) 后端实现 `/api/explorer/file`（先打通预览），再补 `/api/explorer/tree`
3) 统一 Commands groups、Memory analyze 的端点/请求结构
4) Sessions archive/delete 的最小实现

