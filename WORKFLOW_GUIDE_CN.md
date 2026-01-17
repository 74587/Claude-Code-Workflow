# CCW Workflow Difficulty Guide

## Overview

CCW 提供两类工作流体系：**主干工作流** (Main Workflow) 和 **Issue 工作流** (Issue Workflow)，它们协同覆盖软件开发的完整生命周期。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Main Workflow (主干工作流)                          │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Level 1   │ → │   Level 2   │ → │   Level 3   │ → │   Level 4   │     │
│  │   急速执行   │   │   轻量规划   │   │   标准规划   │   │  头脑风暴   │     │
│  │             │   │             │   │             │   │             │     │
│  │ lite-lite-  │   │ lite-plan   │   │    plan     │   │ brainstorm  │     │
│  │    lite     │   │ lite-fix    │   │  tdd-plan   │   │  :auto-     │     │
│  │             │   │ multi-cli-  │   │ test-fix-   │   │  parallel   │     │
│  │             │   │    plan     │   │    gen      │   │     ↓       │     │
│  │             │   │             │   │             │   │   plan      │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│                                                                             │
│  复杂度: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶  │
│          低                                                        高       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 开发完成后
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Issue Workflow (Issue 工作流)                       │
│                                                                             │
│     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│     │  Accumulate  │    →    │    Plan      │    →    │   Execute    │     │
│     │  发现 & 积累  │         │  批量规划    │         │  并行执行    │     │
│     └──────────────┘         └──────────────┘         └──────────────┘     │
│                                                                             │
│     补充角色: 维护主分支稳定，支持 worktree 隔离                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 主干工作流与 Issue 工作流的关系

### 设计哲学

| 维度 | 主干工作流 (Main) | Issue 工作流 (Issue) |
|------|-------------------|---------------------|
| **定位** | 主要开发周期 | 开发后的维护补充 |
| **时机** | 功能开发阶段 | 主干开发完成后 |
| **范围** | 完整功能实现 | 针对性修复/增强 |
| **并行策略** | 依赖分析 → Agent 并行 | Worktree 隔离 (可选) |
| **分支模型** | 在当前分支工作 | 可使用独立 worktree |

### 为什么主干工作流不自动使用 Worktree？

**依赖分析已解决并行问题**：

1. 规划阶段 (`/workflow:plan`) 执行依赖分析
2. 自动识别任务依赖和关键路径
3. 划分**并行组** (独立任务) 和**串行链** (依赖任务)
4. Agent 并行执行独立任务，无需文件系统隔离

```
┌─────────────────────────────────────────────────┐
│         Dependency Analysis (依赖分析)           │
│                                                 │
│  Task A ─────┐                                  │
│              ├──→ Parallel Group 1 ──→ Agent 1  │
│  Task B ─────┘                                  │
│                                                 │
│  Task C ────────→ Serial Chain ──────→ Agent 2  │
│       ↓                                         │
│  Task D ────────→                               │
│                                                 │
│  同一 worktree，通过调度实现并行                   │
└─────────────────────────────────────────────────┘
```

### 为什么 Issue 工作流支持 Worktree？

Issue 工作流作为**补充机制**，场景不同：

1. 主干开发完成，已合并到 `main`
2. 发现需要修复的问题
3. 需要在不影响当前开发的情况下修复
4. Worktree 隔离让主分支保持稳定

```
开发完成 → 发布 → 发现 Issue → Worktree 隔离修复 → 合并回主干
    ↑                                              │
    └──────────── 继续新功能开发 ←─────────────────┘
```

---

## Level 1: 急速执行 (lite-lite-lite)

**最简单 - 一次 CLI 分析到执行，零产物**

### 特点

| 属性 | 值 |
|------|-----|
| **复杂度** | 低 |
| **产物** | 无文件 |
| **状态** | 无状态 |
| **CLI 选择** | 自动分析任务类型 |
| **迭代方式** | 通过 AskUser |

### 流程

```
用户输入 → 需求澄清 → 自动选择 CLI → 并行分析 → 展示结果 → 直接执行
                         ↓
                    无中间文件
```

