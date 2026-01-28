---
name: skill-tuning
description: Universal skill diagnosis and optimization tool. Detect and fix skill execution issues including context explosion, long-tail forgetting, data flow disruption, and agent coordination failures. Supports Gemini CLI for deep analysis. Triggers on "skill tuning", "tune skill", "skill diagnosis", "optimize skill", "skill debug".
allowed-tools: Task, AskUserQuestion, Read, Write, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Skill Tuning

Universal skill diagnosis and optimization tool that identifies and resolves skill execution problems through iterative multi-agent analysis.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Skill Tuning Architecture (Autonomous Mode + Gemini CLI)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ⚠️ Phase 0: Specification  → 阅读规范 + 理解目标 skill 结构 (强制前置)       │
│              Study                                                           │
│           ↓                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Orchestrator (状态驱动决策)                          │  │
│  │  读取诊断状态 → 选择下一步动作 → 执行 → 更新状态 → 循环直到完成         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│     ┌────────────┬───────────┼───────────┬────────────┬────────────┐        │
│     ↓            ↓           ↓           ↓            ↓            ↓        │
│  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌────────┐  ┌─────────┐  │
│  │ Init │→ │ Analyze  │→ │Diagnose │  │Diagnose│  │Diagnose│  │ Gemini  │  │
│  │      │  │Requiremts│  │ Context │  │ Memory │  │DataFlow│  │Analysis │  │
│  └──────┘  └──────────┘  └─────────┘  └────────┘  └────────┘  └─────────┘  │
│                 │              │           │           │            │        │
│                 │              └───────────┴───────────┴────────────┘        │
│                 ↓                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Requirement Analysis (NEW)                                            │  │
│  │  • Phase 1: 维度拆解 (Gemini CLI) - 单一描述 → 多个关注维度             │  │
│  │  • Phase 2: Spec 匹配 - 每个维度 → taxonomy + strategy                 │  │
│  │  • Phase 3: 覆盖度评估 - 以"有修复策略"为满足标准                       │  │
│  │  • Phase 4: 歧义检测 - 识别多义性描述，必要时请求澄清                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              ↓                                               │
│                    ┌──────────────────┐                                      │
│                    │  Apply Fixes +   │                                      │
│                    │  Verify Results  │                                      │
│                    └──────────────────┘                                      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Gemini CLI Integration                              │  │
│  │  根据用户需求动态调用 gemini cli 进行深度分析:                          │  │
│  │  • 需求维度拆解 (requirement decomposition)                             │  │
│  │  • 复杂问题分析 (prompt engineering, architecture review)               │  │
│  │  • 代码模式识别 (pattern matching, anti-pattern detection)              │  │
│  │  • 修复策略生成 (fix generation, refactoring suggestions)               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Problem Domain

Based on comprehensive analysis, skill-tuning addresses **core skill issues** and **general optimization areas**:

### Core Skill Issues (自动检测)

| Priority | Problem | Root Cause | Solution Strategy |
|----------|---------|------------|-------------------|
| **P0** | Authoring Principles Violation | 中间文件存储, State膨胀, 文件中转 | eliminate_intermediate_files, minimize_state, context_passing |
| **P1** | Data Flow Disruption | Scattered state, inconsistent formats | state_centralization, schema_enforcement |
| **P2** | Agent Coordination | Fragile call chains, merge complexity | error_wrapping, result_validation |
| **P3** | Context Explosion | Token accumulation, multi-turn bloat | sliding_window, context_summarization |
| **P4** | Long-tail Forgetting | Early constraint loss | constraint_injection, checkpoint_restore |
| **P5** | Token Consumption | Verbose prompts, excessive state, redundant I/O | prompt_compression, lazy_loading, output_minimization |

### General Optimization Areas (按需分析 via Gemini CLI)

| Category | Issues | Gemini Analysis Scope |
|----------|--------|----------------------|
| **Prompt Engineering** | 模糊指令, 输出格式不一致, 幻觉风险 | 提示词优化, 结构化输出设计 |
| **Architecture** | 阶段划分不合理, 依赖混乱, 扩展性差 | 架构审查, 模块化建议 |
| **Performance** | 执行慢, Token消耗高, 重复计算 | 性能分析, 缓存策略 |
| **Error Handling** | 错误恢复不当, 无降级策略, 日志不足 | 容错设计, 可观测性增强 |
| **Output Quality** | 输出不稳定, 格式漂移, 质量波动 | 质量门控, 验证机制 |
| **User Experience** | 交互不流畅, 反馈不清晰, 进度不可见 | UX优化, 进度追踪 |

