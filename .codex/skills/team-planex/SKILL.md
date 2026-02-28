---
name: team-planex
description: |
  Inline planning + delegated execution pipeline. Main flow does planning directly,
  spawns Codex executor per issue immediately. All execution via Codex CLI only.
---

# Team PlanEx (Codex)

主流程内联规划 + 委托执行。SKILL.md 自身完成规划（不再 spawn planner agent），每完成一个 issue 的 solution 后立即 spawn executor agent 并行实现，无需等待所有规划完成。

## Architecture

```
┌────────────────────────────────────────┐
│  SKILL.md (主流程 = 规划 + 节拍控制)     │
│                                         │
│  Phase 1: 解析输入 + 初始化 session      │
│  Phase 2: 逐 issue 规划循环 (内联)       │
│    ├── issue-plan → 写 solution artifact │
│    ├── spawn executor agent ────────────┼──> [executor] 实现
│    └── continue (不等 executor)          │
│  Phase 3: 等待所有 executors             │
│  Phase 4: 汇总报告                       │
└────────────────────────────────────────┘
```

## Agent Registry

| Agent | Role File | Responsibility |
|-------|-----------|----------------|
| `executor` | `~/.codex/agents/planex-executor.md` | Codex CLI implementation per issue |

> Executor agent must be deployed to `~/.codex/agents/` before use.
> Source: `.codex/skills/team-planex/agents/`

---

## Input Parsing

Supported input types (parse from `$ARGUMENTS`):

| Type | Detection | Handler |
|------|-----------|---------|
| Issue IDs | `ISS-\d{8}-\d{6}` regex | Use directly for planning |
| Text | `--text '...'` flag | Create issue(s) first via CLI |
| Plan file | `--plan <path>` flag | Read file, parse phases, batch create issues |

### Issue Creation (when needed)

For `--text` input:
```bash
ccw issue create --data '{"title":"<title>","description":"<description>"}' --json
```

For `--plan` input:
- Match `## Phase N: Title`, `## Step N: Title`, or `### N. Title`
- Each match → one issue (title + description from section content)
- Fallback: no structure found → entire file as single issue

---

## Session Setup

Before processing issues, initialize session directory:

```javascript
const slug = toSlug(inputDescription).slice(0, 20)
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const sessionDir = `.workflow/.team/PEX-${slug}-${date}`
const artifactsDir = `${sessionDir}/artifacts/solutions`

Bash(`mkdir -p "${artifactsDir}"`)

Write({
  file_path: `${sessionDir}/team-session.json`,
  content: JSON.stringify({
    session_id: `PEX-${slug}-${date}`,
    input_type: inputType,
    input: rawInput,
    status: "running",
    started_at: new Date().toISOString(),
    executors: []
  }, null, 2)
})
```

---

## Phase 1: Parse Input + Initialize

1. Parse `$ARGUMENTS` to determine input type
2. Create issues if needed (--text / --plan)
3. Collect all issue IDs
4. Initialize session directory

---

## Phase 2: Inline Planning Loop

For each issue, execute planning inline (no planner agent):

### 2a. Generate Solution via issue-plan-agent

```javascript
const planAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/issue-plan-agent.md (MUST read first)

---

issue_ids: ["${issueId}"]
project_root: "${projectRoot}"

## Requirements
- Generate solution for this issue
- Auto-bind single solution
- Output solution JSON when complete
`
})

const result = wait({ ids: [planAgent], timeout_ms: 600000 })
close_agent({ id: planAgent })
```

### 2b. Write Solution Artifact

```javascript
const solution = parseSolution(result)

Write({
  file_path: `${artifactsDir}/${issueId}.json`,
  content: JSON.stringify({
    session_id: sessionId,
    issue_id: issueId,
    solution: solution,
    planned_at: new Date().toISOString()
  }, null, 2)
})
```

### 2c. Spawn Executor Immediately

```javascript
const executorId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/planex-executor.md (MUST read first)

---

## Issue
Issue ID: ${issueId}
Solution file: ${artifactsDir}/${issueId}.json
Session: ${sessionDir}

## Execution
Load solution from file → implement via Codex CLI → verify tests → commit → report.
`
})

executorIds.push(executorId)
executorIssueMap[executorId] = issueId
```

### 2d. Continue to Next Issue

Do NOT wait for executor. Proceed to next issue immediately.

---

## Phase 3: Wait All Executors

```javascript
if (executorIds.length > 0) {
  const execResults = wait({ ids: executorIds, timeout_ms: 1800000 })

  if (execResults.timed_out) {
    const pending = executorIds.filter(id => !execResults.status[id]?.completed)
    if (pending.length > 0) {
      const pendingIssues = pending.map(id => executorIssueMap[id])
      Write({
        file_path: `${sessionDir}/pending-executors.json`,
        content: JSON.stringify({ pending_issues: pendingIssues, executor_ids: pending }, null, 2)
      })
    }
  }

  // Collect summaries
  const summaries = executorIds.map(id => ({
    issue_id: executorIssueMap[id],
    status: execResults.status[id]?.completed ? 'completed' : 'timeout',
    output: execResults.status[id]?.completed ?? null
  }))

  // Cleanup
  executorIds.forEach(id => {
    try { close_agent({ id }) } catch { /* already closed */ }
  })
}
```

---

## Phase 4: Report

```javascript
const completed = summaries.filter(s => s.status === 'completed').length
const failed = summaries.filter(s => s.status === 'timeout').length

// Update session
Write({
  file_path: `${sessionDir}/team-session.json`,
  content: JSON.stringify({
    ...session,
    status: "completed",
    completed_at: new Date().toISOString(),
    results: { total: executorIds.length, completed, failed }
  }, null, 2)
})

return `
## Pipeline Complete

**Total issues**: ${executorIds.length}
**Completed**: ${completed}
**Timed out**: ${failed}

${summaries.map(s => `- ${s.issue_id}: ${s.status}`).join('\n')}

Session: ${sessionDir}
`
```

---

## User Commands

During execution, the user may issue:

| Command | Action |
|---------|--------|
| `check` / `status` | Show executor progress summary |
| `resume` / `continue` | Urge stalled executor |

---

## Error Handling

| Scenario | Resolution |
|----------|------------|
| issue-plan-agent timeout (>10 min) | Skip issue, log error, continue to next |
| issue-plan-agent failure | Retry once, then skip with error log |
| Solution file not written | Executor reports error, logs to `${sessionDir}/errors.json` |
| Executor (Codex CLI) failure | Executor handles resume; logs CLI resume command |
| No issues to process | Report error: no issues found |
