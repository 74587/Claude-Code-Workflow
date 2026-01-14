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
│  ┌──────┐   ┌─────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐   │
│  │ Init │   │Diagnose │  │Diagnose│  │Diagnose│  │Diagnose│  │ Gemini  │   │
│  │      │   │ Context │  │ Memory │  │DataFlow│  │ Agent  │  │Analysis │   │
│  └──────┘   └─────────┘  └────────┘  └────────┘  └────────┘  └─────────┘   │
│      │           │           │           │            │            │        │
│      └───────────┴───────────┴───────────┴────────────┴────────────┘        │
│                              ↓                                               │
│                    ┌──────────────────┐                                      │
│                    │  Apply Fixes +   │                                      │
│                    │  Verify Results  │                                      │
│                    └──────────────────┘                                      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Gemini CLI Integration                              │  │
│  │  根据用户需求动态调用 gemini cli 进行深度分析:                          │  │
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
| **P0** | Data Flow Disruption | Scattered state, inconsistent formats | Centralized session store, transactional updates |
| **P1** | Agent Coordination | Fragile call chains, merge complexity | Dedicated orchestrator, enforced data contracts |
| **P2** | Context Explosion | Token accumulation, multi-turn bloat | Context summarization, sliding window, structured state |
| **P3** | Long-tail Forgetting | Early constraint loss | Constraint injection, checkpointing, goal alignment |

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
| [specs/problem-taxonomy.md](specs/problem-taxonomy.md) | Problem classification and detection patterns | **P0** |
| [specs/tuning-strategies.md](specs/tuning-strategies.md) | Fix strategies for each problem type | **P0** |
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
│  → Read: Target skill's SKILL.md and phases/*.md                            │
│  → Output: 内化规范，理解目标 skill 结构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-init: Initialize Tuning Session                                      │
│  → Create work directory: .workflow/.scratchpad/skill-tuning-{timestamp}    │
│  → Initialize state.json with target skill info                             │
│  → Create backup of target skill files                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-diagnose-context: Context Explosion Analysis                         │
│  → Scan for token accumulation patterns                                      │
│  → Detect multi-turn dialogue growth                                         │
│  → Output: context-diagnosis.json                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-diagnose-memory: Long-tail Forgetting Analysis                       │
│  → Trace constraint propagation through phases                               │
│  → Detect early instruction loss                                             │
│  → Output: memory-diagnosis.json                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-diagnose-dataflow: Data Flow Analysis                                │
│  → Map state transitions between phases                                      │
│  → Detect format inconsistencies                                             │
│  → Output: dataflow-diagnosis.json                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-diagnose-agent: Agent Coordination Analysis                          │
│  → Analyze agent call patterns                                               │
│  → Detect result passing issues                                              │
│  → Output: agent-diagnosis.json                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-generate-report: Consolidated Report                                 │
│  → Merge all diagnosis results                                               │
│  → Prioritize issues by severity                                             │
│  → Output: tuning-report.md                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  action-propose-fixes: Fix Proposal Generation                               │
│  → Generate fix strategies for each issue                                    │
│  → Create implementation plan                                                │
│  → Output: fix-proposals.json                                                │
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
│  → Generate final report                                                     │
│  → Cleanup temporary files                                                   │
│  → Output: tuning-summary.md                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Setup

```javascript
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const workDir = `.workflow/.scratchpad/skill-tuning-${timestamp}`;

Bash(`mkdir -p "${workDir}/diagnosis"`);
Bash(`mkdir -p "${workDir}/backups"`);
Bash(`mkdir -p "${workDir}/fixes"`);
```

## Output Structure

```
.workflow/.scratchpad/skill-tuning-{timestamp}/
├── state.json                      # Session state (orchestrator-managed)
├── diagnosis/
│   ├── context-diagnosis.json      # Context explosion analysis
│   ├── memory-diagnosis.json       # Long-tail forgetting analysis
│   ├── dataflow-diagnosis.json     # Data flow analysis
│   └── agent-diagnosis.json        # Agent coordination analysis
├── backups/
│   └── {skill-name}-backup/        # Original skill files backup
├── fixes/
│   ├── fix-proposals.json          # Proposed fixes
│   └── applied-fixes.json          # Applied fix history
├── tuning-report.md                # Consolidated diagnosis report
└── tuning-summary.md               # Final summary
```

## State Schema

```typescript
interface TuningState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  target_skill: {
    name: string;
    path: string;
    execution_mode: 'sequential' | 'autonomous';
  };
  user_issue_description: string;
  diagnosis: {
    context: DiagnosisResult | null;
    memory: DiagnosisResult | null;
    dataflow: DiagnosisResult | null;
    agent: DiagnosisResult | null;
  };
  issues: Issue[];
  proposed_fixes: Fix[];
  applied_fixes: AppliedFix[];
  iteration_count: number;
  max_iterations: number;
  quality_score: number;
  completed_actions: string[];
  current_action: string | null;
  errors: Error[];
  error_count: number;
}

interface DiagnosisResult {
  status: 'completed' | 'skipped';
  issues_found: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  details: any;
}

interface Issue {
  id: string;
  type: 'context_explosion' | 'memory_loss' | 'dataflow_break' | 'agent_failure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  evidence: string[];
}

interface Fix {
  id: string;
  issue_id: string;
  strategy: string;
  description: string;
  changes: FileChange[];
  risk: 'low' | 'medium' | 'high';
}
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | Orchestrator decision logic |
| [phases/state-schema.md](phases/state-schema.md) | State structure definition |
| [phases/actions/action-init.md](phases/actions/action-init.md) | Initialize tuning session |
| [phases/actions/action-diagnose-context.md](phases/actions/action-diagnose-context.md) | Context explosion diagnosis |
| [phases/actions/action-diagnose-memory.md](phases/actions/action-diagnose-memory.md) | Long-tail forgetting diagnosis |
| [phases/actions/action-diagnose-dataflow.md](phases/actions/action-diagnose-dataflow.md) | Data flow diagnosis |
| [phases/actions/action-diagnose-agent.md](phases/actions/action-diagnose-agent.md) | Agent coordination diagnosis |
| [phases/actions/action-generate-report.md](phases/actions/action-generate-report.md) | Report generation |
| [phases/actions/action-propose-fixes.md](phases/actions/action-propose-fixes.md) | Fix proposal |
| [phases/actions/action-apply-fix.md](phases/actions/action-apply-fix.md) | Fix application |
| [phases/actions/action-verify.md](phases/actions/action-verify.md) | Verification |
| [phases/actions/action-complete.md](phases/actions/action-complete.md) | Finalization |
| [specs/problem-taxonomy.md](specs/problem-taxonomy.md) | Problem classification |
| [specs/tuning-strategies.md](specs/tuning-strategies.md) | Fix strategies |
| [specs/quality-gates.md](specs/quality-gates.md) | Quality criteria |