### 命令

```bash
/workflow:lite-lite-lite
# 或 CCW 自动识别简单任务时选择
```

### 适用场景

- ✅ 快速修复
- ✅ 简单功能添加
- ✅ 配置调整
- ✅ 小范围重命名
- ❌ 多模块改动
- ❌ 需要持久化记录

---

## Level 2: 轻量规划

**轻量 - 内存规划或单次分析，快速迭代**

### 包含工作流

| 工作流 | 用途 | 产物 | 执行方式 |
|--------|------|------|----------|
| `lite-plan` | 明确需求的功能开发 | memory://plan | → `lite-execute` |
| `lite-fix` | Bug 诊断修复 | `.workflow/.lite-fix/` | → `lite-execute` |
| `multi-cli-plan` | 需要多视角的任务 | `.workflow/.multi-cli-plan/` | → `lite-execute` |

### 共同特点

| 属性 | 值 |
|------|-----|
| **复杂度** | 低-中 |
| **状态** | 会话内 / 轻量持久化 |
| **执行** | 统一通过 `lite-execute` |
| **适用** | 需求相对明确的任务 |

---

### 2.1 lite-plan → lite-execute

**内存规划 + 直接执行**

```
┌─────────────────┐     ┌─────────────────┐
│  lite-plan      │ ──→ │  lite-execute   │
│  内存中规划      │     │  直接执行       │
└─────────────────┘     └─────────────────┘
```

```bash
/workflow:lite-plan    # 规划
/workflow:lite-execute # 执行
```

**适用**: 明确需求的单模块功能

---

### 2.2 lite-fix

**智能诊断 + 修复 (5 阶段)**

```
Phase 1: Bug Analysis & Diagnosis
   ├─ 智能严重性预评估 (Low/Medium/High/Critical)
   └─ 并行 cli-explore-agent 诊断 (1-4 个角度)

Phase 2: Clarification (可选)
   └─ 聚合澄清需求，AskUserQuestion

Phase 3: Fix Planning
   ├─ Low/Medium → Claude 直接规划
   └─ High/Critical → cli-lite-planning-agent

Phase 4: Confirmation & Selection
   └─ 用户确认执行方式

Phase 5: Execute
   └─ SlashCommand("/workflow:lite-execute --in-memory --mode bugfix")
```

```bash
/workflow:lite-fix           # 标准修复
/workflow:lite-fix --hotfix  # 紧急热修复 (跳过诊断)
```

**产物**: `.workflow/.lite-fix/{bug-slug}-{date}/`
- `diagnosis-{angle}.json` (1-4 个诊断文件)
- `diagnoses-manifest.json`
- `fix-plan.json`

**适用**: Bug 诊断修复、紧急生产问题

---

### 2.3 multi-cli-plan → lite-execute

**多 CLI 协作分析 + 共识收敛 (5 阶段)**

```
Phase 1: Context Gathering
   └─ ACE 语义搜索，构建上下文包

Phase 2: Multi-CLI Discussion (迭代)
   ├─ cli-discuss-agent 执行 Gemini + Codex + Claude
   ├─ 交叉验证，合成方案
   └─ 循环直到收敛或达到最大轮数

Phase 3: Present Options
   └─ 展示方案及权衡

Phase 4: User Decision
   └─ 用户选择方案

Phase 5: Plan Generation
   ├─ cli-lite-planning-agent 生成计划
   └─ → lite-execute
```

```bash
/workflow:multi-cli-plan "task description"  # 多 CLI 协作规划
/workflow:lite-execute                       # 执行选定方案
```

**产物**: `.workflow/.multi-cli-plan/{MCP-task-slug-date}/`
- `rounds/*/synthesis.json` (每轮分析)
- `context-package.json`
- `IMPL_PLAN.md` + `plan.json`

**vs lite-plan 对比**:

| 维度 | multi-cli-plan | lite-plan |
|------|---------------|-----------|
| **上下文** | ACE 语义搜索 | 手动文件模式 |
| **分析** | 多 CLI 交叉验证 | 单次规划 |
| **迭代** | 多轮直到收敛 | 单轮 |
| **置信度** | 高 (共识驱动) | 中 (单一视角) |

