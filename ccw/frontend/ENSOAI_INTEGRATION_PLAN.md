# EnsoAI → CCW Frontend 集成计划（架构识别 / 多 CLI / 远程连接 / 功能盘点）

日期：2026-02-09  
目标：把 `G:\github_lib\EnsoAI` 的“多路智能并行工作流”核心体验，按 CCW 现有能力边界，规划性集成到 `D:\Claude_dms3\ccw\frontend`（Web Dashboard）。

> 注：由于本环境 `read_file` 工具仅允许读取 `D:\Claude_dms3`，EnsoAI 代码引用路径来自本地检索结果与 PowerShell 阅读，不影响结论准确性。

---

## 1) EnsoAI 架构速览（你要找的“架构骨架”）

EnsoAI 是一个 Electron 桌面应用，典型三段式：

- **Main Process（主进程）**：`G:\github_lib\EnsoAI\src\main`
  - IPC handlers、系统服务集成、Git/PTY/远程共享/代理、Claude 生态集成（Provider、MCP、IDE Bridge）
- **Preload（桥接层）**：`G:\github_lib\EnsoAI\src\preload`
  - `window.electronAPI.*` 暴露给渲染进程（settings、hapi、cloudflared、mcp、git、terminal 等）
- **Renderer（UI）**：`G:\github_lib\EnsoAI\src\renderer`
  - React UI：Worktree/Git、Monaco 编辑器、xterm 终端、多 Agent Chat、设置面板等
- **Shared（共享）**：`G:\github_lib\EnsoAI\src\shared`
  - types/i18n/ipc channel 等

核心思路：**把“多 Agent 并行”落到“多 worktree + 多终端会话 + 可恢复的 AI session”上**，并提供一揽子系统集成（Claude IDE Bridge / MCP / 远程共享 / proxy）。

---

## 2) EnsoAI 如何调用多 CLI（重点：两条路径）

### 2.1 非交互任务调用（更像“工具/能力调用”）

入口：`G:\github_lib\EnsoAI\src\main\services\ai\providers.ts`

- 按 provider 选择 CLI：
  - Claude：`claude -p --output-format ... --model ... [--session-id] [--no-session-persistence]`
  - Codex：`codex exec -m <model> ...`（prompt 走 stdin）
  - Gemini：`gemini -o ... -m ... --yolo`（prompt 走 stdin）
  - Cursor：`agent -p --output-format ... --model ...`（不支持部分 claude flags）
- 统一策略：**通过用户 shell 包装 spawn**，prompt 统一写 stdin；实现了 kill 逻辑与输出解析（尤其 Claude JSON 输出的版本兼容）。

适用场景：commit message 生成、code review、分支命名等“非交互式一次性任务”。

### 2.2 交互终端调用（更像“人机对话/操作台”）

入口：`G:\github_lib\EnsoAI\src\renderer\components\chat\AgentTerminal.tsx`

关键点：

- **会话恢复**：`--resume <id>` / `--session-id <id>`（并对 Cursor/Claude initialized 的差异做了兼容）
- **IDE 集成**：Claude 追加 `--ide`
- **环境包装（environment wrapper）**：
  - `native`：直接执行 `<agentCommand> ...`
  - `hapi`：`hapi <agent> ...` 或 `npx -y @twsxtd/hapi <agent> ...`，并注入 `CLI_API_TOKEN`
  - `happy`：`happy <agent> ...`（同理）
- **跨平台兼容**：
  - WSL：用 `wsl.exe -e sh -lc ...` 进入登录 shell
  - PowerShell：用 `& { <command> }` 避免 `--session-id` 被 PowerShell 当成自身参数
- **tmux 支持（非 Windows + Claude）**：把会话包进 tmux，保证“断开 UI 也能续接”一类体验

适用场景：多 Agent 终端式并行对话、跨会话恢复、长任务驻留。

### 2.3 CLI 探测/安装（多 CLI 的“可用性治理”）

- 探测：`G:\github_lib\EnsoAI\src\main\services\cli\CliDetector.ts`
  - 内置：`claude/codex/droid/gemini/auggie/cursor-agent/opencode`
  - 通过 PTY 执行 `<cmd> --version`，Windows 放宽超时
