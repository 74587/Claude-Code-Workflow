# Action: Issue Workflow

Issue 批量处理工作流：发现 → 创建 → 规划 → 队列 → 批量执行

## Complete Workflow Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  Issue Workflow - Complete Chain                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Discovery Phase (Optional)                                       │
│  ├─ /issue:discover          - 多视角问题发现                     │
│  └─ /issue:discover-by-prompt - 基于提示的迭代发现               │
│                                                                   │
│  Creation Phase                                                   │
│  └─ /issue:new               - 创建结构化 Issue                   │
│                                                                   │
│  Planning Phase                                                   │
│  └─ /issue:plan              - 生成解决方案                       │
│                                                                   │
│  Queue Phase                                                      │
│  └─ /issue:queue             - 冲突分析 + 队列构建                │
│                                                                   │
│  Execution Phase                                                  │
│  └─ /issue:execute           - DAG 并行执行                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Patterns

### Pattern 1: Full Discovery Flow
```
/issue:discover → /issue:new → /issue:plan → /issue:queue → /issue:execute
```
**Use when**: 不知道有什么问题，需要全面发现

### Pattern 2: Prompt-Driven Discovery
```
/issue:discover-by-prompt → /issue:plan → /issue:queue → /issue:execute
```
**Use when**: 有特定方向的问题探索

### Pattern 3: Direct Planning (Default)
```
/issue:plan → /issue:queue → /issue:execute
```
**Use when**: 已有明确的 Issue 列表

### Pattern 4: GitHub Import
```
/issue:new (GitHub URL) → /issue:plan → /issue:queue → /issue:execute
```
**Use when**: 从 GitHub Issues 导入

## Command Reference

### /issue:discover
多视角问题发现，支持 8 种视角的并行探索。

**视角列表**:
| Perspective | Description | Agent Type |
|-------------|-------------|------------|
| bug | 功能缺陷和错误 | CLI explore |
| ux | 用户体验问题 | CLI explore |
| test | 测试覆盖缺口 | CLI explore |
| quality | 代码质量问题 | CLI explore |
| security | 安全漏洞 | CLI explore + Exa |
| performance | 性能瓶颈 | CLI explore |
| maintainability | 可维护性问题 | CLI explore |
| best-practices | 最佳实践偏离 | CLI explore + Exa |

**输出**: `.workflow/issues/discoveries/` 下的发现报告

**调用方式**:
```bash
/issue:discover                    # 全视角发现
/issue:discover --perspectives security,performance  # 指定视角
```

### /issue:discover-by-prompt
基于用户提示的智能发现，使用 Gemini 规划迭代探索策略。

**核心能力**:
- ACE 语义搜索上下文收集
- 跨模块比较（如 API 契约一致性）
- 多轮迭代探索直到收敛

**调用方式**:
```bash
/issue:discover-by-prompt "检查前端后端API契约一致性"
```

### /issue:new
从 GitHub URL 或文本描述创建结构化 Issue。

**清晰度检测** (0-3分):
| Score | Level | Action |
|-------|-------|--------|
| 0 | 无法理解 | 必须澄清 |
| 1 | 基本理解 | 建议澄清 |
| 2 | 清晰 | 直接创建 |
| 3 | 详细 | 直接创建 |

**调用方式**:
```bash
/issue:new https://github.com/user/repo/issues/123  # GitHub 导入
/issue:new "登录页面在移动端显示异常"                 # 文本创建
```

**输出**: `.workflow/issues/issues.jsonl` 追加新 Issue

### /issue:plan
为每个 Issue 生成解决方案，使用 `issue-plan-agent`。

**核心流程**:
1. 加载未规划的 Issues
2. ACE 上下文探索
3. 生成 1-3 个解决方案/Issue
4. 用户选择绑定方案

**调用方式**:
```bash
/issue:plan                        # 规划所有未绑定 Issue
/issue:plan --issue ISS-001        # 规划特定 Issue
```

**输出**: `.workflow/issues/solutions/ISS-xxx.jsonl`

### /issue:queue
解决方案级别的队列构建，冲突分析，DAG 生成。

**使用 Agent**: `issue-queue-agent`

**冲突检测类型**:
| Type | Description | Severity | Resolution |
|------|-------------|----------|------------|
| file | 同文件修改 | Low | Sequential |
| api | API 签名变更 | Medium | Dependency ordering |
| data | 数据结构冲突 | High | User decision |
| dependency | 包依赖冲突 | Medium | Version negotiation |
| architecture | 架构方向冲突 | Critical | User decision |

**DAG 结构**:
```
execution_groups:
├── P1: Parallel (independent solutions)
├── S1: Sequential (depends on P1)
└── P2: Parallel (depends on S1)
```

**调用方式**:
```bash
/issue:queue                       # 构建队列
/issue:queue --dry-run             # 预览冲突分析
```

**输出**: `.workflow/issues/queues/QUE-xxx.json`