**适用**: 需要多视角分析、技术选型、方案比较

---

## Level 3: 标准规划

**标准 - 完整规划 + 持久化 Session + 验证**

### 包含工作流

| 工作流 | 用途 | 阶段数 | 产物位置 |
|--------|------|--------|----------|
| `plan` | 复杂功能开发 | 5 阶段 | `.workflow/active/{session}/` |
| `tdd-plan` | 测试驱动开发 | 6 阶段 | `.workflow/active/{session}/` |
| `test-fix-gen` | 测试修复生成 | 5 阶段 | `.workflow/active/WFS-test-{session}/` |

### 共同特点

| 属性 | 值 |
|------|-----|
| **复杂度** | 中-高 |
| **产物** | 持久化文件 (`.workflow/active/{session}/`) |
| **状态** | 完整 session 管理 |
| **验证** | 内置验证步骤 |
| **执行** | `/workflow:execute` |
| **适用** | 多模块、需要追溯的任务 |

---

### 3.1 plan → verify → execute

**5 阶段完整规划工作流**

```
Phase 1: Session Discovery
   └─ /workflow:session:start --auto

Phase 2: Context Gathering
   └─ /workflow:tools:context-gather
      └─ 返回 context-package.json + conflict_risk

Phase 3: Conflict Resolution (条件触发)
   └─ IF conflict_risk ≥ medium → /workflow:tools:conflict-resolution

Phase 4: Task Generation
   └─ /workflow:tools:task-generate-agent
      └─ 返回 IMPL_PLAN.md + IMPL-*.json + TODO_LIST.md

Return: Summary + Next Steps
```

```bash
/workflow:plan "task description"   # 完整规划
/workflow:action-plan-verify        # 验证计划 (推荐)
/workflow:execute                   # 执行
/workflow:review                    # (可选) 审查
```

**产物**: `.workflow/active/{WFS-session}/`
- `workflow-session.json`
- `IMPL_PLAN.md`
- `TODO_LIST.md`
- `.task/IMPL-*.json`
- `.process/context-package.json`

**适用**: 多模块改动、重构任务、需要依赖分析

---

### 3.2 tdd-plan → execute → tdd-verify

**6 阶段测试驱动开发工作流**

```
Phase 1: Session Discovery
   └─ /workflow:session:start --type tdd --auto

Phase 2: Context Gathering
   └─ /workflow:tools:context-gather

Phase 3: Test Coverage Analysis
   └─ /workflow:tools:test-context-gather
      └─ 检测测试框架，分析覆盖率

Phase 4: Conflict Resolution (条件触发)
   └─ IF conflict_risk ≥ medium → /workflow:tools:conflict-resolution

Phase 5: TDD Task Generation
   └─ /workflow:tools:task-generate-tdd
      └─ 生成内置 Red-Green-Refactor 循环的 IMPL 任务

Phase 6: TDD Structure Validation
   └─ 验证 TDD 结构合规性
```

```bash
/workflow:tdd-plan "feature description"  # TDD 规划
/workflow:action-plan-verify              # 验证 (推荐)
/workflow:execute                         # 执行 (遵循 Red-Green-Refactor)
/workflow:tdd-verify                      # 验证 TDD 流程合规
```

**TDD 任务结构**:
- 每个 IMPL 任务包含完整的 Red-Green-Refactor 内部循环
- `meta.tdd_workflow: true`
- `flow_control.implementation_approach` 包含 3 步 (red/green/refactor)
- Green 阶段包含 test-fix-cycle 配置

**适用**: 测试驱动开发、高质量要求的功能

---

### 3.3 test-fix-gen → test-cycle-execute

**5 阶段测试修复生成工作流**

