# Claude Skills - 团队协作类

## 一句话定位

**团队协作类 Skills 是多角色协同工作的编排系统** — 通过协调器、工作者角色和消息总线实现复杂任务的并行处理和状态同步。

## 解决的痛点

| 痛点 | 现状 | Claude_dms3 方案 |
| --- | --- | --- |
| **单模型局限** | 只能调用一个 AI 模型 | 多角色并行协作，发挥各自专长 |
| **任务编排混乱** | 手动管理任务依赖和状态 | 自动任务发现、依赖解析、流水线编排 |
| **协作流程割裂** | 团队成员各自为战 | 统一消息总线、共享状态、进度同步 |
| **资源浪费** | 重复上下文加载 | Wisdom 累积、探索缓存、产物复用 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `team-coordinate` | 通用团队协调器（动态角色生成） | `/team-coordinate` |
| `team-lifecycle-v5` | 全生命周期团队（规范→实现→测试→审查） | `/team-lifecycle` |
| `team-planex` | 规划-执行流水线（边规划边执行） | `/team-planex` |
| `team-review` | 代码审查团队（扫描→审查→修复） | `/team-review` |
| `team-testing` | 测试团队（策略→生成→执行→分析） | `/team-testing` |

## Skills 详解

### team-coordinate

**一句话定位**: 通用团队协调器 — 根据任务分析动态生成角色并编排执行

**触发**:
```
/team-coordinate <task-description>
/team-coordinate --role=coordinator <task>
/team-coordinate --role=<worker> --session=<path>
```

**功能**:
- 只有 coordinator 是内置的，所有工作者角色都是运行时动态生成
- 支持内循环角色（处理多个同前缀任务）
- Fast-Advance 机制跳过协调器直接派生后继任务
- Wisdom 累积跨任务知识

**角色注册表**:
| 角色 | 文件 | 任务前缀 | 类型 |
|------|------|----------|------|
| coordinator | roles/coordinator/role.md | (无) | 编排器 |
| (动态) | `<session>/roles/<role>.md` | (动态) | 工作者 |

**流水线**:
```
任务分析 → 生成角色 → 初始化会话 → 创建任务链 → 派生首批工作者 → 循环推进 → 完成报告
```

**会话目录**:
```
.workflow/.team/TC-<slug>-<date>/
├── team-session.json           # 会话状态 + 动态角色注册表
├── task-analysis.json          # Phase 1 输出
├── roles/                      # 动态角色定义
├── artifacts/                  # 所有 MD 交付产物
├── wisdom/                     # 跨任务知识
├── explorations/               # 共享探索缓存
├── discussions/                # 内联讨论记录
└── .msg/                       # 团队消息总线日志
```

---

### team-lifecycle-v5

**一句话定位**: 全生命周期团队 — 从规范到实现到测试到审查的完整流水线

**触发**:
```
/team-lifecycle <task-description>
```

**功能**:
- 基于 team-worker agent 架构，所有工作者共享同一代理定义
- 角色特定的 Phase 2-4 从 markdown 规范加载
- 支持规范流水线、实现流水线、前端流水线

**角色注册表**:
| 角色 | 规范 | 任务前缀 | 内循环 |
|------|------|----------|--------|
| coordinator | roles/coordinator/role.md | (无) | - |
| analyst | role-specs/analyst.md | RESEARCH-* | false |
| writer | role-specs/writer.md | DRAFT-* | true |
| planner | role-specs/planner.md | PLAN-* | true |
| executor | role-specs/executor.md | IMPL-* | true |
| tester | role-specs/tester.md | TEST-* | false |
| reviewer | role-specs/reviewer.md | REVIEW-* | false |
| architect | role-specs/architect.md | ARCH-* | false |
| fe-developer | role-specs/fe-developer.md | DEV-FE-* | false |
| fe-qa | role-specs/fe-qa.md | QA-FE-* | false |

**流水线定义**:
```
规范流水线 (6 任务):
  RESEARCH-001 → DRAFT-001 → DRAFT-002 → DRAFT-003 → DRAFT-004 → QUALITY-001

实现流水线 (4 任务):
  PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001

全生命周期 (10 任务):
  [规范流水线] → PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001

前端流水线:
  PLAN-001 → DEV-FE-001 → QA-FE-001 (GC 循环，最多 2 轮)
```