## Key Design Principles

1. **Problem-First Diagnosis**: Systematic identification before any fix attempt
2. **Data-Driven Analysis**: Record execution traces, token counts, state snapshots
3. **Iterative Refinement**: Multiple tuning rounds until quality gates pass
4. **Non-Destructive**: All changes are reversible with backup checkpoints
5. **Agent Coordination**: Use specialized sub-agents for each diagnosis type
6. **Gemini CLI On-Demand**: Deep analysis via CLI for complex/custom issues

---

## Gemini CLI Integration

根据用户需求动态调用 Gemini CLI 进行深度分析。

### Trigger Conditions

| Condition | Action | CLI Mode |
|-----------|--------|----------|
| 用户描述复杂问题 | 调用 Gemini 分析问题根因 | `analysis` |
| 自动诊断发现 critical 问题 | 请求深度分析确认 | `analysis` |
| 用户请求架构审查 | 执行架构分析 | `analysis` |
| 需要生成修复代码 | 生成修复提案 | `write` |
| 标准策略不适用 | 请求定制化策略 | `analysis` |

### CLI Command Template

```bash
ccw cli -p "
PURPOSE: ${purpose}
TASK: ${task_steps}
MODE: ${mode}
CONTEXT: @${skill_path}/**/*
EXPECTED: ${expected_output}
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/${mode}-protocol.md) | ${constraints}
" --tool gemini --mode ${mode} --cd ${skill_path}
```

### Analysis Types

#### 1. Problem Root Cause Analysis

```bash
ccw cli -p "
PURPOSE: Identify root cause of skill execution issue: ${user_issue_description}
TASK: • Analyze skill structure and phase flow • Identify anti-patterns • Trace data flow issues
MODE: analysis
CONTEXT: @**/*.md
EXPECTED: JSON with { root_causes: [], patterns_found: [], recommendations: [] }
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Focus on execution flow
" --tool gemini --mode analysis
```

#### 2. Architecture Review

```bash
ccw cli -p "
PURPOSE: Review skill architecture for scalability and maintainability
TASK: • Evaluate phase decomposition • Check state management patterns • Assess agent coordination
MODE: analysis
CONTEXT: @**/*.md
EXPECTED: Architecture assessment with improvement recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Focus on modularity
" --tool gemini --mode analysis
```

#### 3. Fix Strategy Generation

```bash
ccw cli -p "
PURPOSE: Generate fix strategy for issue: ${issue_id} - ${issue_description}
TASK: • Analyze issue context • Design fix approach • Generate implementation plan
MODE: analysis
CONTEXT: @**/*.md
EXPECTED: JSON with { strategy: string, changes: [], verification_steps: [] }
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Minimal invasive changes
" --tool gemini --mode analysis
```

---

## Mandatory Prerequisites

> **CRITICAL**: Read these documents before executing any action.

### Core Specs (Required)

| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/skill-authoring-principles.md](specs/skill-authoring-principles.md) | **首要准则：简洁高效、去除存储、上下文流转** | **P0** |
| [specs/problem-taxonomy.md](specs/problem-taxonomy.md) | Problem classification and detection patterns | **P0** |
| [specs/tuning-strategies.md](specs/tuning-strategies.md) | Fix strategies for each problem type | **P0** |
| [specs/dimension-mapping.md](specs/dimension-mapping.md) | Dimension to Spec mapping rules | **P0** |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality thresholds and verification criteria | P1 |

### Templates (Reference)

