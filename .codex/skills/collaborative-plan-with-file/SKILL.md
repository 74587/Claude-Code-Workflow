---
name: collaborative-plan-with-file
description: Parallel collaborative planning with Plan Note - Multi-agent parallel task generation, unified plan-note.md, conflict detection. Codex subagent-optimized.
argument-hint: "TASK=\"<description>\" [--max-agents=5]"
---

# Codex Collaborative-Plan-With-File Workflow

## Quick Start

Parallel collaborative planning workflow using **Plan Note** architecture. Spawns parallel subagents for each sub-domain, generates task plans concurrently, and detects conflicts across domains.

**Core workflow**: Understand → Template → Parallel Subagent Planning → Conflict Detection → Completion

**Key features**:
- **plan-note.md**: Shared collaborative document with pre-allocated sections
- **Parallel subagent planning**: Each sub-domain planned by its own subagent concurrently
- **Conflict detection**: Automatic file, dependency, and strategy conflict scanning
- **No merge needed**: Pre-allocated sections eliminate merge conflicts

**Codex-Specific Features**:
- Parallel subagent execution via `spawn_agent` + batch `wait({ ids: [...] })`
- Role loading via path (agent reads `~/.codex/agents/*.md` itself)
- Pre-allocated sections per agent = no write conflicts
- Explicit lifecycle management with `close_agent`

## Overview

This workflow enables structured planning through parallel-capable phases:

1. **Understanding & Template** - Analyze requirements, identify sub-domains, create plan-note.md template
2. **Parallel Planning** - Spawn subagent per sub-domain, batch wait for all results
3. **Conflict Detection** - Scan plan-note.md for conflicts across all domains
4. **Completion** - Generate human-readable plan.md summary

The key innovation is the **Plan Note** architecture - a shared collaborative document with pre-allocated sections per sub-domain, eliminating merge conflicts. Combined with Codex's true parallel subagent execution, all domains are planned simultaneously.

## Output Structure

```
{projectRoot}/.workflow/.planning/CPLAN-{slug}-{date}/
├── plan-note.md                  # ⭐ Core: Requirements + Tasks + Conflicts
├── requirement-analysis.json     # Phase 1: Sub-domain assignments
├── agents/                       # Phase 2: Per-domain plans (serial)
│   ├── {domain-1}/
│   │   └── plan.json            # Detailed plan
│   ├── {domain-2}/
│   │   └── plan.json
│   └── ...
├── conflicts.json                # Phase 3: Conflict report
└── plan.md                       # Phase 4: Human-readable summary
```

## Output Artifacts

### Phase 1: Understanding & Template

| Artifact | Purpose |
|----------|---------|
| `plan-note.md` | Collaborative template with pre-allocated task pool and evidence sections per domain |
| `requirement-analysis.json` | Sub-domain assignments, TASK ID ranges, complexity assessment |

### Phase 2: Parallel Planning

| Artifact | Purpose |
|----------|---------|
| `agents/{domain}/plan.json` | Detailed implementation plan per domain (from parallel subagent) |
| Updated `plan-note.md` | Task pool and evidence sections filled by each subagent |

### Phase 3: Conflict Detection

| Artifact | Purpose |
|----------|---------|
| `conflicts.json` | Detected conflicts with types, severity, and resolutions |
| Updated `plan-note.md` | Conflict markers section populated |

### Phase 4: Completion

| Artifact | Purpose |
|----------|---------|
| `plan.md` | Human-readable summary with requirements, tasks, and conflicts |

---

## Implementation Details

### Session Initialization

##### Step 0: Determine Project Root

检测项目根目录，确保 `.workflow/` 产物位置正确：

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

优先通过 git 获取仓库根目录；非 git 项目回退到 `pwd` 取当前绝对路径。
存储为 `{projectRoot}`，后续所有 `.workflow/` 路径必须以此为前缀。

The workflow automatically generates a unique session identifier and directory structure.

**Session ID Format**: `CPLAN-{slug}-{date}`
- `slug`: Lowercase alphanumeric, max 30 chars
- `date`: YYYY-MM-DD format (UTC+8)

