---
description: Serial collaborative planning with Plan Note - Single-agent sequential task generation, unified plan-note.md, conflict detection. Codex-optimized.
argument-hint: "TASK=\"<description>\" [--max-domains=5] [--focus=<domain>]"
---

# Codex Collaborative-Plan-With-File Workflow

## Quick Start

Serial collaborative planning workflow using **Plan Note** architecture. Processes sub-domains sequentially, generates task plans, and detects conflicts across domains.

**Core workflow**: Understand → Template → Sequential Planning → Conflict Detection → Completion

**Key features**:
- **plan-note.md**: Shared collaborative document with pre-allocated sections
- **Serial domain processing**: Each sub-domain planned sequentially via CLI
- **Conflict detection**: Automatic file, dependency, and strategy conflict scanning
- **No merge needed**: Pre-allocated sections eliminate merge conflicts

**Note**: Codex does not support parallel agent execution. All domains are processed serially.

## Overview

This workflow enables structured planning through sequential phases:

1. **Understanding & Template** - Analyze requirements, identify sub-domains, create plan-note.md template
2. **Sequential Planning** - Process each sub-domain serially via CLI analysis
3. **Conflict Detection** - Scan plan-note.md for conflicts across all domains
4. **Completion** - Generate human-readable plan.md summary

The key innovation is the **Plan Note** architecture - a shared collaborative document with pre-allocated sections per sub-domain, eliminating merge conflicts.

## Output Structure

```
.workflow/.planning/CPLAN-{slug}-{date}/
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

### Phase 2: Sequential Planning

| Artifact | Purpose |
|----------|---------|
| `agents/{domain}/plan.json` | Detailed implementation plan per domain |
| Updated `plan-note.md` | Task pool and evidence sections filled for each domain |

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

The workflow automatically generates a unique session identifier and directory structure.

**Session ID Format**: `CPLAN-{slug}-{date}`
- `slug`: Lowercase alphanumeric, max 30 chars
- `date`: YYYY-MM-DD format (UTC+8)

**Session Directory**: `.workflow/.planning/{sessionId}/`

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

## Phase 2: Sequential Sub-Domain Planning

**Objective**: Process each sub-domain serially via CLI analysis, generating detailed plans and updating plan-note.md.

**Execution Model**: Serial processing - plan each domain completely before moving to the next. Later domains can reference earlier planning results.

### Step 2.1: Domain Planning Loop

For each sub-domain in sequence:
1. Execute Gemini CLI analysis for the current domain
2. Parse CLI output into structured plan
3. Save detailed plan as `agents/{domain}/plan.json`
4. Update plan-note.md with task summaries and evidence

**Planning Guideline**: Wait for each domain's CLI analysis to complete before proceeding to the next.

### Step 2.2: CLI Planning for Each Domain

Execute synchronous CLI analysis to generate a detailed implementation plan.

**CLI Analysis Scope**:
- **PURPOSE**: Generate detailed implementation plan for the specific domain
- **CONTEXT**: Domain description, related codebase files, prior domain results
- **TASK**: Analyze domain, identify all necessary tasks, define dependencies, estimate effort
- **EXPECTED**: JSON output with tasks, summaries, interdependencies, total effort

**Analysis Output Should Include**:
- Task breakdown with IDs from the assigned range
- Dependencies within and across domains
- Files to modify with specific locations
- Effort and complexity estimates per task
- Conflict risk assessment for each task

### Step 2.3: Update plan-note.md After Each Domain

Parse CLI output and update the plan-note.md sections for the current domain.

**Task Summary Format** (for "任务池" section):
- Task header: `### TASK-{ID}: {Title} [{domain}]`
- Fields: 状态 (status), 复杂度 (complexity), 依赖 (dependencies), 范围 (scope)
- Modification points: File paths with line ranges and change summaries
- Conflict risk assessment: Low/Medium/High

**Evidence Format** (for "上下文证据" section):
- Related files with relevance descriptions
- Existing patterns identified in codebase
- Constraints discovered during analysis

**Success Criteria**:
- All domains processed sequentially
- `agents/{domain}/plan.json` created for each domain
- `plan-note.md` updated with all task pools and evidence sections
- Task summaries follow consistent format

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
| `--focus` | None | Focus specific domain (optional) |

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| CLI timeout | Retry with shorter, focused prompt | Skip domain or reduce scope |
| No tasks generated | Review domain description | Retry with refined description |
| Section not found in plan-note | Recreate section defensively | Continue with new section |
| Conflict detection fails | Continue with empty conflicts | Note in completion summary |
| Session folder conflict | Append timestamp suffix | Create unique folder |

---

## Iteration Patterns

### New Planning Session

```
User initiates: TASK="task description"
   ├─ No session exists → New session mode
   ├─ Analyze task and identify sub-domains
   ├─ Create plan-note.md template
   ├─ Generate requirement-analysis.json
   ├─ Process each domain serially:
   │   ├─ CLI analysis → plan.json
   │   └─ Update plan-note.md sections
   ├─ Detect conflicts
   ├─ Generate plan.md summary
   └─ Report completion
```

### Continue Existing Session

```
User resumes: TASK="same task"
   ├─ Session exists → Continue mode
   ├─ Load plan-note.md and requirement-analysis.json
   ├─ Resume from first incomplete domain
   └─ Continue sequential processing
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

### After Planning

1. **Resolve Conflicts**: Address high/critical conflicts before execution
2. **Review Summary**: Check plan.md for completeness and accuracy
3. **Validate Tasks**: Ensure all tasks have clear scope and modification targets

---

## When to Use This Workflow

### Use collaborative-plan-with-file when:
- Complex tasks requiring multi-domain decomposition
- Need structured planning with conflict detection
- Tasks spanning multiple modules or systems
- Want documented planning process for team review
- Preparing for multi-step execution workflows

### Use direct execution when:
- Simple, single-domain tasks
- Clear implementation path without ambiguity
- Quick follow-up to existing planning session

### Consider alternatives when:
- Exploring ideas without clear direction → use `workflow:brainstorm-with-file`
- Analyzing existing code/system → use `workflow:analyze-with-file`
- Lightweight planning for simple features → use `workflow:lite-plan`
- Ready to execute existing plan → use `workflow:unified-execute-with-file`

---

**Now execute collaborative-plan-with-file for**: $TASK
