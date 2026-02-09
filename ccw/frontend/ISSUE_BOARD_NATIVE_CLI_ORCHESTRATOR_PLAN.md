# CCW Issue 看板 × 原生 CLI 窗口 × 队列管理 × 编排器（tmux-like）集成规划

日期：2026-02-09  
输入参考：`.workflow/.analysis/ANL-codemoss-issue-panel-2026-02-09/report.md`（CodeMoss 看板/会话机制）

## 0) 已确认的关键决策（来自本次讨论）

- **终端形态**：Web 内嵌终端（`xterm.js`）+ 后端 **PTY**（需要 TTY 行为）
- **默认会话壳**：先启动 `bash`（在 Windows 下优先走 WSL bash，其次 Git-Bash；都不可用时再降级）
- **连续性**：用 `resumeKey` 作为“逻辑会话键”（可映射到 CLI 的 `--resume/--continue/--session-id` 等）
- **Queue 增强优先级**：先做 **执行面**（Queue item → 投递到某个 CLI 会话并执行），管理面后置
- **resumeKey 映射**：两种策略都要支持（`nativeResume` 与 `promptConcat`，见 4.6）

## 1) 要做的“产品形态”（一句话）

把 CCW 的 `Issues + Queue + Orchestrator + CLI Viewer` 变成一个统一的 **Issue Workbench**：

- 中间：Issue 看板（Kanban）+ Queue 管理（可视化/可执行/可重排）
- 右侧：可切换的 **CLI 会话窗口**（Claude/Codex/Gemini/…），Web 内嵌终端承载，能向不同会话发送消息/命令
- 编排器：能把节点输出/指令 **路由** 到某个 CLI 会话（类似 tmux 的 send-keys 到某个 pane / session）

---

## 2) 当前 CCW 已具备的关键底座（可直接复用）

### 2.1 IssueHub 的“右侧抽屉”模式

- IssueHub tabs：`ccw/frontend/src/components/issue/hub/IssueHubTabs.tsx`（目前：issues/queue/discovery）
- IssueDrawer（右侧抽屉 + tabs）：`ccw/frontend/src/components/issue/hub/IssueDrawer.tsx`
- SolutionDrawer（右侧抽屉）：`ccw/frontend/src/components/issue/queue/SolutionDrawer.tsx`

这让“右侧弹窗/抽屉内嵌 CLI 窗口”的 UI 成本很低：新增一个 tab 或替换为更通用的 drawer 即可。

### 2.2 Kanban DnD 组件

- `ccw/frontend/src/components/shared/KanbanBoard.tsx`（@hello-pangea/dnd）

可以直接用于 Issue Board（以及 Queue Board）。

### 2.3 “原生 CLI 输出”的 L0 形态已经存在（流式 + WS）

- 后端：`ccw/src/core/routes/cli-routes.ts`
  - `/api/cli/execute` 支持 streaming，并 WS 广播 `CLI_EXECUTION_STARTED` + `CLI_OUTPUT`（以及 completed/error）
- 前端：`ccw/frontend/src/pages/CliViewerPage.tsx` + `ccw/frontend/src/stores/cliStreamStore.ts`
  - 多 pane 输出、执行恢复（`/api/cli/active`）

这套能力仍然有价值（例如：一次性非 TTY 执行、回放、聚合输出）。但本次已确认 MVP 需要 **PTY + xterm** 的真终端体验，因此会新增一套 “CLI Session（PTY）” 的生命周期与 WS 双向通道。

### 2.4 编排器右侧滑出 ExecutionMonitor 可复用交互

- `ccw/frontend/src/pages/orchestrator/ExecutionMonitor.tsx`

可作为 Issue 看板右侧“CLI/执行监控”面板的交互模板（布局、滚动、自动跟随、固定宽度/可变宽度）。

---

## 3) 参考：CodeMoss 的关键设计点（值得吸收）

来自 `.workflow/.analysis/ANL-codemoss-issue-panel-2026-02-09/report.md`：

1) **Kanban task 数据里直接挂执行关联字段**（threadId/engineType/modelId/autoStart/branchName 等）
2) **拖到 inprogress 可触发自动动作**（启动会话/执行）
3) “原生 CLI”更像 **长驻进程/协议**（codex app-server JSON-lines），UI 只是事件的消费者

CCW 的“差异现实”：

- CCW 是 Web Dashboard，不是 Tauri/Electron；但我们仍然选择 **node-pty + xterm.js**（后端持有 PTY 会话，前端 attach 显示），以满足“原生 CLI 窗口 / tmux-like 路由”的需求。

---

## 4) 目标能力拆解（功能点清单）

### 4.1 Issue Board（Kanban）

- 新增 tab：`board`（`/issues?tab=board`）
- 列：`open` / `in_progress` / `resolved` / `completed`（`closed` 可独立列或筛选隐藏）
- 支持：
  - 列内排序（sortOrder）
  - 跨列拖拽（更新 issue.status）
  - 选中卡片 → 右侧 Issue Workbench Drawer