**Session Directory**: `{projectRoot}/.workflow/.planning/{sessionId}/`

**Auto-Detection**: If session folder exists with plan-note.md, automatically enters continue mode.

**Session Variables**:
- `sessionId`: Unique session identifier
- `sessionFolder`: Base directory for all artifacts
- `maxDomains`: Maximum number of sub-domains (default: 5)

---

## Phase 1: Understanding & Template Creation

**Objective**: Analyze task requirements, identify parallelizable sub-domains, and create the plan-note.md template with pre-allocated sections.

### Step 1.1: Analyze Task Description

Use built-in tools to understand the task scope and identify sub-domains.

**Analysis Activities**:
1. **Extract task keywords** - Identify key terms and concepts from the task description
2. **Identify sub-domains** - Split into 2-5 parallelizable focus areas based on task complexity
3. **Assess complexity** - Evaluate overall task complexity (Low/Medium/High)
4. **Search for references** - Find related documentation, README files, and architecture guides

**Sub-Domain Identification Patterns**:

| Pattern | Keywords |
|---------|----------|
| Backend API | 服务, 后端, API, 接口 |
| Frontend | 界面, 前端, UI, 视图 |
| Database | 数据, 存储, 数据库, 持久化 |
| Testing | 测试, 验证, QA |
| Infrastructure | 部署, 基础, 运维, 配置 |

**Ambiguity Handling**: When the task description is unclear or has multiple interpretations, gather user clarification before proceeding.

### Step 1.2: Create plan-note.md Template

Generate a structured template with pre-allocated sections for each sub-domain.

**plan-note.md Structure**:
- **YAML Frontmatter**: session_id, original_requirement, created_at, complexity, sub_domains, status
- **Section: 需求理解**: Core objectives, key points, constraints, split strategy
- **Section: 任务池 - {Domain N}**: Pre-allocated task section per domain (TASK-{range})
- **Section: 依赖关系**: Auto-generated after all domains complete
- **Section: 冲突标记**: Populated in Phase 3
- **Section: 上下文证据 - {Domain N}**: Evidence section per domain

**TASK ID Range Allocation**: Each domain receives a non-overlapping range of 100 IDs (e.g., Domain 1: TASK-001~100, Domain 2: TASK-101~200).

### Step 1.3: Generate requirement-analysis.json

Create the sub-domain configuration document.

**requirement-analysis.json Structure**:

| Field | Purpose |
|-------|---------|
| `session_id` | Session identifier |
| `original_requirement` | Task description |
| `complexity` | Low / Medium / High |
| `sub_domains[]` | Array of focus areas with descriptions |
| `sub_domains[].focus_area` | Domain name |
| `sub_domains[].description` | Domain scope description |
| `sub_domains[].task_id_range` | Non-overlapping TASK ID range |
| `sub_domains[].estimated_effort` | Effort estimate |
| `sub_domains[].dependencies` | Cross-domain dependencies |
| `total_domains` | Number of domains identified |

**Success Criteria**:
- 2-5 clear sub-domains identified
- Each sub-domain can be planned independently
- Plan Note template includes all pre-allocated sections
- TASK ID ranges have no overlap (100 IDs per domain)
- Requirements understanding is comprehensive

---

## Phase 2: Parallel Sub-Domain Planning

**Objective**: Spawn parallel subagents for each sub-domain, generating detailed plans and updating plan-note.md concurrently.

**Execution Model**: Parallel subagent execution - all domains planned simultaneously via `spawn_agent` + batch `wait`.

**Key API Pattern**:
```
spawn_agent × N → wait({ ids: [...] }) → verify outputs → close_agent × N
```

### Step 2.1: User Confirmation (unless autoMode)

Display identified sub-domains and confirm before spawning agents.

```javascript
// User confirmation
if (!autoMode) {
  // Display sub-domains for user approval
  // Options: "开始规划" / "调整拆分" / "取消"
}
```

### Step 2.2: Parallel Subagent Planning

**⚠️ IMPORTANT**: Role files are NOT read by main process. Pass path in message, agent reads itself.