- 安装（EnsoAI 自身 CLI，用于打开目录等）：`G:\github_lib\EnsoAI\src\main\services\cli\CliInstaller.ts`
  - 跨平台脚本生成（macOS/Windows/Linux），以及可能的管理员权限处理

---

## 3) EnsoAI 的“远程连接 / 系统集成”到底做了什么

### 3.1 Claude IDE Bridge（Claude Code CLI 的 IDE 集成）

入口：`G:\github_lib\EnsoAI\src\main\services\claude\ClaudeIdeBridge.ts`

机制要点：

- 本机启动 WebSocket server（绑定 127.0.0.1，随机端口）
- 写 lock file 到：
  - `~/.claude/ide/<port>.lock`（或 `CLAUDE_CONFIG_DIR/ide/<port>.lock`）
  - payload 含：`pid/workspaceFolders/ideName/transport/ws/runningInWindows/authToken`
- Claude Code 客户端连接时需 header：
  - `x-claude-code-ide-authorization: <authToken>`
  - 可选 `x-claude-code-workspace` 辅助路由
- 可向 Claude Code 广播通知：
  - `selection_changed`
  - `at_mentioned`
- 为“运行 Claude CLI 子进程”注入 env：
  - `ENABLE_IDE_INTEGRATION=true`
  - `CLAUDE_CODE_SSE_PORT=<port>`（配合 `claude --ide`）

这属于“系统集成层”，不是普通 API 配置；它解决的是：**Claude Code CLI 与 IDE/宿主之间的状态互通**。

### 3.2 MCP Servers 管理（与 Claude 生态配置打通）

入口：`G:\github_lib\EnsoAI\src\main\services\claude\McpManager.ts`

- 读写 `~/.claude.json` 的 `mcpServers`
- 支持：
  - stdio MCP：`command/args/env`（UI 可编辑）
  - HTTP/SSE MCP：`type/url/headers`（一般保留原配置，避免破坏）

### 3.3 远程共享（Hapi）与公网暴露（Cloudflared）

- Hapi：`G:\github_lib\EnsoAI\src\main\services\hapi\HapiServerManager.ts` + `src/main/ipc/hapi.ts`
  - `hapi server` 或 fallback `npx -y @twsxtd/hapi server`
  - env：`WEBAPP_PORT/CLI_API_TOKEN/TELEGRAM_BOT_TOKEN/WEBAPP_URL/ALLOWED_CHAT_IDS`
  - UI 文案明确：**Web + Telegram 远程共享 agent sessions**
- Cloudflared：`G:\github_lib\EnsoAI\src\main\services\hapi\CloudflaredManager.ts`
  - 安装到 userData/bin（避开 asar 只读）
  - 支持 quick tunnel / token auth tunnel，可选 `--protocol http2`

### 3.4 Proxy（代理）

入口：`G:\github_lib\EnsoAI\src\main\services\proxy\ProxyConfig.ts`

- Electron session 级代理 + 子进程环境变量注入（HTTP(S)_PROXY / NO_PROXY）
- 内置代理联通性测试（HEAD 请求多个探测 URL）

---

## 4) EnsoAI 功能点全量清单（按模块）

> 这里是“罗列所有功能点”的汇总视图；后续集成计划会用它做映射。

### 4.1 多 Agent / 多 CLI（核心卖点）

- 多 Agent 终端会话并行（Claude/Codex/Gemini + 额外探测 Droid/Auggie/Cursor/OpenCode）
- 会话持久化与恢复（session-id / resume）
- CLI 可用性探测（installed/version/timeout）
- 环境包装：native +（hapi/happy）+ tmux + WSL/PowerShell 兼容

### 4.2 Git / Worktree 工作流（核心载体）

- Worktree 创建/切换/删除；分支为“一等公民”
- Source Control 面板：
  - 文件变更列表、stage/unstage、commit、history、branch 切换
  - diff viewer / diff review modal
- 三栏 Merge Editor（冲突解决）
- 远端同步：fetch/pull/push 等

### 4.3 编辑器与文件系统

- Monaco 编辑器、多标签、拖拽排序
- 文件树 CRUD（新建/重命名/删除）
- 预览：Markdown / PDF / Image
- 未保存变更保护、冲突提示