**质量关卡** (QUALITY-001 完成后):
```
═════════════════════════════════════════
SPEC PHASE COMPLETE
Quality Gate: <PASS|REVIEW|FAIL> (<score>%)

Dimension Scores:
  Completeness:  <bar> <n>%
  Consistency:   <bar> <n>%
  Traceability:  <bar> <n>%
  Depth:         <bar> <n>%
  Coverage:      <bar> <n>%

Available Actions:
  resume              -> Proceed to implementation
  improve             -> Auto-improve weakest dimension
  improve <dimension> -> Improve specific dimension
  revise <TASK-ID>    -> Revise specific document
  recheck             -> Re-run quality check
  feedback <text>     -> Inject feedback, create revision
═════════════════════════════════════════
```

**用户命令** (唤醒暂停的协调器):
| 命令 | 动作 |
|------|------|
| `check` / `status` | 输出执行状态图，不推进 |
| `resume` / `continue` | 检查工作者状态，推进下一步 |
| `revise <TASK-ID> [feedback]` | 创建修订任务 + 级联下游 |
| `feedback <text>` | 分析反馈影响，创建定向修订链 |
| `recheck` | 重新运行 QUALITY-001 质量检查 |
| `improve [dimension]` | 自动改进 readiness-report 中最弱维度 |

---

### team-planex

**一句话定位**: 边规划边执行团队 — 通过逐 Issue 节拍流水线实现 planner 和 executor 并行工作

**触发**:
```
/team-planex <task-description>
/team-planex --role=planner <input>
/team-planex --role=executor --input <solution-file>
```

**功能**:
- 2 成员团队（planner + executor），planner 担任 lead 角色
- 逐 Issue 节拍：planner 每完成一个 issue 的 solution 后立即创建 EXEC-* 任务
- Solution 写入中间产物文件，executor 从文件加载
- 支持多种执行后端（agent/codex/gemini）

**角色注册表**:
| 角色 | 文件 | 任务前缀 | 类型 |
|------|------|----------|------|
| planner | roles/planner.md | PLAN-* | pipeline (lead) |
| executor | roles/executor.md | EXEC-* | pipeline |

**输入类型**:
| 输入类型 | 格式 | 示例 |
|----------|------|------|
| Issue IDs | 直接传入 ID | `--role=planner ISS-20260215-001 ISS-20260215-002` |
| 需求文本 | `--text '...'` | `--role=planner --text '实现用户认证模块'` |
| Plan 文件 | `--plan path` | `--role=planner --plan plan/2026-02-15-auth.md` |

**Wave Pipeline** (逐 Issue 节拍):
```
Issue 1:  planner 规划 solution → 写中间产物 → 冲突检查 → 创建 EXEC-* → issue_ready
                ↓ (executor 立即开始)
Issue 2:  planner 规划 solution → 写中间产物 → 冲突检查 → 创建 EXEC-* → issue_ready
                ↓ (executor 并行消费)
Issue N:  ...
Final:    planner 发送 all_planned → executor 完成剩余 EXEC-* → 结束
```

**执行方法选择**:
| 执行器 | 后端 | 适用场景 |
|--------|------|----------|
| `agent` | code-developer subagent | 简单任务、同步执行 |
| `codex` | `ccw cli --tool codex --mode write` | 复杂任务、后台执行 |
| `gemini` | `ccw cli --tool gemini --mode write` | 分析类任务、后台执行 |

**用户命令**:
| 命令 | 动作 |
|------|------|
| `check` / `status` | 输出执行状态图，不推进 |
| `resume` / `continue` | 检查工作者状态，推进下一步 |
| `add <issue-ids or --text '...' or --plan path>` | 追加新任务到 planner 队列 |

---

### team-review

**一句话定位**: 代码审查团队 — 统一的代码扫描、漏洞审查、优化建议和自动修复

**触发**:
```
/team-review <target-path>
/team-review --full <target-path>      # scan + review + fix
/team-review --fix <review-files>      # fix only
/team-review -q <target-path>          # quick scan only
```

**功能**:
- 4 角色团队（coordinator, scanner, reviewer, fixer）
- 多维度审查：安全性、正确性、性能、可维护性
- 自动修复循环（审查 → 修复 → 验证）

**角色注册表**:
| 角色 | 文件 | 任务前缀 | 类型 |
|------|------|----------|------|
| coordinator | roles/coordinator/role.md | RC-* | 编排器 |
| scanner | roles/scanner/role.md | SCAN-* | 只读分析 |
| reviewer | roles/reviewer/role.md | REV-* | 只读分析 |
| fixer | roles/fixer/role.md | FIX-* | 代码生成 |