**Spawn All Domain Agents in Parallel**:

```javascript
// Create agent directories first
subDomains.forEach(sub => {
  // mkdir: ${sessionFolder}/agents/${sub.focus_area}/
})

// Parallel spawn - all agents start immediately
const agentIds = subDomains.map(sub => {
  return spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-lite-planning-agent.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json
4. Read: ${sessionFolder}/plan-note.md (understand template structure)
5. Read: ${sessionFolder}/requirement-analysis.json (understand full context)

---

## Sub-Domain Context
**Focus Area**: ${sub.focus_area}
**Description**: ${sub.description}
**TASK ID Range**: ${sub.task_id_range[0]}-${sub.task_id_range[1]}
**Session**: ${sessionId}

## Dual Output Tasks

### Task 1: Generate Complete plan.json
Output: ${sessionFolder}/agents/${sub.focus_area}/plan.json

Include:
- Task breakdown with IDs from assigned range (${sub.task_id_range[0]}-${sub.task_id_range[1]})
- Dependencies within and across domains
- Files to modify with specific locations
- Effort and complexity estimates per task
- Conflict risk assessment for each task

### Task 2: Sync Summary to plan-note.md

**Locate Your Sections** (pre-allocated, ONLY modify these):
- Task Pool: "## 任务池 - ${toTitleCase(sub.focus_area)}"
- Evidence: "## 上下文证据 - ${toTitleCase(sub.focus_area)}"

**Task Summary Format**:
### TASK-{ID}: {Title} [${sub.focus_area}]
- **状态**: pending
- **复杂度**: Low/Medium/High
- **依赖**: TASK-xxx (if any)
- **范围**: Brief scope description
- **修改点**: file:line - change summary
- **冲突风险**: Low/Medium/High

**Evidence Format**:
- 相关文件: File list with relevance
- 现有模式: Patterns identified
- 约束: Constraints discovered

## Execution Steps
1. Explore codebase for domain-relevant files
2. Generate complete plan.json
3. Extract task summaries from plan.json
4. Read ${sessionFolder}/plan-note.md
5. Locate and fill your pre-allocated task pool section
6. Locate and fill your pre-allocated evidence section
7. Write back plan-note.md

## Important Rules
- ONLY modify your pre-allocated sections (do NOT touch other domains)
- Use assigned TASK ID range exclusively: ${sub.task_id_range[0]}-${sub.task_id_range[1]}
- Include conflict_risk assessment for each task

## Success Criteria
- [ ] Role definition read
- [ ] plan.json generated with detailed tasks
- [ ] plan-note.md updated with task pool and evidence
- [ ] All tasks within assigned ID range
`
  })
})

// Batch wait - TRUE PARALLELISM (key Codex advantage)
const results = wait({
  ids: agentIds,
  timeout_ms: 900000  // 15 minutes for all planning agents
})

// Handle timeout
if (results.timed_out) {
  const completed = agentIds.filter(id => results.status[id].completed)
  const pending = agentIds.filter(id => !results.status[id].completed)

  // Option: Continue waiting or use partial results
  // If most agents completed, proceed with partial results
}

// Verify outputs exist
subDomains.forEach((sub, index) => {
  const agentId = agentIds[index]
  if (results.status[agentId].completed) {
    // Verify: agents/${sub.focus_area}/plan.json exists
    // Verify: plan-note.md sections populated
  }
})

// Batch cleanup
agentIds.forEach(id => close_agent({ id }))
```

### Step 2.3: Verify plan-note.md Consistency

After all agents complete, verify the shared document.

**Verification Activities**:
1. Read final plan-note.md
2. Verify all task pool sections are populated
3. Verify all evidence sections are populated
4. Check for any accidental cross-section modifications
5. Validate TASK ID uniqueness across all domains

**Success Criteria**:
- All subagents spawned and completed (or timeout handled)
- `agents/{domain}/plan.json` created for each domain
- `plan-note.md` updated with all task pools and evidence sections
- Task summaries follow consistent format
- No TASK ID overlaps across domains
- All agents closed properly

---

## Phase 3: Conflict Detection

**Objective**: Analyze plan-note.md for conflicts across all domain contributions.

### Step 3.1: Parse plan-note.md

Extract all tasks from all "任务池" sections.

**Extraction Activities**:
1. Read plan-note.md content
2. Parse YAML frontmatter for session metadata
3. Identify all "任务池" sections by heading pattern
4. Extract tasks matching pattern: `### TASK-{ID}: {Title} [{domain}]`
5. Parse task details: status, complexity, dependencies, modification points, conflict risk
6. Consolidate into unified task list

