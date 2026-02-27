# CCW 工作流指南

## 概述

CCW 提供了基于 **团队架构 v2** 和 **4级工作流系统** 的完整工作流体系，覆盖从快速原型到完整团队编排的软件开发全生命周期。

```
+---------------------------------------------------------------+
|                    4级工作流系统                               |
|                                                                |
|  +----------+   +----------+   +----------+   +--------------+ |
|  | Level 1  | ->| Level 2  | ->| Level 3  | ->| Level 4     | |
|  | 急速执行  |   | 轻量规划  |   | 标准规划  |   | 头脑风暴     | |
|  |          |   |          |   |          |   |              | |
|  | lite-    |   |lite-plan |   |   plan   |   | brainstorm   | |
|  | lite-lite|   |lite-fix  |   | tdd-plan |   | :auto-       | |
|  |          |   |multi-cli-|   |test-fix- |   |  parallel    | |
|  |          |   |  plan    |   |   gen    |   |     |        | |
|  +----------+   +----------+   +----------+   +-----|--------+ |
|                                                      |        |
|                                         +------------v------+ |
|                                         | 团队架构 v2        | |
|                                         | team-coordinate   | |
|                                         | team-executor     | |
|                                         +-------------------+ |
|                                                                |
|  手动程度: 高 -------------------------------------> 低: 自动  |
+---------------------------------------------------------------+
```

## v7.0 新增功能

**主要新特性**:
- **团队架构 v2**: `team-coordinate-v2` 和 `team-executor-v2` 统一 team-worker 代理
- **team-lifecycle-v5**: 完整生命周期统一团队技能 (规格 -> 实现 -> 测试 -> 审查)
- **队列调度器**: 具有依赖解析的后台任务执行
- **工作流会话命令**: `start`、`resume`、`complete`、`sync` 完整生命周期管理
- **节拍/韵律编排模型**: 事件驱动的协调模型
- **新仪表板视图**: 分析查看器、终端仪表板、编排器模板编辑器

---

## 目录

