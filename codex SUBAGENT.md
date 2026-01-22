# Codex Subagent 使用规范（说明文档）

## 1. Subagent 是什么

Subagent 是由主 agent（当前对话）临时创建的“并行工作单元”，用于把任务拆分后并行推进；每个 subagent 有独立会话上下文，通过 `agent_id` 标识。

## 2. 核心特性

- **并行处理**：可同时创建多个 subagent，分别负责调研、方案、测试、实现建议等子任务。
- **结构化交付**：适合要求 subagent 按固定模板输出（如 `Summary/Findings/Proposed changes/Tests/Open questions`），便于主 agent 汇总合并。
- **迭代追问**：subagent 首次回包后，主 agent 可继续补充信息、纠偏或扩展任务。
- **Open questions 工作流**：subagent 可先只提澄清问题；待主 agent 回答后再输出方案与测试建议。

## 3. 生命周期与 API 约定

### 3.1 创建 subagent

- 调用：`functions.spawn_agent({ agent_type?, message })`
- 返回：`agent_id`

建议在 `message` 中明确：

- `Goal`：一句话目标
- `Scope`：可做/不可做（目录、文件类型、是否允许引入依赖、是否允许跑命令）
- `Context`：最小必要上下文（关键路径、现状摘要、约束）
- `Deliverables`：强制输出格式
- `Quality bar`：验收标准

### 3.2 获取结果（关键点）

- 调用：`functions.wait({ ids, timeout_ms? })`
- 结果：出现在 `status[agent_id].completed`（subagent 回包内容）
- 超时：`timed_out=true` 不等于失败，可继续 `wait` 或 `send_input` 催促收敛

> 注意：`close_agent` 不是“返回结果”的前置条件；拿结果靠 `wait`。

### 3.3 继续追问/纠偏

- 调用：`functions.send_input({ id, message, interrupt? })`
- `interrupt=true`：用于立刻打断并纠偏（慎用，优先用普通追问）

### 3.4 结束回收

- 调用：`functions.close_agent({ id })`
- 一旦关闭：该 subagent **不可恢复**；只能重新 `spawn_agent` 新的，并粘贴旧输出/上下文续做

## 4. 输出模板（推荐）

要求 subagent 统一用以下结构回包，便于合并：

```text
Summary:
- ...

Findings:
- ...

Proposed changes:
- 文件/模块：
- 变更点：
- 风险点：

Tests:
- 需要新增/更新的用例：
- 需要运行的测试命令（如适用）：

Open questions:
1. ...
2. ...
```

## 5. 并行拆分建议（高收益模式）

- **Worker A（调研）**：定位入口、调用链、相似实现；交付“文件+符号+证据点”，不写方案。
- **Worker B（方案）**：最小改动实现路径、兼容性与风险；交付“变更点清单”。
- **Worker C（测试）**：测试策略、边界条件、Mock 点；交付“用例列表+覆盖点”。

原则：尽量按“模块/文件域”拆分，避免多个 subagent 同时建议修改同一文件导致冲突。

## 6. 常见坑与约定

- **不 close 也能拿结果**：`wait` 才是取结果的入口；`close_agent` 只是收尾清理。
- **关闭不可逆**：想续聊就不要提前 close；若已 close，只能新建并补发上下文。
- **范围控制**：subagent 只做分配的子任务，超出范围必须在 `Open questions` 里请求确认。