### Step 3.2: Detect Conflicts

Scan all tasks for three categories of conflicts.

**Conflict Types**:

| Type | Severity | Detection Logic | Resolution |
|------|----------|-----------------|------------|
| file_conflict | high | Same file:location modified by multiple domains | Coordinate modification order or merge changes |
| dependency_cycle | critical | Circular dependencies in task graph (DFS detection) | Remove or reorganize dependencies |
| strategy_conflict | medium | Multiple high-risk tasks in same file from different domains | Review approaches and align on single strategy |

**Detection Activities**:
1. **File Conflicts**: Group modification points by file:location, identify locations modified by multiple domains
2. **Dependency Cycles**: Build dependency graph from task dependencies, detect cycles using depth-first search
3. **Strategy Conflicts**: Group tasks by files they modify, identify files with high-risk tasks from multiple domains

### Step 3.3: Generate Conflict Artifacts

Write conflict results and update plan-note.md.

**conflicts.json Structure**:
- `detected_at`: Detection timestamp
- `total_conflicts`: Number of conflicts found
- `conflicts[]`: Array of conflict objects with type, severity, tasks involved, description, suggested resolution

**plan-note.md Update**: Locate "冲突标记" section and populate with conflict summary markdown. If no conflicts found, mark as "✅ 无冲突检测到".

**Success Criteria**:
- All tasks extracted and analyzed
- `conflicts.json` written with detection results
- `plan-note.md` updated with conflict markers
- All conflict types checked (file, dependency, strategy)

---

## Phase 4: Completion

**Objective**: Generate human-readable plan summary and finalize workflow.

### Step 4.1: Generate plan.md

Create a human-readable summary from plan-note.md content.

**plan.md Structure**:

| Section | Content |
|---------|---------|
| Header | Session ID, task description, creation time |
| 需求 (Requirements) | Copied from plan-note.md "需求理解" section |
| 子领域拆分 (Sub-Domains) | Each domain with description, task range, estimated effort |
| 任务概览 (Task Overview) | All tasks with complexity, dependencies, and target files |
| 冲突报告 (Conflict Report) | Summary of detected conflicts or "无冲突" |
| 执行指令 (Execution) | Command to execute the plan |

### Step 4.2: Display Completion Summary

Present session statistics and next steps.

**Summary Content**:
- Session ID and directory path
- Total domains planned
- Total tasks generated
- Conflict status
- Execution command for next step