```
Phase 1: Create Test Session
   └─ /workflow:session:start --type test --new

Phase 2: Gather Test Context
   ├─ Session Mode: /workflow:tools:test-context-gather
   └─ Prompt Mode: /workflow:tools:context-gather

Phase 3: Test Generation Analysis
   └─ /workflow:tools:test-concept-enhanced
      └─ 多层测试需求 (L0: Static, L1: Unit, L2: Integration, L3: E2E)

Phase 4: Generate Test Tasks
   └─ /workflow:tools:test-task-generate
      └─ IMPL-001 (生成) + IMPL-001.5 (质量门) + IMPL-002 (执行修复)

Phase 5: Return Summary
   └─ → /workflow:test-cycle-execute
```

**双模式支持**:
| 模式 | 输入模式 | 上下文来源 |
|------|----------|-----------|
| Session Mode | `WFS-xxx` | 源 session 摘要 |
| Prompt Mode | 文本/文件路径 | 直接代码库分析 |

```bash
/workflow:test-fix-gen WFS-user-auth-v2        # Session Mode
/workflow:test-fix-gen "Test the auth API"     # Prompt Mode
/workflow:test-cycle-execute                   # 执行测试修复循环
```

**产物**: `.workflow/active/WFS-test-{session}/`
- `.task/IMPL-001.json` (测试理解与生成)
- `.task/IMPL-001.5-review.json` (质量门)
- `.task/IMPL-002.json` (测试执行与修复循环)
- `.process/TEST_ANALYSIS_RESULTS.md`

**适用**: 测试失败修复、覆盖率提升

---

## Level 4: 头脑风暴 (brainstorm:auto-parallel)

**最复杂 - 多角色头脑风暴 + 完整规划 + 执行**

### 特点

| 属性 | 值 |
|------|-----|
| **复杂度** | 高 |
| **产物** | 多角色分析文档 + `IMPL_PLAN.md` |
| **角色数** | 3-9 个 (默认 3) |
| **执行模式** | Phase 1/3 串行，Phase 2 并行 |

### 3 阶段流程

```
Phase 1: Interactive Framework Generation
   └─ /workflow:brainstorm:artifacts
      ├─ Topic 分析，生成问题
      ├─ 角色选择 (用户确认)
      ├─ 角色问题收集
      ├─ 冲突检测与解决
      └─ 生成 guidance-specification.md

Phase 2: Parallel Role Analysis (并行)
   └─ N × Task(conceptual-planning-agent)
      ├─ 每个角色独立分析
      └─ 并行生成 {role}/analysis.md

Phase 3: Synthesis Integration
   └─ /workflow:brainstorm:synthesis
      └─ 整合所有角色分析 → synthesis-specification.md
```

### 命令

```bash
/workflow:brainstorm:auto-parallel "topic" [--count N] [--style-skill package]
/workflow:plan --session {sessionId}     # 基于头脑风暴结果规划
/workflow:action-plan-verify             # 验证
/workflow:execute                        # 执行
```

### 可用角色

| 角色 | 描述 |
|------|------|
| `system-architect` | 系统架构师 |
| `ui-designer` | UI 设计师 |
| `ux-expert` | UX 专家 |
| `product-manager` | 产品经理 |
| `product-owner` | 产品负责人 |
| `data-architect` | 数据架构师 |
| `scrum-master` | 敏捷教练 |
| `subject-matter-expert` | 领域专家 |
| `test-strategist` | 测试策略师 |

### 产物结构

```
.workflow/active/WFS-{topic}/
├── workflow-session.json              # Session 元数据
└── .brainstorming/
    ├── guidance-specification.md      # 框架 (Phase 1)
    ├── {role}/
    │   ├── analysis.md                # 主文档
    │   └── analysis-{slug}.md         # 子文档 (可选，最多 5 个)
    └── synthesis-specification.md     # 整合 (Phase 3)
```

### 适用场景

- ✅ 全新功能设计
- ✅ 系统架构重构
- ✅ 探索性需求
- ✅ 不确定如何实现
- ✅ 需要多维度权衡
- ❌ 需求已明确
- ❌ 时间紧迫的任务

---

## Issue 工作流

**主干工作流的补充 - 开发后的持续维护**