- 自动动作（对齐 CodeMoss）：
  - 从非 `in_progress` 拖到 `in_progress`：触发 `onDragToInProgress(issue)`（可配置）

### 4.2 右侧 “原生 CLI 窗口”（PTY + xterm.js）

右侧 drawer 增加 `Terminal`/`CLI` tab（或将 IssueDrawer 升级为 “IssueWorkbenchDrawer”）：

- 会话列表（per issue / per queue / global）
  - 多 CLI：Claude/Codex/Gemini/…
  - 每个会话绑定：
    - `sessionKey`：后端 PTY 会话 ID（用于 attach/close/send/resize）
    - `resumeKey`：逻辑连续性（用于生成 CLI 的 resume/continue 参数，或用于生成“同一会话下的命令模板”）
    - `tool/model/workingDir/envWrapper`（与 `ENSOAI_INTEGRATION_PLAN.md` 的能力对齐）
- 终端能力（MVP）
  - attach：打开/切换某个会话的 xterm 视图
  - send：向会话发送文本（send-keys / paste）并可选择自动回车
  - resize：前端尺寸变化时同步 PTY size
  - close：关闭会话（释放进程与资源）
- 操作
  - `Send`：把“指令/消息”直接投递到当前 PTY 会话（tmux send-keys 语义）
  - `Open in CLI Viewer`：可选（如果保留 `/api/cli/execute` 回放/聚合，则用于打开对应 execution；否则用于打开独立 CLI Viewer 的“会话视图”）

### 4.3 队列管理增强（Queue Workbench）

队列本身已有 API 结构（多队列 index + active_queue_ids、merge/split/activate 等，见 `ccw/src/core/routes/issue-routes.ts`），但前端仍偏“展示 + 少量操作”。

建议增强项：

- 多队列：列表/切换 active queues（UI 对接 `/api/queue/history` + `/api/queue/activate`）
- 可视化重排：
  - 列表重排（按 execution_group 分组，组内 drag reorder）
  - 将 item 拖到不同 execution_group（更新 execution_group + execution_order）
  - 依赖图/阻塞原因（depends_on / blocked）
- 与执行联动：
  - item `Execute in Session`（把 queue item 直接投递到指定 CLI 会话并执行；本次确认优先做这个）
  - item `Send to Orchestrator`（创建/触发一个 flow 执行）

### 4.4 编排器（Orchestrator）与 CLI 会话的“tmux-like 路由”

目标：编排器不只“跑一次性 CLI”，还能“向某个会话发送消息/指令”。

建议抽象：`CliMux`（CLI Multiplexer）

- **MVP（本次确认）CliMuxPersistent**：以 PTY 会话为核心，提供 `send(sessionKey, text)` / `resize` / `close`
- **补充（可选）CliMuxStateless**：保留 `/api/cli/execute` 作为非 TTY 执行与审计回放通道

编排器侧最小改动思路：

- 继续保持 node 数据模型统一（prompt-template），但新增可选字段：
  - `targetSessionKey?: string`（或 `issueId` + `sessionName` 组合）
  - `delivery?: 'newExecution' | 'sendToSession'`（默认 newExecution）
- FlowExecutor 在执行节点时：
  - `delivery=newExecution`：沿用现有 executeCliTool
  - `delivery=sendToSession`：调用 CliMux.send(targetSessionKey, instruction)

这样就形成“像 tmux 一样把消息打到指定 pane/session”的能力。

### 4.5 后端 CLI Session（PTY）协议草案（用于前后端对齐）

目标：让前端的 xterm 以 “attach 到 sessionKey” 的方式工作；Queue/Orchestrator 以 “send 到 sessionKey” 的方式工作。

- REST（建议）
  - `POST /api/cli-sessions`：创建会话（入参：`tool/model/workingDir/envWrapper/resumeKey/resumeStrategy/shell=bash`；出参：`sessionKey`）
  - `GET /api/cli-sessions`：列出会话（用于切换/恢复）
  - `POST /api/cli-sessions/:sessionKey/send`：发送文本（支持 `appendNewline`）
  - `POST /api/cli-sessions/:sessionKey/execute`：按 tool + resumeStrategy 生成并发送“可执行命令”（Queue/Orchestrator 走这个更稳）
  - `POST /api/cli-sessions/:sessionKey/resize`：同步 rows/cols
  - `POST /api/cli-sessions/:sessionKey/close`：关闭并回收
- WS 事件（建议）
  - `CLI_SESSION_CREATED` / `CLI_SESSION_CLOSED`
  - `CLI_SESSION_OUTPUT`（`sessionKey`, `data`, `stream=stdout|stderr`）
  - `CLI_SESSION_ERROR`（`sessionKey`, `message`）
- 兼容策略
  - 现有 `/api/cli/execute` + `CLI_OUTPUT` 保留：用于非 TTY 一次性执行、可审计回放、与现有 `CliViewerPage` 兼容
  - 新增“会话视图”可先复用 `cliStreamStore` 的 pane 结构（key 从 `transactionId` 扩展到 `sessionKey`）