| Document | Purpose |
|----------|---------|
| [templates/diagnosis-report.md](templates/diagnosis-report.md) | Diagnosis report structure |
| [templates/fix-proposal.md](templates/fix-proposal.md) | Fix proposal format |

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 0: Specification Study (强制前置 - 禁止跳过)                           │
│  → Read: specs/problem-taxonomy.md (问题分类)                                │
│  → Read: specs/tuning-strategies.md (调优策略)                               │
│  → Read: specs/dimension-mapping.md (维度映射规则)                           │
│  → Read: Target skill's SKILL.md and phases/*.md                            │
│  → Output: 内化规范，理解目标 skill 结构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-init: Initialize Tuning Session                                      │
│  → Create work directory: .workflow/.scratchpad/skill-tuning-{timestamp}    │
│  → Initialize state.json with target skill info                             │
│  → Create backup of target skill files                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-analyze-requirements: Requirement Analysis                           │
│  → Phase 1: 维度拆解 (Gemini CLI) - 单一描述 → 多个关注维度                   │
│  → Phase 2: Spec 匹配 - 每个维度 → taxonomy + strategy                       │
│  → Phase 3: 覆盖度评估 - 以"有修复策略"为满足标准                             │
│  → Phase 4: 歧义检测 - 识别多义性描述，必要时请求澄清                         │
│  → Output: state.json (requirement_analysis field)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-diagnose-*: Diagnosis Actions (context/memory/dataflow/agent/docs/   │
│                      token_consumption)                                      │
│  → Execute pattern-based detection for each category                         │
│  → Output: state.json (diagnosis.{category} field)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-generate-report: Consolidated Report                                 │
│  → Generate markdown summary from state.diagnosis                            │
│  → Prioritize issues by severity                                             │
│  → Output: state.json (final_report field)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-propose-fixes: Fix Proposal Generation                               │
│  → Generate fix strategies for each issue                                    │
│  → Create implementation plan                                                │
│  → Output: state.json (proposed_fixes field)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-apply-fix: Apply Selected Fix                                        │
│  → User selects fix to apply                                                 │
│  → Execute fix with backup                                                   │
│  → Update state with fix result                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-verify: Verification                                                 │
│  → Re-run affected diagnosis                                                 │
│  → Check quality gates                                                       │
│  → Update iteration count                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-complete: Finalization                                               │
│  → Set status='completed'                                                    │
│  → Final report already in state.json (final_report field)                   │
│  → Output: state.json (final)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Setup

```javascript
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const workDir = `.workflow/.scratchpad/skill-tuning-${timestamp}`;

// Simplified: Only backups dir needed, diagnosis results go into state.json
Bash(`mkdir -p "${workDir}/backups"`);
```

## Output Structure

```
.workflow/.scratchpad/skill-tuning-{timestamp}/
├── state.json                      # Single source of truth (all results consolidated)
│   ├── diagnosis.*                 # All diagnosis results embedded
│   ├── issues[]                    # Found issues
│   ├── proposed_fixes[]            # Fix proposals
│   └── final_report                # Markdown summary (on completion)
└── backups/
    └── {skill-name}-backup/        # Original skill files backup
```

> **Token Optimization**: All outputs consolidated into state.json. No separate diagnosis files or report files.

## State Schema

详细状态结构定义请参阅 [phases/state-schema.md](phases/state-schema.md)。

核心状态字段：
- `status`: 工作流状态 (pending/running/completed/failed)
- `target_skill`: 目标 skill 信息
- `diagnosis`: 各维度诊断结果
- `issues`: 发现的问题列表
- `proposed_fixes`: 建议的修复方案

---

## Action Reference Guide

Navigation and entry points for each action in the autonomous workflow:

### Core Orchestration

**Document**: 🔗 [phases/orchestrator.md](phases/orchestrator.md)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Drive tuning workflow via state-driven action selection |
| **Decision Logic** | Termination checks → Action preconditions → Selection |
| **Related** | [phases/state-schema.md](phases/state-schema.md) |

---

### Initialization & Requirements

| Action | Document | Purpose | Preconditions |
|--------|----------|---------|---------------|
| **action-init** | [action-init.md](phases/actions/action-init.md) | Initialize session, backup target skill | `state.status === 'pending'` |
| **action-analyze-requirements** | [action-analyze-requirements.md](phases/actions/action-analyze-requirements.md) | Decompose user request into dimensions via Gemini CLI | After init, before diagnosis |

---

### Diagnosis Actions