**流水线** (CP-1 Linear):
```
coordinator dispatch
  → SCAN-* (scanner: 工具链 + LLM 扫描)
  → REV-*  (reviewer: 深度分析 + 报告)
  → [用户确认]
  → FIX-*  (fixer: 规划 + 执行 + 验证)
```

**检查点**:
| 触发 | 位置 | 行为 |
|------|------|------|
| Review→Fix 过渡 | REV-* 完成 | 暂停，展示审查报告，等待用户 `resume` 确认修复 |
| 快速模式 (`-q`) | SCAN-* 后 | 流水线在扫描后结束，无审查/修复 |
| 仅修复模式 (`--fix`) | 入口 | 跳过扫描/审查，直接进入 fixer |

**审查维度**:
| 维度 | 检查点 |
|------|--------|
| 安全性 (sec) | 注入漏洞、敏感信息泄露、权限控制 |
| 正确性 (cor) | 边界条件、错误处理、类型安全 |
| 性能 (perf) | 算法复杂度、I/O 优化、资源使用 |
| 可维护性 (maint) | 代码结构、命名规范、注释质量 |

---

### team-testing

**一句话定位**: 测试团队 — 通过 Generator-Critic 循环实现渐进式测试覆盖

**触发**:
```
/team-testing <task-description>
```

**功能**:
- 5 角色团队（coordinator, strategist, generator, executor, analyst）
- 三种流水线：Targeted、Standard、Comprehensive
- Generator-Critic 循环自动改进测试覆盖率

**角色注册表**:
| 角色 | 文件 | 任务前缀 | 类型 |
|------|------|----------|------|
| coordinator | roles/coordinator.md | (无) | 编排器 |
| strategist | roles/strategist.md | STRATEGY-* | pipeline |
| generator | roles/generator.md | TESTGEN-* | pipeline |
| executor | roles/executor.md | TESTRUN-* | pipeline |
| analyst | roles/analyst.md | TESTANA-* | pipeline |

**三种流水线**:
```
Targeted (小范围变更):
  STRATEGY-001 → TESTGEN-001(L1 unit) → TESTRUN-001

Standard (渐进式):
  STRATEGY-001 → TESTGEN-001(L1) → TESTRUN-001(L1) → TESTGEN-002(L2) → TESTRUN-002(L2) → TESTANA-001

Comprehensive (完整覆盖):
  STRATEGY-001 → [TESTGEN-001(L1) + TESTGEN-002(L2)](并行) → [TESTRUN-001(L1) + TESTRUN-002(L2)](并行) → TESTGEN-003(L3) → TESTRUN-003(L3) → TESTANA-001
```

**Generator-Critic 循环**:
```
TESTGEN → TESTRUN → (如果覆盖率 < 目标) → TESTGEN-fix → TESTRUN-2
                     (如果覆盖率 >= 目标) → 下一层或 TESTANA
```

**测试层定义**:
| 层级 | 覆盖目标 | 示例 |
|------|----------|------|
| L1: Unit | 80% | 单元测试、函数级测试 |
| L2: Integration | 60% | 集成测试、模块间交互 |
| L3: E2E | 40% | 端到端测试、用户场景 |

**共享内存** (shared-memory.json):
| 角色 | 字段 |
|------|------|
| strategist | `test_strategy` |
| generator | `generated_tests` |
| executor | `execution_results`, `defect_patterns` |
| analyst | `analysis_report`, `coverage_history` |

## 相关命令

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Commands - Session](../commands/claude/session.md)

## 最佳实践

1. **选择合适的团队类型**:
   - 通用任务 → `team-coordinate`
   - 完整功能开发 → `team-lifecycle`
   - Issue 批处理 → `team-planex`
   - 代码审查 → `team-review`
   - 测试覆盖 → `team-testing`

2. **利用内循环角色**: 对于有多个同前缀串行任务的角色，设置 `inner_loop: true` 让单个工作者处理全部任务，避免重复派生开销

3. **Wisdom 累积**: 团队会话中的所有角色都会累积知识到 `wisdom/` 目录，后续任务可复用这些模式、决策和约定

4. **Fast-Advance**: 简单线性后继任务会自动跳过协调器直接派生，减少协调开销

5. **断点恢复**: 所有团队技能支持会话恢复，通过 `--resume` 或用户命令 `resume` 继续中断的会话
