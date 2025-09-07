# 统一任务管理流程

## 架构概述

```
┌─────────────────────────────────────────────┐
│           Workflow Layer (宏观)              │
│  /workflow:init → plan → implement → review  │
│           workflow-session.json              │
└────────────────┬────────────────────────────┘
                 │ 双向同步
┌────────────────┴────────────────────────────┐
│            Task Layer (微观)                 │
│   /task:create → execute → status → sync     │
│              tasks.json                      │
└─────────────────────────────────────────────┘
```

## 核心改进

### 1. 命令体系（精简版）
**Workflow命令**（11个核心命令）：

**Session管理**：
- `/workflow:session start` - 初始化并开始会话（含原init功能）
- `/workflow:session pause` - 暂停当前会话
- `/workflow:session resume` - 恢复会话

**阶段管理**：
- `/workflow:plan` - 规划阶段（根据复杂度可选）
- `/workflow:implement` - 实施阶段（集成simple/medium/complex模式）
- `/workflow:review` - 评审阶段

**辅助功能**：
- `/workflow:status` - 统一状态查看（含session状态）
- `/workflow:sync` - 数据同步
- `/workflow:context` - 上下文分析
- `/workflow:issue` - Issue管理
- `/workflow:replan` - 重新规划

**Task命令**（保持7个核心命令）：
- `/task:create` - 创建任务
- `/task:execute` - 执行任务
- `/task:status` - 查看状态
- `/task:replan` - 重新规划
- `/task:sync` - 同步数据
- `/task:breakdown` - 任务分解
- `/task:context` - 上下文分析

### 2. JSON管理体系

#### workflow-session.json
```json
{
  "session_id": "WFS-2025-001",
  "project": "项目名称",
  "type": "simple|medium|complex",
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "created": "2025-01-16T10:00:00Z",
  "phases": {
    "PLAN": {
      "status": "pending|active|completed",
      "output": "PLAN.md"
    },
    "IMPLEMENT": {
      "status": "pending|active|completed",
      "tasks": ["IMPL-001", "IMPL-002"],
      "completed_tasks": ["IMPL-001"],
      "progress": 50
    },
    "REVIEW": {
      "status": "pending|active|completed",
      "output": "REVIEW.md"
    }
  },
  "context": {
    "requirements": [],
    "scope": [],
    "issues": []
  }
}
```

#### tasks.json
```json
{
  "session_id": "WFS-2025-001",
  "tasks": {
    "IMPL-001": {
      "id": "IMPL-001",
      "title": "任务标题",
      "status": "pending|in_progress|completed|blocked",
      "type": "feature|bugfix|refactor",
      "agent": "code-developer",
      "context": {},
      "created_at": "2025-01-16T12:00:00Z"
    }
  },
  "next_id": 2
}
```

### 3. 双向同步机制

#### 自动同步点
- Task创建 → 更新workflow tasks数组
- Task完成 → 更新workflow progress
- Workflow context变更 → 传播到tasks
- Issue创建 → 关联到相关tasks

#### 同步命令
- `/workflow:sync` - 全局文档同步
- `/task:sync` - Task层同步

### 4. 统一执行流程

#### 简单任务流程（Bug修复）
```bash
# 初始化并开始
/workflow:session start simple "修复登录按钮样式"
→ 创建 workflow-session.json
→ 设置复杂度: simple

# 直接实施（跳过规划）
/workflow:implement --type=simple
→ TodoWrite: 3-4项
→ Agent: code-developer → code-review-agent
→ 自动完成
```

#### 中等复杂度流程（新特性）
```bash
# Step 1: 开始会话
/workflow:session start medium "添加用户资料编辑功能"
→ 创建 workflow-session.json
→ 设置复杂度: medium

# Step 2: 轻量规划
/workflow:plan
→ 生成简单PLAN.md

# Step 3: 实施
/workflow:implement --type=medium
→ TodoWrite: 5-7项
→ Agent: planning-agent → code-developer → code-review-agent

# Step 4: 暂停/恢复（如需要）
/workflow:session pause
/workflow:session resume

# Step 5: 评审
/workflow:review
```