### 4.6 `resumeKey` 映射策略（两种都实现）

`resumeKey` 的定位：一个跨 UI/Queue/Orchestrator 的“逻辑会话键”。同一个 `resumeKey` 下可能会对应：

- **策略 A：`nativeResume`（优先）**
  - 由 CLI 自己保存与恢复上下文（例如：`--resume/--continue/--session-id`）
  - 优点：上下文更可靠，输出格式更稳定；适合 Claude/Codex 这类有明确 session 概念的 CLI
  - 风险：不同 CLI 旗标/行为差异较大，需要 per-tool adapter（并要跟版本兼容）

- **策略 B：`promptConcat`（必须支持）**
  - CCW 自己维护 `resumeKey -> transcript/context`，每次执行把“历史 + 本次指令”拼成 prompt
  - 优点：对 CLI 依赖更少；即使 CLI 不支持 resume 也能连续；适合 Gemini/其它工具
  - 风险：token 成本、上下文截断策略、以及敏感信息/审计（需要明确 retention）

落地建议：后端新增 `ToolAdapter`（按 `tool` 输出“命令模板 + resume 参数 + prompt 注入方式”），`/api/cli-sessions/:sessionKey/execute` 统一走 adapter，Queue/Orchestrator 不直接拼 shell 命令。

---

## 5) 数据模型建议（对齐 CodeMoss，但保持 CCW 简洁）

### 5.1 Issue 扩展字段（建议在后端 issue schema 中落盘）

在 `Issue` 增加：

- `sortOrder?: number`（用于 board 列内排序）
- `sessions?: Array<{ sessionKey: string; resumeKey: string; tool: string; model?: string; workingDir?: string; envWrapper?: string; createdAt: string }>`

注意：

- 后端 `ccw/src/commands/issue.ts` 中已经出现 `status: 'queued'` 等状态迹象；前端 `Issue['status']` 需要对齐，否则 board/filters 会漏状态。

### 5.2 QueueItem 与 Session 的绑定（可选）

- `QueueItem.sessionKey?: string`（允许把某条 queue item 固定投递到某会话）

---

## 6) 分期交付（从快到慢）

### Phase 1（2~6 天）：PTY 会话底座 + Drawer 内嵌终端 + Queue “执行面”

- [BE] 新增 `CLI Session (PTY)`：create/list/attach/close/send/resize（WS 双向：output + input + resize）
- [FE] IssueDrawer 增加 `Terminal` tab：xterm attach 会话、切换会话、发送文本、resize、close
- [FE] QueuePanel 增加 `Execute in Session`：选/新建 sessionKey，将 queue item 渲染成可执行指令投递到会话
- [Auto] 支持“拖到 in_progress 自动执行”：触发 `Execute in Session`（可配置开关）

### Phase 2（2~5 天）：Issue Board（Kanban）+ Queue 管理面（多队列/重排/分组）

- [UI] IssueHubTabs 增加 `board`，IssueBoard 复用 `KanbanBoard`（状态列/排序/拖拽）
- [UI] QueuePanel 增加多队列切换、execution_group 分组与 drag reorder、blocked/depends_on 可视化
- [API] 若缺：跨 group 更新/排序落盘所需 endpoints（与现有 `/api/queue/reorder` 区分）

### Phase 3（3~8 天）：编排器与 CliMux 集成（tmux-like 路由）

- [Core] 引入 `CliMuxPersistent`（PTY 会话：send/resize/close）
- [Orchestrator] prompt-template 增加 `targetSessionKey/delivery`
- [UI] ExecutionMonitor 增加“路由到会话”的快捷操作（选择 session）

### Phase 4（长期）：安全、隔离、可观测、远程连接

- 资源隔离与安全策略（命令/路径白名单、审计日志、速率限制）
- 会话回收（空闲超时、最大并发、OOM 保护）
- 远程连接（可选）：会话分享、只读 attach、与外部 agent/daemon 的桥接（对齐 EnsoAI 的 Hapi/Cloudflared 思路）

---

## 7) 尚未决策（下一轮需要明确）

1) `bash` 的落地方式（跨平台）：
   - Linux/macOS：`bash -l`（或用户配置的 default shell）
   - Windows：优先 `wsl.exe -e bash -li`，其次 Git-Bash（`bash.exe`），都不可用时是否允许降级到 `pwsh`
2) per-tool 的“nativeResume”参数与触发方式（需要按版本验证）：
   - Claude：`--resume/--continue/--session-id` 的选择，以及在 PTY 下如何稳定触发一次“发送”（命令式 `-p` vs 交互式 send-keys）
   - Codex/Gemini：各自的 session/resume 旗标与输出格式（是否能稳定 machine-readable）
3) 安全边界：
   - 是否需要 per-workspace 的路径白名单、命令白名单、以及审计日志（特别是 Queue/Orchestrator 自动投递）
