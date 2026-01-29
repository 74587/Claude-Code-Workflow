# Subagent Roles Definition

Subagent 的角色定义和职责范围。

## Role Assignment

### Planning Agent (Issue-Plan-Agent)

**职责**：分析 issue 并生成可执行的解决方案

**角色文件**：`~/.codex/agents/issue-plan-agent.md`

#### Capabilities

- **允许**：
  - 读取代码、文档、配置
  - 探索项目结构和依赖关系
  - 分析问题和设计解决方案
  - 分解任务为可执行步骤
  - 定义验收条件

- **禁止**：
  - 修改代码
  - 执行代码
  - 推送到远程

#### 输入

```json
{
  "issue_id": "ISS-001",
  "title": "Fix authentication timeout",
  "description": "User sessions timeout too quickly",
  "project_context": {
    "tech_stack": "Node.js + Express + JWT",
    "guidelines": "..."
  }
}
```

#### 输出

```json
{
  "solution_id": "SOL-ISS-001-1",
  "tasks": [
    {
      "id": "T1",
      "title": "Update JWT configuration",
      "...": "..."
    }
  ],
  "acceptance": {
    "criteria": [...],
    "verification": [...]
  },
  "score": 0.95
}
```

### Execution Agent (Issue-Execute-Agent)

**职责**：执行规划的解决方案，实现所有任务

**角色文件**：`~/.codex/agents/issue-execute-agent.md`

#### Capabilities

- **允许**：
  - 读取代码和配置
  - 修改代码
  - 运行测试
  - 提交代码
  - 验证 acceptance criteria

- **禁止**：
  - 推送到远程分支
  - 创建 PR（除非明确授权）
  - 删除分支或文件

#### 输入

```json
{
  "solution_id": "SOL-ISS-001-1",
  "issue_id": "ISS-001",
  "solution": {
    "tasks": [...],
    "exploration_context": {...}
  }
}
```

#### 输出

```json
{
  "status": "completed|failed",
  "files_modified": ["src/auth.ts", "src/config.ts"],
  "commit_hash": "abc123def456",
  "tests_passed": true,
  "acceptance_verified": true,
  "errors": []
}
```

## Dual-Agent Strategy

### 为什么使用双 Agent 模式

1. **关注点分离**：规划和执行各自专注一个任务
2. **并行优化**：虽然执行依然串行，但规划可独立优化
3. **上下文最小化**：仅传递 solution ID，避免上下文膨胀
4. **错误隔离**：规划失败不影响执行，反之亦然

### 工作流程

```
┌────────────────────────┐
│  Planning Agent        │
│  • Analyze issue       │
│  • Design solution     │
│  • Generate tasks      │
│  → Output: SOL-xxx-1   │
└────────┬───────────────┘
         ↓
    ┌──────────────┐
    │ Bind solution│
    │ Update state │
    └──────┬───────┘
           ↓
┌─────────────────────────┐
│  Execution Agent        │
│  • Load SOL-xxx-1       │
│  • Execute all tasks    │
│  • Run tests            │
│  • Commit changes       │
│  → Output: commit hash  │
└─────────────────────────┘
         ↓
    ┌──────────────┐
    │ Save results │
    │ Update state │
    └──────────────┘
```

## Context Minimization

### 信息传递原则

**目标**：最小化上下文，减少 token 浪费

#### Planning Phase

**传递内容**：
- Issue ID 和 Title
- Issue Description
- Project tech stack
- Project guidelines

**不传递**：
- 完整的代码库快照
- 所有相关文件内容
- 历史执行结果

#### Execution Phase

**传递内容**：
- Solution ID（仅 ID，不传递完整 solution）
- 执行参数（worktree 路径等）

**不传递**：
- 规划阶段的完整上下文
- 其他 issues 的信息

### 上下文加载策略

```javascript
// Planning Agent 自己加载
const issueDetails = ReadFromIssueStore(issueId);
const techStack = Read('.workflow/project-tech.json');
const guidelines = Read('.workflow/project-guidelines.json');

// Execution Agent 自己加载
const solution = ReadFromSolutionStore(solutionId);
const project = Read('.workflow/project-guidelines.json');
```

## 错误处理与重试

### Planning 错误

| 错误 | 原因 | 重试策略 |
|------|------|----------|
| Subagent 超时 | 分析复杂 | 增加 timeout，重试 1 次 |
| 无效 solution | 生成不符合 schema | 返回用户，标记失败 |
| 依赖循环 | DAG 错误 | 返回用户进行修正 |

### Execution 错误

| 错误 | 原因 | 重试策略 |
|------|------|----------|
| Task 失败 | 代码有问题 | 记录错误，标记 solution 失败 |
| 测试失败 | 测试用例不符 | 不提交，标记失败 |
| 提交失败 | 冲突或权限 | 创建快照，让用户决定 |

## 交互指南

### 向 Planning Agent 的问题

```
这个 issue 描述了什么问题？
→ 返回：问题分析 + 根本原因

解决这个问题需要修改哪些文件？
→ 返回：文件列表 + 修改点

如何验证解决方案是否有效？
→ 返回：验收条件 + 验证步骤
```

### 向 Execution Agent 的问题

```
这个 task 有哪些实现步骤？
→ 返回：逐步指南 + 代码示例

所有测试都通过了吗？
→ 返回：测试结果 + 失败原因（如有）

acceptance criteria 都满足了吗？
→ 返回：验证结果 + 不符合项（如有）
```

## Role 文件位置

```
~/.codex/agents/
├── issue-plan-agent.md          # 规划角色
├── issue-execute-agent.md       # 执行角色
└── ...
```

### 如果角色文件不存在

Orchestrator 会使用 `universal-executor` 或 `code-developer` 作为备用角色。

## 最佳实践

### 为 Planning Agent 设计提示词

```markdown
1. 从 issue 描述提取关键信息
2. 探索相关代码和类似实现
3. 设计最小化解决方案
4. 分解为 2-7 个可执行任务
5. 为每个 task 定义明确的 acceptance criteria
```

### 为 Execution Agent 设计提示词

```markdown
1. 加载 solution 和所有 task 定义
2. 按依赖顺序执行 tasks
3. 为每个 task：implement → test → verify
4. 确保所有 acceptance criteria 通过
5. 提交一次包含所有更改
```