#### 复杂系统流程（架构变更）
```bash
# Step 1: 开始复杂会话
/workflow:session start complex "实现OAuth2认证系统"
→ 创建 workflow-session.json
→ 设置复杂度: complex

# Step 2: 详细规划
/workflow:plan
→ 生成: IMPLEMENTATION_PLAN.md, TASK_DECOMPOSITION.md
→ 风险评估

# Step 3: 复杂实施
/workflow:implement --type=complex
→ TodoWrite: 7-10项
→ 初始化 tasks.json
→ 启用 task 命令

# Step 4: 任务管理
/task:create "设计OAuth2架构"
/task:breakdown IMPL-001
/task:execute IMPL-001.1
/task:status

# Step 5: 监控和同步
/workflow:status          # 查看整体进度
/workflow:sync            # 确保数据一致
/task:sync               # 任务层同步

# Step 6: 处理变更（如需要）
/workflow:issue create "安全需求变更"
/workflow:replan
/task:replan IMPL-003

# Step 7: 评审和完成
/workflow:review
/workflow:session complete
```

## 关键特性

### 1. 智能上下文感知
- 基于Gemini的智能分析
- 自动任务推荐
- 依赖关系检测
- 冲突预防

### 2. 状态持久化
- JSON文件持久化所有状态
- 支持会话恢复
- 自动备份机制
- 版本控制友好

### 3. 灵活性
- 支持简单/中等/复杂三种模式
- 可跳过规划直接实施
- 支持任务重规划
- 支持并行执行

### 4. 一致性保证
- 双向同步机制
- 数据完整性验证
- 冲突自动解决
- 实时进度计算

## 核心准则引用

所有命令共享以下核心准则（通过@引用）：
- `session-management-principles.md` - 会话管理
- `todowrite-coordination-rules.md` - TodoWrite协调
- `agent-orchestration-patterns.md` - Agent编排
- `dynamic-change-management.md` - 动态变更
- `complexity-decision-tree.md` - 复杂度决策
- `task-decomposition-integration.md` - 任务分解
- `gemini-intelligent-context.md` - 智能上下文

## 优势总结

1. **清晰分层**：Workflow管理宏观流程，Task处理具体执行
2. **完整持久化**：所有状态通过JSON文件管理
3. **自动同步**：双向同步保证数据一致性
4. **命令精简**：减少认知负担，易于使用
5. **智能增强**：Gemini驱动的上下文分析
6. **统一流程**：标准化的项目管理流程

## 快速开始

```bash
# 简单任务（bug修复）
/workflow:session start simple "修复登录问题"
/workflow:implement --type=simple
# 自动完成

# 中等任务（新特性）
/workflow:session start medium "用户资料编辑"
/workflow:plan                      # 轻量规划
/workflow:implement --type=medium   # 执行实施
/workflow:review                    # 质量评审

# 复杂项目（系统级）
/workflow:session start complex "OAuth2集成"
/workflow:plan                      # 详细规划
/workflow:implement --type=complex  # 复杂实施
/task:create "设计OAuth2架构"       # 创建任务
/task:breakdown IMPL-001            # 任务分解
/task:execute IMPL-001.1            # 执行子任务
/workflow:status                    # 查看状态
/workflow:review                    # 最终评审
```

## 文件结构

```
.claude/
├── commands/
│   ├── workflow/
│   │   ├── session.md     # 会话管理(start/pause/resume)
│   │   ├── plan.md        # 规划阶段
│   │   ├── implement.md   # 实施阶段(含3种模式)
│   │   ├── review.md      # 评审阶段
│   │   ├── status.md      # 统一状态
│   │   ├── sync.md        # 数据同步
│   │   ├── context.md     # 上下文分析
│   │   ├── issue.md       # Issue管理
│   │   └── replan.md      # 重新规划
│   └── task/
│       ├── create.md      # 创建任务
│       ├── execute.md     # 执行任务
│       ├── status.md      # 任务状态
│       ├── replan.md      # 任务重规划
│       ├── sync.md        # 任务同步
│       ├── breakdown.md   # 任务分解
│       └── context.md     # 任务上下文
├── schemas/
│   ├── workflow-session.json  # 会话schema
│   └── task.json              # 任务schema
└── workflows/
    ├── session-management-principles.md
    ├── todowrite-coordination-rules.md
    ├── agent-orchestration-patterns.md
    ├── task-decomposition-integration.md
    ├── complexity-decision-tree.md
    └── [其他核心准则]

工作目录/
├── workflow-session.json   # 会话状态
├── tasks.json             # 任务数据
├── PLAN.md               # 规划文档(可选)
├── REVIEW.md             # 评审报告
└── .workflow/            # 工作目录
    └── WFS-2025-001/     # 会话工作空间
```

此统一任务管理流程提供了清晰、高效、智能的项目管理体系。