1. [4级工作流系统](#4级工作流系统)
2. [会话生命周期](#会话生命周期)
3. [团队架构 v2](#团队架构-v2)
4. [命令分类](#命令分类)
5. [技能分类](#技能分类)
6. [工作流选择指南](#工作流选择指南)
7. [Issue 工作流](#issue-工作流)

---

## 4级工作流系统

### Level 1: 急速执行 (lite-lite-lite)

**最快 - 直接执行，最小开销**

```
+-----------------+     +------------------+
| lite-lite-lite  | --> | 直接执行          |
+-----------------+     +------------------+
```

**特点**:
| 属性 | 值 |
|------|-----|
| **复杂度** | 最低 |
| **规划** | 内存中，即时 |
| **产物** | 无（仅代码） |
| **适用** | 快速修复、配置调整 |

**命令**:
```bash
/workflow:lite-lite-lite "为 API 添加 CORS 头"
```

---

### Level 2: 轻量规划

**快速 - 内存规划或单次分析，快速迭代**

| 工作流 | 用途 | 产物 | 执行方式 |
|--------|------|------|----------|
| `lite-plan` | 明确需求的功能开发 | memory://plan | -> `lite-execute` |
| `lite-fix` | Bug 诊断修复 | `.workflow/.lite-fix/` | -> `lite-execute` |
| `multi-cli-plan` | 需要多视角的任务 | `.workflow/.multi-cli-plan/` | -> `lite-execute` |

#### lite-plan -> lite-execute

**5阶段交互式工作流**:
```
阶段1: 任务分析与探索 (30-90秒)
   └─ 自动检测代码库上下文需求，启动 @cli-explore-agent

阶段2: 澄清 (用户依赖)
   └─ 基于探索发现的交互式问答

阶段3: 规划 (20-60秒)
   ├─ 低复杂度 -> 直接规划
   └─ 中/高复杂度 -> @cli-planning-agent

阶段4: 三维确认
   └─ 任务批准 + 执行方式 + 代码审查工具

阶段5: 执行与跟踪 (5-120分钟)
   └─ 所选方法的实时进度
```

**关键特性**:
- 智能代码探索（自动检测或用 `-e` 强制）
- 内存规划（无文件产物）
- 三维多选确认
- 灵活执行（Agent 或 CLI）
- 可选后续审查

```bash
/workflow:lite-plan "添加 JWT 认证"    # 基本用法
/workflow:lite-plan -e "重构日志模块"  # 强制探索
/workflow:lite-execute                # 执行计划
```

#### lite-fix

**智能 Bug 诊断 + 修复（5阶段）**:
```
阶段1: Bug 分析
   ├─ 严重性预评估 (Low/Medium/High/Critical)
   └─ 并行 cli-explore-agent 诊断 (1-4 个角度)

阶段2: 澄清 (可选)
   └─ 聚合澄清需求，AskUserQuestion

阶段3: 修复规划
   ├─ Low/Medium -> Claude 直接规划
   └─ High/Critical -> cli-lite-planning-agent

阶段4: 确认
   └─ 用户确认执行方式

阶段5: 执行
   └─ /workflow:lite-execute --in-memory --mode bugfix
```

```bash
/workflow:lite-fix           # 标准修复
/workflow:lite-fix --hotfix  # 紧急热修复（跳过诊断）
```

**产物**: `.workflow/.lite-fix/{bug-slug}-{date}/`

#### multi-cli-plan

**多 CLI 协作分析 + 共识收敛（5阶段）**:
```
阶段1: 上下文收集
   └─ ACE 语义搜索，构建上下文包

阶段2: 多 CLI 讨论（迭代）
   ├─ cli-discuss-agent: Gemini + Codex + Claude
   ├─ 交叉验证，合成方案
   └─ 循环直到收敛或达到最大轮数

阶段3: 展示选项
   └─ 展示方案及权衡

阶段4: 用户决策
   └─ 用户选择方案

阶段5: 计划生成
   └─ -> lite-execute
```

```bash
/workflow:multi-cli-plan "比较 OAuth 与 JWT 方案"
```

---

### Level 3: 标准规划

**完整 - 持久化 Session + 验证 + 完整执行**

| 工作流 | 用途 | 阶段数 | 产物位置 |
|--------|------|--------|----------|
| `plan` | 复杂功能开发 | 5 阶段 | `.workflow/active/{session}/` |
| `tdd-plan` | 测试驱动开发 | 6 阶段 | `.workflow/active/{session}/` |
| `test-fix-gen` | 测试修复生成 | 5 阶段 | `.workflow/active/WFS-test-{session}/` |

#### plan -> verify -> execute

**5阶段完整规划**:
```
阶段1: 会话发现
   └─ /workflow:session:start --auto

阶段2: 上下文收集
   └─ /workflow:tools:context-gather
      └─ 返回 context-package.json + conflict_risk

阶段3: 冲突解决（条件触发）
   └─ IF conflict_risk >= medium -> /workflow:tools:conflict-resolution

阶段4: 任务生成
   └─ /workflow:tools:task-generate-agent
      └─ 返回 IMPL_PLAN.md + IMPL-*.json + TODO_LIST.md

阶段5: 摘要 + 后续步骤
```

```bash
/workflow:plan "多模块重构"          # 完整规划
/workflow:plan-verify               # 验证计划（推荐）
/workflow:execute                   # 执行
/workflow:review                    # (可选) 审查
```

**产物**: `.workflow/active/{WFS-session}/`
- `workflow-session.json`
- `IMPL_PLAN.md`
- `TODO_LIST.md`
- `.task/IMPL-*.json`

#### tdd-plan -> execute -> tdd-verify

**6阶段测试驱动开发**:
```
阶段1: 会话发现 (--type tdd)
阶段2: 上下文收集
阶段3: 测试覆盖率分析
阶段4: 冲突解决（条件触发）
阶段5: TDD 任务生成（Red-Green-Refactor 循环）
阶段6: TDD 结构验证
```

```bash
/workflow:tdd-plan "用户认证"
/workflow:execute
/workflow:tdd-verify
```

**TDD 任务结构**:
- 每个 IMPL 任务包含完整的 Red-Green-Refactor 内部循环
- `meta.tdd_workflow: true`
- `flow_control.implementation_approach` 包含 3 步 (red/green/refactor)

#### test-fix-gen -> test-cycle-execute

**5阶段测试修复生成**:

**双模式支持**:
| 模式 | 输入 | 上下文来源 |
|------|------|-----------|
| Session 模式 | `WFS-xxx` | 源 session 摘要 |
| Prompt 模式 | 文本/文件路径 | 直接代码库分析 |

```bash
/workflow:test-fix-gen WFS-user-auth-v2     # Session 模式
/workflow:test-fix-gen "测试认证 API"       # Prompt 模式
/workflow:test-cycle-execute                # 执行测试修复循环
```

---

### Level 4: 头脑风暴 (brainstorm:auto-parallel)

**探索性 - 多角色头脑风暴 + 完整规划**

**3阶段流程**:
```
阶段1: 交互式框架生成
   └─ /workflow:brainstorm:artifacts
      ├─ 主题分析，生成问题
      ├─ 角色选择（用户确认）
      ├─ 角色问题收集
      └─ 生成 guidance-specification.md

阶段2: 并行角色分析
   └─ N x Task(conceptual-planning-agent)
      ├─ 每个角色独立分析
      └─ 并行生成 {role}/analysis.md

阶段3: 综合整合
   └─ /workflow:brainstorm:synthesis
      └─ 整合所有分析 -> synthesis-specification.md
```

```bash
/workflow:brainstorm:auto-parallel "实时协作系统"
/workflow:plan --session {sessionId}
/workflow:execute
```

**可用角色**:
| 角色 | 描述 |
|------|------|
| `system-architect` | 系统架构师 |
| `ui-designer` | UI 设计师 |
| `ux-expert` | UX 专家 |
| `product-manager` | 产品经理 |
| `data-architect` | 数据架构师 |
| `test-strategist` | 测试策略师 |

**产物结构**:
```
.workflow/active/WFS-{topic}/
├── workflow-session.json
└── .brainstorming/
    ├── guidance-specification.md
    ├── {role}/analysis.md
    └── synthesis-specification.md
```

---

## 会话生命周期

CCW v7.0 引入完整的会话生命周期命令，用于管理工作流会话从创建到完成的全过程。

### 会话命令概览

| 命令 | 用途 | 使用时机 |
|------|------|----------|
| `/workflow:session:start` | 启动新会话或发现现有 | 开始任何工作流 |
| `/workflow:session:resume` | 恢复暂停的会话 | 返回中断的工作 |
| `/workflow:session:complete` | 归档会话并提取经验 | 所有任务完成后 |
| `/workflow:session:sync` | 同步会话工作到规范 | 更新项目文档 |

### 启动会话

```bash
# 发现模式 - 列出活动会话
/workflow:session:start

# 自动模式 - 智能创建或重用
/workflow:session:start --auto "实现 OAuth2"

# 强制新模式
/workflow:session:start --new "用户认证功能"

# 指定会话类型
/workflow:session:start --type tdd --auto "测试驱动的登录"
```

**会话类型**:
- `workflow`: 标准实现（默认）
- `review`: 代码审查会话
- `tdd`: 测试驱动开发
- `test`: 测试生成/修复会话
- `docs`: 文档会话

### 完成会话

```bash
/workflow:session:complete          # 交互式完成
/workflow:session:complete --yes    # 自动完成并同步
/workflow:session:complete --detailed  # 带指标
```

**完成操作**:
- 将会话归档到 `.workflow/archives/`
- 生成带指标的 `manifest.json`
- 提取经验教训
- 自动同步项目状态（使用 `--yes`）

### 会话目录结构

```
.workflow/
├── active/                          # 活动会话
│   └── WFS-{session-name}/
│       ├── workflow-session.json    # 会话元数据
│       ├── IMPL_PLAN.md             # 实现计划
│       ├── TODO_LIST.md             # 任务清单
│       ├── .task/                   # 任务 JSON 文件
│       └── .process/                # 过程工件
├── archives/                        # 已完成的会话
└── project-tech.json                # 项目技术注册表
```

---

## 团队架构 v2

**适用于需要多角色专业知识和编排的复杂项目。**

### 概述

团队架构 v2 (`team-coordinate-v2`、`team-executor-v2`、`team-lifecycle-v5`) 为复杂软件开发工作流提供统一的 team-worker 代理架构。

```
+---------------------------------------------------------------+
|              Team Coordinate / Team Executor v2               |
|                                                               |
|  +-------------+      +-------------------------------------+ |
|  | Coordinator | ---> |  动态角色规范生成                     | |
|  | / Executor  |      |  (analyst, planner, executor, etc.) | |
|  +-------------+      +-------------------------------------+ |
|        |                            |                         |
|        v                            v                         |
|  +-------------+      +-------------------------------------+ |
|  |   任务      |      |         team-worker 代理             | |
|  |  分发       |      |  阶段1: 任务发现 (内置)              | |
|  +-------------+      |  阶段2-4: 角色特定 (规范文件)         | |
|                       |  阶段5: 报告 (内置)                  | |
|                       +-------------------------------------+ |
|                                    |                          |
|                                    v                          |
|                       +-------------------------------------+ |
|                       |  子代理 (Discuss, Explore, Docs)    | |
|                       +-------------------------------------+ |
+---------------------------------------------------------------+
```

### team-worker 代理

统一的工作代理:
- **阶段1（内置）**: 任务发现 - 按前缀和状态过滤任务
- **阶段2-4（角色特定）**: 从角色规范 markdown 文件加载领域逻辑
- **阶段5（内置）**: 报告 + 快速推进 - 处理完成和后继生成

### 角色规范文件

带有 YAML 前置信息的轻量级 markdown 文件:

```yaml
---
role: analyst
prefix: RESEARCH
inner_loop: false
subagents: [explore, discuss]
message_types:
  success: research_ready
  error: error
---
```

### 可用角色

| 角色 | 前缀 | 职责 | 内循环 |
|------|------|------|--------|
| analyst | RESEARCH | 代码库探索、分析 | 否 |
| writer | DRAFT | 文档生成 | 是 |
| planner | PLAN | 任务分解、依赖规划 | 是 |
| executor | IMPL | 实现和编码 | 是 |
| tester | TEST | 测试和质量保证 | 是 |
| reviewer | REVIEW | 代码审查和质量门 | 否 |
| architect | ARCH | 架构决策 | 否 |
| fe-developer | FE-IMPL | 前端实现 | 否 |
| fe-qa | FE-TEST | 前端测试 | 否 |

### 内循环框架

当 `inner_loop: true` 时，单个代理顺序处理所有相同前缀任务:

```
context_accumulator = []

阶段1: 查找第一个 IMPL-* 任务
  阶段2-4: 执行角色规范
  阶段5-L: 标记完成，记录，累积
    更多 IMPL-* 任务？ -> 阶段1（循环）
    没有了？ -> 阶段5-F（最终报告）
```

### 节拍/韵律编排模型

**事件驱动的协调模型**:

```
节拍循环（单个节拍）
======================================================================
  事件                    协调器                   工作者
----------------------------------------------------------------------
  回调/恢复 --> +- 处理回调 -+
                |  标记完成    |
                |  检查管道    |
                +- 处理生成下一个 -+
                |  查找就绪任务 |
                |  生成工作者 ---+--> [team-worker A]
                |  (可并行)  ----+--> [team-worker B]
                +- 停止 (空闲) ---+         |
                                               |
  回调 <---------------------------------------+
  (下一个节拍)
======================================================================
```

### 命令

#### Team Coordinate

从头生成角色规范并编排团队:

```bash
/team-coordinate "设计和实现实时协作系统"
```

**流程**:
1. 分析需求并检测能力
2. 动态生成角色规范
3. 创建带依赖链的任务
4. 生成 team-worker 代理
5. 通过回调监控进度
6. 完成并生成综合报告

#### Team Executor

执行预规划的团队会话:

```bash
/team-executor <session-folder>           # 初始执行
/team-executor <session-folder> resume    # 恢复暂停的会话
/team-executor <session-folder> status    # 检查状态
```

#### Team Lifecycle v5

完整生命周期统一团队技能（规格 -> 实现 -> 测试 -> 审查）:

```bash
# 触发词 "team lifecycle"
/team-lifecycle "构建带 OAuth2 的用户认证系统"
```

**管道定义**:

| 管道 | 任务数 | 流程 |
|------|--------|------|
| 仅规格 | 6 | RESEARCH -> DRAFT-001..004 -> QUALITY |
| 仅实现 | 4 | PLAN -> IMPL -> TEST + REVIEW |
| 完整生命周期 | 10 | [规格] -> PLAN -> IMPL -> TEST + REVIEW |
| 前端 | 3+ | PLAN -> DEV-FE -> QA-FE (GC 循环) |

### 子代理

| 子代理 | 用途 |
|--------|------|
| discuss | 多视角批判，动态视角 |
| explore | 代码库探索，带缓存 |
| doc-generation | 从模板生成文档 |

### 消息总线协议

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "<session_id>",      // 会话 ID，不是团队名称
  from: "<role>",
  to: "coordinator",
  type: "<message_type>",
  summary: "[<role>] <消息>",
  ref: "<artifact_path>"
})
```

### 会话结构

```
.workflow/.team/<session-id>/
├── team-session.json           # 会话元数据
├── task-analysis.json          # 任务依赖
├── role-specs/                 # 生成的角色规范文件
├── artifacts/                  # 任务输出
├── discussions/                # 多视角批判
├── explorations/               # 缓存的探索结果
└── wisdom/                     # 累积的经验
    ├── learnings.md
    ├── decisions.md
    ├── conventions.md
    └── issues.md
```

---

## 命令分类

### 工作流命令

多阶段开发的高级编排:

| 命令 | 用途 |
|------|------|
| `/workflow:plan` | 带会话的完整规划 |
| `/workflow:lite-plan` | 轻量交互式规划 |
| `/workflow:lite-fix` | Bug 诊断和修复 |
| `/workflow:execute` | 执行会话中的任务 |
| `/workflow:resume` | 恢复暂停的会话 |
| `/workflow:review` | 实现后审查 |
| `/workflow:status` | 查看工作流状态 |

### 会话命令

会话生命周期管理:

| 命令 | 用途 |
|------|------|
| `/workflow:session:start` | 启动新会话 |
| `/workflow:session:list` | 列出所有会话 |
| `/workflow:session:resume` | 恢复暂停的会话 |
| `/workflow:session:complete` | 归档已完成的会话 |
| `/workflow:session:sync` | 同步到项目规范 |

### CLI 命令

直接访问 AI 工具:

| 命令 | 用途 |
|------|------|
| `/cli:cli-init` | 初始化 CLI 工具配置 |
| `ccw cli -p "..." --tool gemini` | 使用 Gemini 执行 |
| `ccw cli -p "..." --tool codex --mode review` | 代码审查 |

### 内存命令

上下文和文档管理:

| 命令 | 用途 |
|------|------|
| `/memory:capture` | 捕获会话洞察 |
| `/memory:query` | 查询捕获的内存 |

### Issue 命令

开发后问题管理:

| 命令 | 用途 |
|------|------|
| `/issue:discover` | 自动发现问题 |
| `/issue:discover-by-prompt` | 基于提示发现 |
| `/issue:new` | 手动创建问题 |
| `/issue:plan --all-pending` | 批量规划所有待处理 |
| `/issue:queue` | 生成优化队列 |
| `/issue:execute` | 并行执行 |

---

## 技能分类

### 工作流技能

| 技能 | 用途 |
|------|------|
| `workflow-plan` | 标准规划工作流 |
| `workflow-lite-plan` | 轻量规划 |
| `workflow-multi-cli-plan` | 多 CLI 协作规划 |
| `workflow-tdd` | 测试驱动开发 |
| `workflow-test-fix` | 测试修复生成 |
| `workflow-execute` | 任务执行引擎 |

### 团队技能

| 技能 | 用途 |
|------|------|
| `team-lifecycle-v5` | 完整生命周期（规格 -> 实现 -> 测试） |
| `team-coordinate-v2` | 从头编排团队 |
| `team-executor-v2` | 执行预规划的团队会话 |
| `team-brainstorm` | 多角色头脑风暴 |
| `team-frontend` | 前端聚焦团队 |
| `team-testing` | 测试聚焦团队 |
| `team-review` | 审查聚焦团队 |

### 专用技能

| 技能 | 用途 |
|------|------|
| `brainstorm` | 单代理头脑风暴 |
| `review-cycle` | 代码审查循环 |
| `review-code` | 代码审查 |
| `spec-generator` | 规格生成 |
| `skill-generator` | 创建新技能 |
| `command-generator` | 生成斜杠命令 |

---

## 工作流选择指南

### 快速选择表

| 场景 | 推荐工作流 | Level |
|------|-----------|-------|
| 快速修复、配置调整 | `lite-lite-lite` | 1 |
| 明确需求的单模块功能 | `lite-plan -> lite-execute` | 2 |
| Bug 诊断修复 | `lite-fix` | 2 |
| 紧急生产问题 | `lite-fix --hotfix` | 2 |
| 技术选型、方案比较 | `multi-cli-plan -> lite-execute` | 2 |
| 多模块改动、重构 | `plan -> verify -> execute` | 3 |
| 测试驱动开发 | `tdd-plan -> execute -> tdd-verify` | 3 |
| 测试失败修复 | `test-fix-gen -> test-cycle-execute` | 3 |
| 全新功能、架构设计 | `brainstorm:auto-parallel -> plan` | 4 |
| 复杂多角色项目 | `team-lifecycle-v5` | Team |
| 开发后问题修复 | Issue Workflow | - |

### 决策流程图

```
开始
  |
  +-- 是开发后的维护问题？
  |     +-- 是 -> Issue Workflow
  |     +-- 否 -->
  |
  +-- 需要完整团队编排？
  |     +-- 是 -> team-lifecycle-v5 / team-coordinate-v2
  |     +-- 否 -->
  |
  +-- 需求是否明确？
  |     +-- 不确定 -> Level 4 (brainstorm:auto-parallel)
  |     +-- 明确 -->
  |
  +-- 需要持久化 Session？
  |     +-- 是 -> Level 3 (plan / tdd-plan / test-fix-gen)
  |     +-- 否 -->
  |
  +-- 需要多视角/方案比较？
  |     +-- 是 -> Level 2 (multi-cli-plan)
  |     +-- 否 -->
  |
  +-- 是 Bug 修复？
  |     +-- 是 -> Level 2 (lite-fix)
  |     +-- 否 -->
  |
  +-- 是否需要规划？
        +-- 是 -> Level 2 (lite-plan)
        +-- 否 -> Level 1 (lite-lite-lite)
```

### 复杂度指标

系统自动评估复杂度:

| 权重 | 关键词 |
|------|--------|
| +2 | refactor, 重构, migrate, 迁移, architect, 架构, system, 系统 |
| +2 | multiple, 多个, across, 跨, all, 所有, entire, 整个 |
| +1 | integrate, 集成, api, database, 数据库 |
| +1 | security, 安全, performance, 性能, scale, 扩展 |

- **高复杂度** (>=4): 自动选择 Level 3/Team
- **中复杂度** (2-3): 自动选择 Level 2
- **低复杂度** (<2): 自动选择 Level 1

---

## Issue 工作流

**主干工作流的补充 - 开发后的持续维护**

### 两阶段生命周期

```
+-------------------------------------------------------------+
|                 阶段1: 积累                                   |
|                                                              |
|   触发源:                                                     |
|   * 任务完成后的 review                                       |
|   * 代码审查发现                                              |
|   * 测试失败                                                  |
|                                                              |
|   +------------+    +------------+    +------------+         |
|   |  discover  |    | discover-  |    |    new     |         |
|   |   自动     |    | by-prompt  |    |  手动创建   |         |
|   +------------+    +------------+    +------------+         |
|                                                              |
|   持续积累 Issue 到待处理队列                                  |
+-------------------------------------------------------------+
                              |
                              | 积累足够后
                              v
+-------------------------------------------------------------+
|               阶段2: 批量解决                                 |
|                                                              |
|   +------------+    +------------+    +------------+         |
|   |    plan    | -> |   queue    | -> |   execute  |         |
|   | --all-     |    |  优化顺序   |    |  并行执行   |         |
|   |  pending   |    |  冲突分析   |    |           |         |
|   +------------+    +------------+    +------------+         |
|                                                              |
|   支持 Worktree 隔离，保持主分支稳定                           |
+-------------------------------------------------------------+
```

### 命令清单

**积累阶段**:
```bash
/issue:discover            # 多视角自动发现
/issue:discover-by-prompt  # 基于提示发现
/issue:new                 # 手动创建
```

**批量解决**:
```bash
/issue:plan --all-pending  # 批量规划所有待处理
/issue:queue               # 生成优化执行队列
/issue:execute             # 并行执行
```

---

## 总结

### 分级总览

| Level | 名称 | 工作流 | 产物 | 执行方式 |
|-------|------|--------|------|----------|
| **1** | 急速 | `lite-lite-lite` | 无 | 直接执行 |
| **2** | 轻量 | `lite-plan`, `lite-fix`, `multi-cli-plan` | 内存/轻量 | `lite-execute` |
| **3** | 标准 | `plan`, `tdd-plan`, `test-fix-gen` | Session | `execute` |
| **4** | 头脑风暴 | `brainstorm:auto-parallel` | 多角色 + Session | `plan -> execute` |
| **Team** | 编排 | `team-lifecycle-v5`, `team-*` | 完整团队产物 | Coordinator |
| **Issue** | 维护 | `discover -> plan -> queue -> execute` | Issue 记录 | Worktree (可选) |

### 核心原则

1. **主干工作流**通过**依赖分析 + Agent 并行**解决并行问题
2. **Issue 工作流**作为**补充机制**，支持 worktree 隔离
3. 根据任务复杂度选择合适的工作流层级，**避免过度工程化**
4. **Level 1-4** 是手动命令选择；**团队架构**提供智能编排
5. 使用**会话生命周期**命令进行完整工作流状态管理
6. 利用**内循环**角色进行同类型任务的批处理