### /issue:execute
DAG 并行执行编排器，单 worktree 策略。

**Executor 选项**:
| Executor | Best For | Mode |
|----------|----------|------|
| codex (recommended) | 代码实现 | Autonomous |
| gemini | 复杂分析 | Analysis first |
| agent | 灵活控制 | Supervised |

**执行策略**:
- 单 worktree 用于整个队列
- 按 solution 粒度分发
- 自动处理依赖顺序
- 支持断点续传

**调用方式**:
```bash
/issue:execute                     # 执行当前队列
/issue:execute --queue QUE-xxx     # 执行特定队列
/issue:execute --resume            # 恢复中断的执行
```

## Trigger Conditions

CCW 自动识别以下关键词触发 Issue 工作流:

```javascript
const issuePatterns = {
  // Batch processing
  batch: /issues?|batch|queue|多个|批量|一批/i,
  
  // Action requirement
  action: /fix|resolve|处理|修复|解决/i,
  
  // Discovery
  discover: /discover|find|发现|检查|扫描|audit/i,
  
  // GitHub specific
  github: /github\.com\/.*\/issues/i
}

// Trigger when: batch + action OR discover OR github
```

## Issue Lifecycle

```
┌───────┐     ┌────────┐     ┌────────┐     ┌───────────┐     ┌───────────┐
│ draft │ ──▶ │ planned│ ──▶ │ queued │ ──▶ │ executing │ ──▶ │ completed │
└───────┘     └────────┘     └────────┘     └───────────┘     └───────────┘
                  │               │
                  ▼               ▼
             ┌─────────┐    ┌─────────┐
             │ skipped │    │ on-hold │
             └─────────┘    └─────────┘
```

## Configuration

```javascript
const issueConfig = {
  discover: {
    perspectives: ['bug', 'ux', 'test', 'quality', 'security', 'performance', 'maintainability', 'best-practices'],
    parallelExploration: true,
    exaIntegration: ['security', 'best-practices']
  },
  
  create: {
    clarityThreshold: 2,      // Minimum clarity score to proceed
    autoClarify: true,        // Prompt for missing info
    githubPublish: 'ask'      // ask | always | never
  },
  
  plan: {
    solutionsPerIssue: 3,     // Generate up to 3 solutions
    autoSelect: false,        // User must bind solution
    planningAgent: 'issue-plan-agent'
  },
  
  queue: {
    conflictAnalysis: true,
    priorityCalculation: true,
    clarifyThreshold: 'high', // Ask user for high-severity conflicts
    queueAgent: 'issue-queue-agent'
  },
  
  execute: {
    dagParallel: true,
    executionLevel: 'solution',
    executor: 'codex',
    resumable: true
  }
}
```

## Output Structure

```
.workflow/issues/
├── issues.jsonl                    # All issues (append-only)
├── discoveries/
│   ├── DIS-xxx.json                # Discovery session
│   └── reports/
│       ├── security.md
│       └── performance.md
├── solutions/
│   ├── ISS-001.jsonl               # Solutions for ISS-001
│   └── ISS-002.jsonl
├── queues/
│   ├── index.json                  # Queue index
│   └── QUE-xxx.json                # Queue details
└── execution/
    └── {queue-id}/
        ├── progress.json
        ├── logs/
        └── results/
```

## Example Invocations

```bash
# Complete discovery flow
ccw "全面检查代码库问题并批量修复"
→ /issue:discover (全视角)
→ /issue:new (创建发现的问题)
→ /issue:plan (生成方案)
→ /issue:queue (构建队列)
→ /issue:execute (批量执行)

# Security audit
ccw "安全审计并修复所有漏洞"
→ /issue:discover --perspectives security
→ /issue:plan
→ /issue:queue
→ /issue:execute

# GitHub batch processing
ccw "处理所有 label:bug 的 GitHub Issues"
→ /issue:new (批量导入)
→ /issue:plan
→ /issue:queue
→ /issue:execute

# Tech debt cleanup
ccw "清理技术债务"
→ /issue:discover --perspectives quality,maintainability
→ /issue:plan
→ /issue:queue
→ /issue:execute
```

## Integration with CCW Orchestrator

在 orchestrator.md 中的集成点:

```javascript
// Intent classification
if (matchesIssuePattern(input)) {
  // Determine entry point
  if (hasDiscoveryIntent(input)) {
    if (hasPromptDirection(input)) {
      return { workflow: 'issue:discover-by-prompt → issue:plan → issue:queue → issue:execute' }
    }
    return { workflow: 'issue:discover → issue:plan → issue:queue → issue:execute' }
  }
  
  if (hasGitHubUrl(input)) {
    return { workflow: 'issue:new → issue:plan → issue:queue → issue:execute' }
  }
  
  // Default: direct planning
  return { workflow: 'issue:plan → issue:queue → issue:execute' }
}
```