### 4.4 AI 辅助开发

- AI commit message 生成
- AI code review（围绕 diff 的审查/优化）
- 分支命名辅助（推测）

### 4.5 Claude 生态集成

- Claude Provider 管理（监听/应用 `~/.claude/settings.json`）
- MCP servers 管理（`~/.claude.json`，stdio + HTTP/SSE）
- Prompts / Plugins 管理
- Claude IDE Bridge（WS + lock file + selection/@ 通知）

### 4.6 远程与网络

- Hapi remote sharing（Web + Telegram）
- Cloudflared tunnel 暴露本地服务
- 代理设置与测试

### 4.7 通用体验

- 多窗口、多工作空间
- 主题同步（终端主题）
- 快捷键/命令面板
- 设置 JSON 持久化
- Web Inspector、更新通知

---

## 5) CCW Frontend 基线（与 EnsoAI 的可复用对齐点）

CCW 前端已具备的关键“载体/底座”：

- **CLI Viewer（多 pane）**：`ccw/frontend/src/pages/CliViewerPage.tsx`
  - 已支持 split/grid 布局、聚焦 pane、执行恢复与 WebSocket 输出接入
- **CLI Endpoints / Installations**：
  - `ccw/frontend/src/pages/EndpointsPage.tsx`（litellm/custom/wrapper）
  - `ccw/frontend/src/pages/InstallationsPage.tsx`（install/upgrade/uninstall）
- **MCP Manager（含 Cross-CLI）**：`ccw/frontend/src/pages/McpManagerPage.tsx`
- **后端 CLI executor 体系**：`ccw/src/tools/cli-executor-core.ts` + `ccw/src/core/routes/cli-routes.ts`
  - 已有 active executions 恢复、history/sqlite、tool availability、wrapper/tools 路由等能力

CCW 与 EnsoAI 的主要差异（决定“集成方式”）：

- EnsoAI 是“桌面 IDE/工作台”，CCW 是“Web Dashboard + Orchestrator”
- EnsoAI 的 Worktree/Git/Editor/PTY 属于重资产 IDE 能力；CCW 目前不承担这些（除非明确要扩域）
- EnsoAI 的 IDE Bridge / Hapi/Cloudflared 属于系统集成层；CCW 当前需要新增后端能力才能对齐

---

## 6) 集成策略（把 EnsoAI 优势带到 CCW，但不把 CCW 变成 IDE）

优先级建议：

1) **先移植“多 Agent 并行调度 + 可恢复输出体验”**（与 CCW 现有 CLI viewer/cli executor 高度匹配）  
2) 再做 **“多 CLI 治理与配置同步”体验收敛**（Installations/Endpoints/MCP 的信息架构对齐）  
3) 最后才考虑 **系统集成层**（Claude IDE Bridge、远程共享、tunnel/proxy 等）

---

## 7) Roadmap（集成到 `ccw/frontend` 的分期落地）

### Phase 0 — 对齐与设计（1~2 天）

- 产出：统一术语与信息架构
  - Agent / Tool / Endpoint / Wrapper 的定义
  - “并行会话”= 多 execution 并发 + CLI viewer 多 pane 展示
- 产出：UI 草图（Agent Matrix + 单 Agent Details + 快捷动作）

### Phase 1（MVP）— Agent Matrix（最接近 EnsoAI 卖点，且最可落地）

目标：在 CCW 中“一屏管理多 Agent 并行执行”，并可一键把多个 execution 打开到 CLI Viewer 的多个 pane。

前端交付（建议）：

- 新页面：`/agents`（或并入 `/cli-viewer` 的“Matrix 模式”）
  - 卡片：每个 Agent（claude/codex/gemini/...）展示 installed/version/status
  - 快捷动作：
    - Run prompt（选择 mode：analysis/plan/review…）
    - Open in CLI Viewer（自动分配 pane）
    - Resume / View history（打开对应 conversation/execution）
  - 并行启动：一次选多个 Agent → 并发触发多次执行 → 同步创建 viewer tabs
- 复用：`cliStreamStore` + `viewerStore`

后端依赖（最小化）：

- 若现有 `/api/cli/*` 已满足执行与 active 恢复：仅需补一个 “agents list/status” 聚合接口（可由现有 installations/status 拼装）

