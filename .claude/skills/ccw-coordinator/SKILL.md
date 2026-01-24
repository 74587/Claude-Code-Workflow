---
name: ccw-coordinator
description: Interactive command orchestration tool for building and executing Claude CLI command chains. Triggers on "coordinator", "ccw-coordinator", "命令编排", "command chain", "orchestrate commands", "编排CLI命令".
allowed-tools: Task, AskUserQuestion, Read, Write, Bash, Glob, Grep
---

# CCW Coordinator

交互式命令编排工具：允许用户依次选择命令，形成命令链，然后通过 ccw cli 调用 Claude 循环执行每个命令。

**核心特性**：
- **保持为 Skill**：用户通过 `/ccw-coordinator` 触发
- **仅支持 Claude**：所有执行通过 `ccw cli --tool claude` 调用
- **命令在提示词中体现**：提示词直接包含完整命令调用（如 `/workflow:lite-plan --yes "任务"`）
- **智能参数组装**：根据命令 YAML 头的 `argument-hint` 组装正确参数
- **循环执行**：每次根据上次完成情况和下个命令参数动态组装提示词

## Architecture Overview

```
用户: /ccw-coordinator
    ↓
┌─────────────────────────────────────────────────────────────────┐
│           Orchestrator (主流程状态机)                              │
│           直接在 Claude Code 主流程中运行                          │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────────┐
    ↓           ↓           ↓               ↓
┌─────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐
│  Init   │ │   Command    │ │  Command   │ │ Execute  │ ← 核心
│         │ │  Selection   │ │   Build    │ │          │
│ 初始化  │ │ 选择命令     │ │ 编排调整   │ │ 循环调用  │
│ 会话    │ │ 推荐确认     │ │ （可选）   │ │ ccw cli  │
└─────────┘ └──────────────┘ └────────────┘ └────┬─────┘
    │               │              │              │
    └───────────────┼──────────────┴──────────────┘
                    │                              │
                    ↓                              │
            ┌──────────────┐                       │
            │   Complete   │                       │
            │   生成报告   │                       │
            └──────────────┘                       │
                                                   │
                    ┌──────────────────────────────┘
                    │ 循环执行每个命令
                    ↓
    ┌───────────────────────────────────────┐
    │  action-command-execute               │
    │  for each command in chain:           │
    │    1. 组装提示词                       │
    │    2. 调用 ccw cli --tool claude      │
    │    3. 解析产物                        │
    │    4. 更新状态                        │
    └───────────────────┬───────────────────┘
                        │
                        ↓
        ┌───────────────────────────────┐
        │ ccw cli -p "                  │
        │ 任务: xxx                      │
        │ 前序: /workflow:lite-plan     │
        │ /workflow:lite-execute ..."   │
        │ --tool claude --mode write    │
        └───────────────┬───────────────┘
                        │
                        ↓
                ┌───────────────┐
                │ Claude 执行    │
                │ workflow 命令  │
                └───────────────┘
```

## Key Design Principles

1. **智能推荐**：Claude 根据用户任务描述自动推荐最优命令链
2. **交互式编排**：用户通过交互界面选择和编排命令，实时反馈推荐
3. **状态持久化**：会话状态保存到 `state.json`，支持中途暂停和恢复
4. **仅支持 Claude**：所有执行通过 `ccw cli --tool claude` 调用
5. **命令在提示词中**：提示词直接包含完整命令调用，不是告诉 Claude 去执行什么
6. **智能参数组装**：根据命令的 YAML 头 `argument-hint` 动态生成参数
7. **循环执行**：每个命令执行后立即更新状态，根据产物组装下个命令的提示词
8. **自动确认**：所有命令自动添加 `-y` 参数，跳过交互式确认
9. **产物追踪**：自动提取会话 ID 和产物文件，用于后续命令链接

## Intelligent Prompt Generation

执行命令时，系统智能生成 `ccw cli -p` 提示词。

### 核心原则

**提示词直接包含完整命令调用**，而不是告诉 Claude 去执行什么：

```
✅ 正确：
任务: 实现用户注册

/workflow:lite-plan --yes "实现用户注册"

❌ 错误：
任务: 实现用户注册
命令: /workflow:lite-plan
参数格式: [--yes] "task"
执行要求: 请执行 lite-plan 命令
```

### 提示词构成