### 两阶段生命周期

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 1: Accumulation (积累阶段)                  │
│                                                                     │
│   触发源:                                                           │
│   • 任务完成后的 review                                              │
│   • 代码审查发现                                                     │
│   • 测试失败                                                        │
│                                                                     │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐             │
│   │ discover   │     │ discover-  │     │    new     │             │
│   │ 自动发现   │     │ by-prompt  │     │  手动创建  │             │
│   └────────────┘     └────────────┘     └────────────┘             │
│                                                                     │
│   持续积累 Issue 到待处理队列                                         │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ 积累足够后
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Phase 2: Batch Resolution (批量解决)                │
│                                                                     │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐             │
│   │   plan     │ ──→ │   queue    │ ──→ │  execute   │             │
│   │ --all-     │     │ 优化顺序   │     │ 并行执行   │             │
│   │  pending   │     │ 冲突分析   │     │           │             │
│   └────────────┘     └────────────┘     └────────────┘             │
│                                                                     │
│   支持 Worktree 隔离，保持主分支稳定                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 命令清单

**积累阶段:**
```bash
/issue:discover            # 多视角自动发现
/issue:discover-by-prompt  # 基于提示发现
/issue:new                 # 手动创建
```

**批量解决:**
```bash
/issue:plan --all-pending  # 批量规划所有待处理
/issue:queue               # 生成优化执行队列
/issue:execute             # 并行执行
```

### 与主干工作流的协作模式

```
┌─────────────────────────────────────────────────────────────────────┐
│                         开发迭代循环                                 │
│                                                                     │
│   ┌─────────┐                              ┌─────────┐             │
│   │ Feature │ ──→ Main Workflow ──→ 完成 ──→│ Review  │             │
│   │ Request │     (Level 1-4)              └────┬────┘             │
│   └─────────┘                                   │                  │
│        ▲                                        │ 发现问题          │
│        │                                        ▼                  │
│        │                                  ┌─────────┐              │
│        │                                  │  Issue  │              │
│        │                                  │ Workflow│              │
│   继续 │                                  └────┬────┘              │
│   新功能│                                       │                  │
│        │         ┌──────────────────────────────┘                  │
│        │         │ 修复完成                                         │
│        │         ▼                                                 │
│   ┌────┴────┐◀──────                                               │
│   │  Main   │    合并                                              │
│   │ Branch  │    回主干                                            │
│   └─────────┘                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 工作流选择指南

### 快速选择表

| 场景 | 推荐工作流 | Level |
|------|-----------|-------|
| 快速修复、配置调整 | `lite-lite-lite` | 1 |
| 明确需求的单模块功能 | `lite-plan → lite-execute` | 2 |
| Bug 诊断修复 | `lite-fix` | 2 |
| 紧急生产问题 | `lite-fix --hotfix` | 2 |
| 技术选型、方案比较 | `multi-cli-plan → lite-execute` | 2 |
| 多模块改动、重构 | `plan → verify → execute` | 3 |
| 测试驱动开发 | `tdd-plan → execute → tdd-verify` | 3 |
| 测试失败修复 | `test-fix-gen → test-cycle-execute` | 3 |
| 全新功能、架构设计 | `brainstorm:auto-parallel → plan → execute` | 4 |
| 开发后问题修复 | Issue Workflow | - |

### 决策流程图

```
开始
  │
  ├─ 是开发后的维护问题？
  │     ├─ 是 → Issue Workflow
  │     └─ 否 ↓
  │
  ├─ 需求是否明确？
  │     ├─ 不确定 → Level 4 (brainstorm:auto-parallel)
  │     └─ 明确 ↓
  │
  ├─ 需要持久化 Session？
  │     ├─ 是 → Level 3 (plan / tdd-plan / test-fix-gen)
  │     └─ 否 ↓
  │
  ├─ 需要多视角 / 方案比较？
  │     ├─ 是 → Level 2 (multi-cli-plan)
  │     └─ 否 ↓
  │
  ├─ 是 Bug 修复？
  │     ├─ 是 → Level 2 (lite-fix)
  │     └─ 否 ↓
  │
  ├─ 是否需要规划？
  │     ├─ 是 → Level 2 (lite-plan)
  │     └─ 否 → Level 1 (lite-lite-lite)