| Action | Document | Purpose | Detects |
|--------|----------|---------|---------|
| **action-diagnose-context** | [action-diagnose-context.md](phases/actions/action-diagnose-context.md) | Context explosion analysis | Token accumulation, multi-turn bloat |
| **action-diagnose-memory** | [action-diagnose-memory.md](phases/actions/action-diagnose-memory.md) | Long-tail forgetting analysis | Early constraint loss |
| **action-diagnose-dataflow** | [action-diagnose-dataflow.md](phases/actions/action-diagnose-dataflow.md) | Data flow analysis | State inconsistency, format drift |
| **action-diagnose-agent** | [action-diagnose-agent.md](phases/actions/action-diagnose-agent.md) | Agent coordination analysis | Call chain failures, merge issues |
| **action-diagnose-docs** | [action-diagnose-docs.md](phases/actions/action-diagnose-docs.md) | Documentation structure analysis | Missing specs, unclear flow |
| **action-diagnose-token-consumption** | [action-diagnose-token-consumption.md](phases/actions/action-diagnose-token-consumption.md) | Token consumption analysis | Verbose prompts, redundant I/O |

---

### Analysis & Reporting

| Action | Document | Purpose | Output |
|--------|----------|---------|--------|
| **action-gemini-analysis** | [action-gemini-analysis.md](phases/actions/action-gemini-analysis.md) | Deep analysis via Gemini CLI | Custom issue diagnosis |
| **action-generate-report** | [action-generate-report.md](phases/actions/action-generate-report.md) | Consolidate diagnosis results | `state.final_report` |
| **action-propose-fixes** | [action-propose-fixes.md](phases/actions/action-propose-fixes.md) | Generate fix strategies | `state.proposed_fixes[]` |

---

### Fix & Verification

| Action | Document | Purpose | Preconditions |
|--------|----------|---------|---------------|
| **action-apply-fix** | [action-apply-fix.md](phases/actions/action-apply-fix.md) | Apply selected fix with backup | User selected fix |
| **action-verify** | [action-verify.md](phases/actions/action-verify.md) | Re-run diagnosis, check quality gates | After fix applied |

---

### Termination

| Action | Document | Purpose | Trigger |
|--------|----------|---------|---------|
| **action-complete** | [action-complete.md](phases/actions/action-complete.md) | Finalize session with report | All quality gates pass |
| **action-abort** | [action-abort.md](phases/actions/action-abort.md) | Abort session, restore backup | Error limit exceeded |

---

## Template Reference

| Template | Purpose | When Used |
|----------|---------|-----------|
| [templates/diagnosis-report.md](templates/diagnosis-report.md) | Diagnosis report structure | action-generate-report |
| [templates/fix-proposal.md](templates/fix-proposal.md) | Fix proposal format | action-propose-fixes |

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | Orchestrator decision logic |
| [phases/state-schema.md](phases/state-schema.md) | State structure definition |
| [phases/actions/action-init.md](phases/actions/action-init.md) | Initialize tuning session |
| [phases/actions/action-analyze-requirements.md](phases/actions/action-analyze-requirements.md) | Requirement analysis (NEW) |
| [phases/actions/action-diagnose-context.md](phases/actions/action-diagnose-context.md) | Context explosion diagnosis |
| [phases/actions/action-diagnose-memory.md](phases/actions/action-diagnose-memory.md) | Long-tail forgetting diagnosis |
| [phases/actions/action-diagnose-dataflow.md](phases/actions/action-diagnose-dataflow.md) | Data flow diagnosis |
| [phases/actions/action-diagnose-agent.md](phases/actions/action-diagnose-agent.md) | Agent coordination diagnosis |
| [phases/actions/action-diagnose-docs.md](phases/actions/action-diagnose-docs.md) | Documentation structure diagnosis |
| [phases/actions/action-diagnose-token-consumption.md](phases/actions/action-diagnose-token-consumption.md) | Token consumption diagnosis |
| [phases/actions/action-generate-report.md](phases/actions/action-generate-report.md) | Report generation |
| [phases/actions/action-propose-fixes.md](phases/actions/action-propose-fixes.md) | Fix proposal |
| [phases/actions/action-apply-fix.md](phases/actions/action-apply-fix.md) | Fix application |
| [phases/actions/action-verify.md](phases/actions/action-verify.md) | Verification |
| [phases/actions/action-complete.md](phases/actions/action-complete.md) | Finalization |
| [specs/problem-taxonomy.md](specs/problem-taxonomy.md) | Problem classification |
| [specs/tuning-strategies.md](specs/tuning-strategies.md) | Fix strategies |
| [specs/dimension-mapping.md](specs/dimension-mapping.md) | Dimension to Spec mapping (NEW) |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality criteria |