```javascript
// 集成命令注册表（按需提取）
const registry = new CommandRegistry();
const commandMeta = registry.getCommands(commandNames);

function generatePrompt(cmd, state, commandMeta) {
  // 1. 任务描述
  let prompt = `任务: ${state.task_description}\n`;

  // 2. 前序完成情况
  if (state.execution_results.length > 0) {
    const previousOutputs = state.execution_results
      .filter(r => r.status === 'success')
      .map(r => {
        if (r.summary?.session) {
          return `- ${r.command}: ${r.summary.session} (${r.summary.files?.join(', ')})`;
        }
        return `- ${r.command}: 已完成`;
      })
      .join('\n');

    prompt += `\n前序完成:\n${previousOutputs}\n`;
  }

  // 3. 组装完整命令行（关键）
  const commandLine = assembleCommandLine(cmd, state, commandMeta);
  prompt += `\n${commandLine}`;

  return prompt;
}

// 根据 argument-hint 智能组装参数
function assembleCommandLine(cmd, state, commandMeta) {
  let commandLine = cmd.command;  // /workflow:lite-plan

  // 添加 --yes 标志
  commandLine += ' --yes';

  // 根据命令类型添加特定参数
  const cmdName = cmd.command.split(':').pop();

  if (cmdName === 'lite-plan') {
    commandLine += ` "${state.task_description}"`;
  } else if (cmdName === 'lite-execute') {
    // 如果有前序规划，使用 --in-memory
    if (state.execution_results.some(r => r.command.includes('plan'))) {
      commandLine += ' --in-memory';
    } else {
      commandLine += ` "${state.task_description}"`;
    }
  }
  // ... 其他命令类型

  return commandLine;
}
```

### 产物追踪

每个命令执行后自动提取关键产物：

```javascript
{
  command: "/workflow:lite-plan",
  status: "success",
  output: "...",
  summary: {
    session: "WFS-plan-20250123",      // 会话ID
    files: [".workflow/IMPL_PLAN.md"], // 产物文件
    timestamp: "2025-01-23T10:30:00Z"
  }
}
```

### 命令调用示例

**第一个命令（lite-plan）**：
```bash
ccw cli -p "任务: 实现用户认证功能

/workflow:lite-plan --yes \"实现用户认证功能\"" --tool claude --mode write -y
```

**第二个命令（lite-execute）**：
```bash
ccw cli -p "任务: 实现用户认证功能

前序完成:
- /workflow:lite-plan: WFS-auth-2025-01-24 (IMPL_PLAN.md, exploration-architecture.json)

/workflow:lite-execute --yes --in-memory" --tool claude --mode write -y
```

**第三个命令（test-cycle-execute）**：
```bash
ccw cli -p "任务: 实现用户认证功能

前序完成:
- /workflow:lite-plan: WFS-auth-2025-01-24 (IMPL_PLAN.md)
- /workflow:lite-execute: WFS-auth-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session=\"WFS-auth-2025-01-24\"" --tool claude --mode write -y
```

### 命令注册表集成

- **位置**: `tools/command-registry.js` (skill 内置)
- **工作模式**: 按需提取（只提取用户任务链中的命令）
- **功能**: 自动查找全局 `.claude/commands/workflow` 目录，解析命令 YAML 头元数据
- **作用**: 确保提示词包含准确的命令参数和上下文

详见 `tools/README.md`

---

## Execution Flow

### Orchestrator Execution Loop

```javascript
1. 初始化会话
   ↓
2. 循环执行直到完成
   ├─ 读取当前状态
   ├─ 选择下一个动作（根据状态和用户意图）
   ├─ 执行动作，更新状态
   └─ 检查终止条件
   ↓
3. 生成最终报告
```

### Action Sequence (Typical)

```
action-init
    ↓ (status: pending → running)
action-command-selection (可重复)
    ↓ (添加命令到链)
action-command-build (可选)
    ↓ (调整命令顺序)
action-command-execute
    ↓ (依次执行所有命令)
action-complete
    ↓ (status: running → completed)
```

## State Management

### Initial State

```json
{
  "status": "pending",
  "task_description": "",
  "command_chain": [],
  "confirmed": false,
  "error_count": 0,
  "execution_results": [],
  "current_command_index": 0,
  "started_at": null
}
```

### State Transitions

```
pending → running (init) → running → completed (execute)
                          ↓
                       aborted (error or user exit)
```

## Directory Setup

```javascript
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const workDir = `.workflow/.ccw-coordinator/${timestamp}`;

Bash(`mkdir -p "${workDir}"`);
Bash(`mkdir -p "${workDir}/commands"`);
Bash(`mkdir -p "${workDir}/logs"`);
```

## Output Structure