**Success Criteria**:
- `plan.md` generated with complete summary
- All artifacts present in session directory
- User informed of completion and next steps

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--max-domains` | 5 | Maximum sub-domains to identify |

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| **Subagent timeout** | Check `results.timed_out`, continue `wait()` or use partial results | Reduce scope, plan remaining domains with new agent |
| **Agent closed prematurely** | Cannot recover closed agent | Spawn new agent with domain context |
| **Parallel agent partial failure** | Some domains complete, some fail | Use completed results, re-spawn for failed domains |
| **plan-note.md write conflict** | Multiple agents write simultaneously | Pre-allocated sections prevent this; if detected, re-read and verify |
| **Section not found in plan-note** | Agent creates section defensively | Continue with new section |
| **No tasks generated** | Review domain description | Retry with refined description via new agent |
| **Conflict detection fails** | Continue with empty conflicts | Note in completion summary |
| **Session folder conflict** | Append timestamp suffix | Create unique folder |

### Codex-Specific Error Patterns

```javascript
// Safe parallel planning with error handling
try {
  const agentIds = subDomains.map(sub => spawn_agent({ message: buildPlanPrompt(sub) }))

  const results = wait({ ids: agentIds, timeout_ms: 900000 })

  if (results.timed_out) {
    const completed = agentIds.filter(id => results.status[id].completed)
    const pending = agentIds.filter(id => !results.status[id].completed)

    // Re-spawn for timed-out domains
    const retryIds = pending.map((id, i) => {
      const sub = subDomains[agentIds.indexOf(id)]
      return spawn_agent({ message: buildPlanPrompt(sub) })
    })

    const retryResults = wait({ ids: retryIds, timeout_ms: 600000 })
    retryIds.forEach(id => { try { close_agent({ id }) } catch(e) {} })
  }

} finally {
  // ALWAYS cleanup
  agentIds.forEach(id => {
    try { close_agent({ id }) } catch (e) { /* ignore */ }
  })
}
```

---

## Iteration Patterns

### New Planning Session (Parallel Mode)

```
User initiates: TASK="task description"
   ├─ No session exists → New session mode
   ├─ Analyze task and identify sub-domains
   ├─ Create plan-note.md template
   ├─ Generate requirement-analysis.json
   │
   ├─ Execute parallel planning:
   │   ├─ spawn_agent × N (one per sub-domain)
   │   ├─ wait({ ids: [...] })  ← TRUE PARALLELISM
   │   └─ close_agent × N
   │
   ├─ Verify plan-note.md consistency
   ├─ Detect conflicts
   ├─ Generate plan.md summary
   └─ Report completion
```

### Continue Existing Session

```
User resumes: TASK="same task"
   ├─ Session exists → Continue mode
   ├─ Load plan-note.md and requirement-analysis.json
   ├─ Identify incomplete domains (empty task pool sections)
   ├─ Spawn agents for incomplete domains only
   └─ Continue with conflict detection
```

### Agent Lifecycle Management

```
Subagent lifecycle:
   ├─ spawn_agent({ message }) → Create with role path + task
   ├─ wait({ ids, timeout_ms }) → Get results (ONLY way to get output)
   └─ close_agent({ id }) → Cleanup (MUST do, cannot recover)

Key rules:
   ├─ Pre-allocated sections = no write conflicts
   ├─ ALWAYS use wait() to get results, NOT close_agent()
   ├─ Batch wait for all domain agents: wait({ ids: [a, b, c, ...] })
   └─ Verify plan-note.md after batch completion
```

---

## Best Practices

### Before Starting Planning

1. **Clear Task Description**: Detailed requirements lead to better sub-domain splitting
2. **Reference Documentation**: Ensure latest README and design docs are identified
3. **Clarify Ambiguities**: Resolve unclear requirements before committing to sub-domains

### During Planning

1. **Review Plan Note**: Check plan-note.md between phases to verify progress
2. **Verify Domains**: Ensure sub-domains are truly independent and parallelizable
3. **Check Dependencies**: Cross-domain dependencies should be documented explicitly
4. **Inspect Details**: Review `agents/{domain}/plan.json` for specifics when needed

### Codex Subagent Best Practices

1. **Role Path, Not Content**: Pass `~/.codex/agents/*.md` path in message, let agent read itself
2. **Pre-allocated Sections**: Each agent only writes to its own sections - no write conflicts
3. **Batch wait**: Use `wait({ ids: [a, b, c] })` for all domain agents, not sequential waits
4. **Handle Timeouts**: Check `results.timed_out`, re-spawn for failed domains
5. **Explicit Cleanup**: Always `close_agent` when done, even on errors (use try/finally)
6. **Verify After Batch**: Read plan-note.md after all agents complete to verify consistency
7. **TASK ID Isolation**: Pre-assigned non-overlapping ranges prevent ID conflicts

### After Planning

1. **Resolve Conflicts**: Address high/critical conflicts before execution
2. **Review Summary**: Check plan.md for completeness and accuracy
3. **Validate Tasks**: Ensure all tasks have clear scope and modification targets

---

**Now execute collaborative-plan-with-file for**: $TASK