验收标准：

- 同一 prompt 可对多个 agent 并行执行，输出稳定落到 CLI Viewer 多 pane
- 刷新页面后仍可恢复 running executions（复用 `/api/cli/active`）
- 每个 execution 可追溯到 history（已有 sqlite/history 体系）

### Phase 2 — Wrapper/Endpoint 体验收敛（对齐 EnsoAI 的 environment wrapper 思路）

目标：把 EnsoAI 的 `native/hapi/happy/tmux/wsl` 思路映射成 CCW 的 endpoint/wrapper 配置，形成一致的“运行环境选择”体验。

前端交付（建议）：

- 在 Agent Matrix 卡片中加入：
  - “运行环境”下拉（native / wrapper endpoints）
  - “会话策略”选项（new / resume / no-persistence 等，取决于后端 executor 支持）
- 在 EndpointsPage 中标注 “可用于哪些 agent/tool” 的适配关系（避免用户创建了 wrapper 但不知道生效范围）

后端依赖：

- wrapper endpoints 的能力需要明确：是否等价于 EnsoAI 的 `hapi/happy` 前缀包装？（如果是，需在 cli executor 的 command builder 支持这一类 wrapper）

### Phase 3 — Claude IDE Bridge（可选，大改动，系统集成层）

目标：在 CCW（Node 服务）侧实现类似 EnsoAI 的 IDE Bridge，并在前端提供状态面板。

前端交付（建议）：

- Settings 新增 “IDE Integration（Claude Code）”：
  - Bridge enable/disable
  - 当前端口、lock file 路径、连接状态、最近一次 selection/@ 通知
  - “复制 token / 复制诊断信息”按钮

后端依赖：

- 需要在 CCW server 里增加 WS server + lock file 写入逻辑（参考 EnsoAI 的 `ClaudeIdeBridge.ts`）
- 需要明确 Claude Code CLI 的兼容要求（协议版本、headers、env key）

### Phase 4 — 远程共享与公网暴露（可选，偏产品功能）

目标：把 EnsoAI 的 Hapi + Cloudflared 能力变成 CCW 的“远程访问/协作”能力。

前端交付（建议）：

- Settings 新增 “Remote Sharing”：
  - 启停服务、端口、token、允许列表
  - Cloudflared 安装/启停、URL 展示、一键复制

后端依赖：

- 需要引入 hapi/cloudflared 管理模块（或选择更贴近 CCW 的方案，例如仅 cloudflared 暴露 CCW server）
- 需要明确安全边界（认证、token 轮换、日志脱敏、默认不开放）

---

## 8) EnsoAI 功能 → CCW 现状 → 集成建议（映射表）

| EnsoAI 功能 | CCW 现状 | 建议集成方式（优先级） |
|---|---|---|
| 多 Agent 并行会话 | 有 CLI viewer + executor，但缺“一屏矩阵” | Phase 1：新增 Agent Matrix + 自动 pane 分配 |
| CLI 探测/安装 | 有 InstallationsPage | Phase 1：把 Installations 信息在 Matrix 中复用展示 |
| environment wrapper（hapi/happy/tmux/wsl） | 有 wrapper endpoints 概念 | Phase 2：把 wrapper endpoints 显式接到 Agent 执行选择 |
| Claude MCP servers 管理 | 有 MCP Manager（含 Cross-CLI） | 现有功能可继续增强（模板/同步策略） |
| Claude IDE Bridge | 暂无 | Phase 3（可选）系统集成层模块 + Settings 面板 |
| Hapi remote sharing + Cloudflared | 暂无 | Phase 4（可选） |
| Worktree/Git/Editor/Merge | 暂无（且是 IDE 域） | 默认不集成；若要做需单独立项 |

---

## 9) 下一步（如果你要我继续落地）

你可以选择一个切入点，我可以直接在 `ccw/frontend` 开工实现：

1) **Phase 1（推荐）**：新增 `/agents` 页面（Agent Matrix），复用现有 `/api/cli/*` 与 CLI viewer  
2) **Phase 2**：把 wrapper endpoints 打通到“Agent 运行环境选择”  
3) **Phase 3/4**：需要先确认产品边界与安全策略，再做后端设计