```
.workflow/.ccw-coordinator/{timestamp}/
├── state.json                    # 当前会话状态
├── command-chain.json            # 编排的完整命令链
├── execution-log.md              # 执行日志
├── final-summary.md              # 最终报告
├── commands/                     # 各命令执行详情
│   ├── 01-command.log
│   ├── 02-command.log
│   └── ...
└── logs/                         # 错误和警告日志
    ├── errors.log
    └── warnings.log
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | 编排器实现 |
| [phases/state-schema.md](phases/state-schema.md) | 状态结构定义 |
| [phases/actions/action-init.md](phases/actions/action-init.md) | 初始化动作 |
| [phases/actions/action-command-selection.md](phases/actions/action-command-selection.md) | 命令选择动作 |
| [phases/actions/action-command-build.md](phases/actions/action-command-build.md) | 命令编排动作 |
| [phases/actions/action-command-execute.md](phases/actions/action-command-execute.md) | 命令执行动作 |
| [phases/actions/action-complete.md](phases/actions/action-complete.md) | 完成动作 |
| [phases/actions/action-abort.md](phases/actions/action-abort.md) | 中止动作 |
| [specs/specs.md](specs/specs.md) | 命令库、验证规则、注册表 |
| [tools/chain-validate.cjs](tools/chain-validate.cjs) | 验证工具 |
| [tools/command-registry.cjs](tools/command-registry.cjs) | 命令注册表工具 |

---

## Usage Examples

### 快速命令链

用户想要执行：规划 → 执行 → 测试

```
1. 触发 /ccw-coordinator
2. 描述任务："实现用户注册功能"
3. Claude推荐: plan → execute → test-cycle-execute
4. 用户确认
5. 执行命令链
```

### 复杂工作流

用户想要执行：规划 → 执行 → 审查 → 修复

```
1. 触发 /ccw-coordinator
2. 描述任务："重构认证模块"
3. Claude推荐: plan → execute → review-session-cycle → review-fix
4. 用户可调整命令顺序
5. 确认执行
6. 实时查看执行进度
```

### 紧急修复

用户想要快速修复bug

```
1. 触发 /ccw-coordinator
2. 描述任务："修复生产环境登录bug"
3. Claude推荐: lite-fix --hotfix → test-cycle-execute
4. 用户确认
5. 快速执行修复
```

## Constraints and Rules

### 1. 命令推荐约束

- **智能推荐优先**: 必须先基于用户任务描述进行智能推荐，而非直接展示命令库
- **不使用静态映射**: 禁止使用查表或硬编码的推荐逻辑（如 `if task=bug则推荐lite-fix`）
- **推荐必须说明理由**: Claude 推荐命令链时必须解释为什么这样推荐
- **用户保留选择权**: 推荐后，用户可选择：使用推荐/调整/手动选择

### 2. 验证约束

- **执行前必须验证**: 使用 `chain-validate.js` 验证命令链合法性
- **不合法必须提示**: 如果验证失败，必须明确告知用户错误原因和修复方法
- **允许用户覆盖**: 验证失败时，询问用户是否仍要执行（警告模式）

### 3. 执行约束

- **顺序执行**: 命令必须严格按照 command_chain 中的 order 顺序执行
- **错误处理**: 单个命令失败时，询问用户：重试/跳过/中止
- **错误上限**: 连续 3 次错误自动中止会话
- **实时反馈**: 每个命令执行时显示进度（如 `[2/5] 执行: lite-execute`）

### 4. 状态管理约束

- **状态持久化**: 每次状态更新必须立即写入磁盘
- **单一数据源**: 状态只保存在 `state.json`，禁止多个状态文件
- **原子操作**: 状态更新必须使用 read-modify-write 模式，避免并发冲突

### 5. 用户体验约束

- **最小交互**: 默认使用智能推荐 + 一次确认，避免多次询问
- **清晰输出**: 每个步骤输出必须包含：当前状态、可用选项、建议操作
- **可恢复性**: 会话中断后，用户可从上次状态恢复

### 6. 禁止行为

- ❌ **禁止跳过推荐步骤**: 不能直接进入手动选择，必须先尝试推荐
- ❌ **禁止静态推荐**: 不能使用 recommended-chains.json 查表
- ❌ **禁止无验证执行**: 不能跳过链条验证直接执行
- ❌ **禁止静默失败**: 错误必须明确报告，不能静默跳过

## Notes

- 编排器使用状态机模式，确保执行流程的可靠性
- 所有命令链和执行结果都被持久化保存，支持后续查询和调试
- 支持用户中途修改命令链（在执行前）
- 执行错误会自动记录，支持重试机制
- Claude 智能推荐基于任务分析，非查表静态推荐