```

### 复杂度指标

系统根据以下关键词自动评估复杂度：

| 权重 | 关键词 |
|------|--------|
| +2 | refactor, 重构, migrate, 迁移, architect, 架构, system, 系统 |
| +2 | multiple, 多个, across, 跨, all, 所有, entire, 整个 |
| +1 | integrate, 集成, api, database, 数据库 |
| +1 | security, 安全, performance, 性能, scale, 扩展 |

- **高复杂度** (≥4): 自动选择 Level 3-4
- **中复杂度** (2-3): 自动选择 Level 2
- **低复杂度** (<2): 自动选择 Level 1

---

## 语义化 CLI 调用

用户可以在提示词中 **语义指定 CLI 工具** - 系统自动调用对应的 CLI。

### 基础调用

| 用户提示词 | 系统动作 |
|------------|----------|
| "使用 Gemini 分析 auth 模块" | 自动调用 `gemini` CLI 进行分析 |
| "让 Codex 审查这段代码" | 自动调用 `codex` CLI 进行审查 |
| "问问 Qwen 性能优化建议" | 自动调用 `qwen` CLI 进行咨询 |

### 多 CLI 编排

| 模式 | 用户提示词示例 |
|------|----------------|
| **协同分析** | "使用 Gemini 和 Codex 协同分析安全漏洞" |
| **并行执行** | "让 Gemini、Codex、Qwen 并行分析架构设计" |
| **迭代优化** | "用 Gemini 诊断问题，然后 Codex 修复，迭代直到解决" |
| **流水线** | "Gemini 设计方案，Codex 实现，Claude 审查" |

### 自定义 CLI 注册

通过 Dashboard 界面 **注册任意 API 为自定义 CLI**：

```bash
ccw view  # 打开 Dashboard → Status → API Settings → 添加自定义 CLI
```

| 字段 | 示例 |
|------|------|
| **名称** | `deepseek` |
| **端点** | `https://api.deepseek.com/v1/chat` |
| **API Key** | `your-api-key` |

> 注册一次，永久语义调用 - 无需修改代码。

---

## ACE Tool 配置

ACE (Augment Context Engine) 提供强大的语义代码搜索能力。两种配置方式：

| 方式 | 链接 |
|------|------|
| **官方** | [Augment MCP 文档](https://docs.augmentcode.com/context-services/mcp/overview) |
| **代理** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

### 使用示例

```javascript
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "authentication logic"
})
```

---

## 总结

### 分级总览

| Level | 名称 | 包含工作流 | 产物 | 执行方式 |
|-------|------|-----------|------|----------|
| **1** | 急速执行 | `lite-lite-lite` | 无 | 直接执行 |
| **2** | 轻量规划 | `lite-plan`, `lite-fix`, `multi-cli-plan` | 内存/轻量文件 | → `lite-execute` |
| **3** | 标准规划 | `plan`, `tdd-plan`, `test-fix-gen` | Session 持久化 | → `execute` / `test-cycle-execute` |
| **4** | 头脑风暴 | `brainstorm:auto-parallel` → `plan` | 多角色分析 + Session | → `execute` |
| **-** | Issue | `discover` → `plan` → `queue` → `execute` | Issue 记录 | Worktree 隔离 (可选) |

### 核心原则

1. **主干工作流**通过**依赖分析 + Agent 并行**解决并行问题，无需 worktree
2. **Issue 工作流**作为**补充机制**，支持 worktree 隔离以保持主分支稳定
3. 根据任务复杂度选择合适的工作流层级，**避免过度工程化**
4. Level 2 的三个工作流选择依据：
   - 需求明确 → `lite-plan`
   - Bug 修复 → `lite-fix`
   - 需要多视角 → `multi-cli-plan`
5. Level 3 的三个工作流选择依据：
   - 标准开发 → `plan`
   - 测试驱动 → `tdd-plan`
   - 测试修复 → `test-fix-gen`
