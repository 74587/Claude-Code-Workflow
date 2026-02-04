---
description: Parallel collaborative planning with Execution Groups - Multi-codex parallel task generation, execution group assignment, multi-branch strategy. Codex-optimized.
argument-hint: "TASK=\"<description>\" [--max-groups=3] [--group-strategy=automatic|balanced|manual] [--focus=<domain>]"
---

# Codex Collaborative-Plan-Parallel Workflow

## Quick Start

Parallel collaborative planning workflow using **Execution Groups** architecture. Splits task into sub-domains, assigns them to execution groups, and prepares for multi-branch parallel development.

**Core workflow**: Understand → Group Assignment → Sequential Planning → Conflict Detection → Execution Strategy

**Key features**:
- **Execution Groups**: Sub-domains grouped for parallel execution by different codex instances
- **Multi-branch strategy**: Each execution group works on independent Git branch
- **Codex instance assignment**: Each group assigned to specific codex worker
- **Dependency-aware grouping**: Automatic or manual group assignment based on dependencies
- **plan-note.md**: Shared document with execution group sections

**Note**: Planning is still serial (Codex limitation), but output is structured for parallel execution.

## Overview

This workflow enables structured planning for parallel execution:

1. **Understanding & Group Assignment** - Analyze requirements, identify sub-domains, assign to execution groups
2. **Sequential Planning** - Process each sub-domain serially via CLI analysis (planning phase only)
3. **Conflict Detection** - Scan for conflicts across execution groups
4. **Execution Strategy** - Generate branch strategy and codex assignment for parallel execution

The key innovation is **Execution Groups** - sub-domains are grouped by dependencies and complexity, enabling true parallel development with multiple codex instances.

## Output Structure

```
.workflow/.planning/CPLAN-{slug}-{date}/
├── plan-note.md                      # ⭐ Core: Requirements + Groups + Tasks
├── requirement-analysis.json         # Phase 1: Sub-domain + group assignments
├── execution-groups.json             # ⭐ Phase 1: Group metadata + codex assignment
├── agents/                           # Phase 2: Per-domain plans (serial planning)
│   ├── {domain-1}/
│   │   └── plan.json
│   ├── {domain-2}/
│   │   └── plan.json
│   └── ...
├── conflicts.json                    # Phase 3: Conflict report
├── execution-strategy.md             # ⭐ Phase 4: Branch strategy + codex commands
└── plan.md                           # Phase 4: Human-readable summary
```

## Output Artifacts

### Phase 1: Understanding & Group Assignment

| Artifact | Purpose |
|----------|---------|
| `plan-note.md` | Collaborative template with execution group sections |
| `requirement-analysis.json` | Sub-domain assignments with group IDs |
| `execution-groups.json` | ⭐ Group metadata, codex assignment, branch names, dependencies |

### Phase 2: Sequential Planning (per Phase 1 in original)

| Artifact | Purpose |
|----------|---------|
| `agents/{domain}/plan.json` | Detailed implementation plan per domain |
| Updated `plan-note.md` | Task pool and evidence sections filled per domain |

### Phase 3: Conflict Detection (same as original)

| Artifact | Purpose |
|----------|---------|
| `conflicts.json` | Detected conflicts with types, severity, resolutions |
| Updated `plan-note.md` | Conflict markers section populated |

### Phase 4: Execution Strategy Generation

| Artifact | Purpose |
|----------|---------|
| `execution-strategy.md` | ⭐ Branch creation commands, codex execution commands per group, merge strategy |
| `plan.md` | Human-readable summary with execution groups |

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
- `maxGroups`: Maximum execution groups (default: 3)
- `groupStrategy`: automatic | balanced | manual (default: automatic)

---

## Phase 1: Understanding & Group Assignment

**Objective**: Analyze task requirements, identify sub-domains, assign to execution groups, and create the plan-note.md template.

### Step 1.1: Analyze Task Description

Use built-in tools to understand the task scope and identify sub-domains.

**Analysis Activities**:
1. **Extract task keywords** - Identify key terms and concepts
2. **Identify sub-domains** - Split into 2-8 parallelizable focus areas
3. **Analyze dependencies** - Map cross-domain dependencies
4. **Assess complexity** - Evaluate task complexity per domain (Low/Medium/High)
5. **Search for references** - Find related documentation, README, architecture guides

**Sub-Domain Identification Patterns**:

| Pattern | Keywords | Typical Group Assignment |
|---------|----------|--------------------------|
| Backend API | 服务, 后端, API, 接口 | Group with database if dependent |
| Frontend | 界面, 前端, UI, 视图 | Separate group (UI-focused) |
| Database | 数据, 存储, 数据库, 持久化 | Group with backend if tightly coupled |
| Testing | 测试, 验证, QA | Can be separate or split across groups |
| Infrastructure | 部署, 基础, 运维, 配置 | Usually separate group |

### Step 1.2: Assign Execution Groups

Assign sub-domains to execution groups based on strategy.

**Group Assignment Strategies**:

#### 1. Automatic Strategy (default)
- **Logic**: Group domains by dependency relationships
- **Rule**: Domains with direct dependencies → same group
- **Rule**: Independent domains → separate groups (up to maxGroups)
- **Example**:
  - Group 1: backend-api + database (dependent)
  - Group 2: frontend + ui-components (dependent)
  - Group 3: testing + documentation (independent)

#### 2. Balanced Strategy
- **Logic**: Distribute domains evenly across groups by estimated effort
- **Rule**: Balance total complexity across groups
- **Example**:
  - Group 1: frontend (high) + testing (low)
  - Group 2: backend (high) + documentation (low)
  - Group 3: database (medium) + infrastructure (medium)

#### 3. Manual Strategy
- **Logic**: Prompt user to manually assign domains to groups
- **UI**: Present domains with dependencies, ask for group assignments
- **Validation**: Check that dependencies are within same group or properly ordered

**Codex Instance Assignment**:
- Each group assigned to `codex-{N}` (e.g., codex-1, codex-2, codex-3)
- Instance names are logical identifiers for parallel execution
- Actual parallel execution happens in unified-execute-parallel workflow

### Step 1.3: Generate execution-groups.json

Create the execution group metadata document.

**execution-groups.json Structure**:

```json
{
  "session_id": "CPLAN-auth-2025-02-03",
  "total_groups": 3,
  "group_strategy": "automatic",
  "groups": [
    {
      "group_id": "EG-001",
      "codex_instance": "codex-1",
      "domains": ["frontend", "ui-components"],
      "branch_name": "feature/cplan-auth-eg-001-frontend",
      "estimated_effort": "high",
      "task_id_range": "TASK-001~200",
      "dependencies_on_groups": [],
      "cross_group_files": []
    },
    {
      "group_id": "EG-002",
      "codex_instance": "codex-2",
      "domains": ["backend-api", "database"],
      "branch_name": "feature/cplan-auth-eg-002-backend",
      "estimated_effort": "medium",
      "task_id_range": "TASK-201~400",
      "dependencies_on_groups": [],
      "cross_group_files": []
    },
    {
      "group_id": "EG-003",
      "codex_instance": "codex-3",
      "domains": ["testing"],
      "branch_name": "feature/cplan-auth-eg-003-testing",
      "estimated_effort": "low",
      "task_id_range": "TASK-401~500",
      "dependencies_on_groups": ["EG-001", "EG-002"],
      "cross_group_files": []
    }
  ],
  "inter_group_dependencies": [
    {
      "from_group": "EG-003",
      "to_group": "EG-001",
      "dependency_type": "requires_completion",
      "description": "Testing requires frontend implementation"
    },
    {
      "from_group": "EG-003",
      "to_group": "EG-002",
      "dependency_type": "requires_completion",
      "description": "Testing requires backend API"
    }
  ]
}
```

**Field Descriptions**:

| Field | Purpose |
|-------|---------|
| `group_id` | Unique execution group identifier (EG-001, EG-002, ...) |
| `codex_instance` | Logical codex worker name for parallel execution |
| `domains[]` | Sub-domains assigned to this group |
| `branch_name` | Git branch name for this group's work |
| `estimated_effort` | Complexity: low/medium/high |
| `task_id_range` | Non-overlapping TASK ID range (200 IDs per group) |
| `dependencies_on_groups[]` | Groups that must complete before this group starts |
| `cross_group_files[]` | Files modified by multiple groups (conflict risk) |
| `inter_group_dependencies[]` | Explicit cross-group dependency relationships |

### Step 1.4: Create plan-note.md Template with Groups

Generate structured template with execution group sections.

**plan-note.md Structure**:
- **YAML Frontmatter**: session_id, original_requirement, total_groups, group_strategy, status
- **Section: 需求理解**: Core objectives, key points, constraints, group strategy
- **Section: 执行组划分**: Table of groups with domains, branches, codex assignments
- **Section: 任务池 - {Group ID} - {Domains}**: Pre-allocated task section per execution group
- **Section: 依赖关系**: Cross-group dependencies
- **Section: 冲突标记**: Populated in Phase 3
- **Section: 上下文证据 - {Group ID}**: Evidence section per execution group

**TASK ID Range Allocation**: Each group receives 200 non-overlapping IDs (e.g., Group 1: TASK-001~200, Group 2: TASK-201~400).

### Step 1.5: Update requirement-analysis.json with Groups

Extend requirement-analysis.json to include execution group assignments.

**requirement-analysis.json Structure** (extended):

```json
{
  "session_id": "CPLAN-auth-2025-02-03",
  "original_requirement": "...",
  "complexity": "high",
  "total_groups": 3,
  "group_strategy": "automatic",
  "sub_domains": [
    {
      "focus_area": "frontend",
      "description": "...",
      "execution_group": "EG-001",
      "task_id_range": "TASK-001~100",
      "estimated_effort": "high",
      "dependencies": []
    },
    {
      "focus_area": "ui-components",
      "description": "...",
      "execution_group": "EG-001",
      "task_id_range": "TASK-101~200",
      "estimated_effort": "medium",
      "dependencies": ["frontend"]
    }
  ],
  "execution_groups_summary": [
    {
      "group_id": "EG-001",
      "domains": ["frontend", "ui-components"],
      "total_estimated_effort": "high"
    }
  ]
}
```

**Success Criteria**:
- 2-3 execution groups identified (up to maxGroups)
- Each group has 1-4 sub-domains
- Dependencies mapped (intra-group and inter-group)
- execution-groups.json created with complete metadata
- plan-note.md template includes group sections
- requirement-analysis.json extended with group assignments
- Branch names generated for each group
- Codex instance assigned to each group

---

## Phase 2: Sequential Sub-Domain Planning

**Objective**: Process each sub-domain serially via CLI analysis (same as original workflow, but with group awareness).

**Note**: This phase is identical to original collaborative-plan-with-file Phase 2, with the following additions:
- CLI prompt includes execution group context
- Task IDs respect group's assigned range
- Cross-group dependencies explicitly documented

### Step 2.1: Domain Planning Loop (Serial)

For each sub-domain in sequence:
1. Execute Gemini/Codex CLI analysis for the current domain
2. Include execution group metadata in CLI context
3. Parse CLI output into structured plan
4. Save detailed plan as `agents/{domain}/plan.json`
5. Update plan-note.md group section with task summaries and evidence

**Planning Guideline**: Wait for each domain's CLI analysis to complete before proceeding.

### Step 2.2: CLI Planning with Group Context

Execute synchronous CLI analysis with execution group awareness.

**CLI Analysis Scope** (extended):
- **PURPOSE**: Generate detailed implementation plan for domain within execution group
- **CONTEXT**:
  - Domain description
  - Execution group ID and metadata
  - Related codebase files
  - Prior domain results within same group
  - Cross-group dependencies (if any)
- **TASK**: Analyze domain, identify tasks within group's ID range, define dependencies
- **EXPECTED**: JSON output with tasks, summaries, group-aware dependencies, effort estimates
- **CONSTRAINTS**:
  - Use only TASK IDs from assigned range
  - Document any cross-group dependencies
  - Flag files that might be modified by other groups

**Cross-Group Dependency Handling**:
- If a task depends on another group's completion, document as `depends_on_group: "EG-XXX"`
- Mark files that are likely modified by multiple groups as `cross_group_risk: true`

### Step 2.3: Update plan-note.md Group Sections

Parse CLI output and update the plan-note.md sections for the current domain's group.

**Task Summary Format** (extended with group info):
- Task header: `### TASK-{ID}: {Title} [{domain}] [Group: {group_id}]`
- Fields: 状态, 复杂度, 依赖, 范围, **执行组** (execution_group)
- Cross-group dependencies: `依赖执行组: EG-XXX`
- Modification points with conflict risk flag
- Conflict risk assessment

**Evidence Format** (same as original)

**Success Criteria**:
- All domains processed sequentially
- `agents/{domain}/plan.json` created for each domain
- `plan-note.md` updated with group-aware task pools
- Cross-group dependencies explicitly documented
- Task IDs respect group ranges

---

## Phase 3: Conflict Detection

**Objective**: Analyze plan-note.md for conflicts within and across execution groups.

**Note**: This phase extends original conflict detection with group-aware analysis.

### Step 3.1: Parse plan-note.md (same as original)

Extract all tasks from all group sections.

### Step 3.2: Detect Conflicts (Extended)

Scan all tasks for four categories of conflicts (added cross-group conflicts).

**Conflict Types** (extended):

| Type | Severity | Detection Logic | Resolution |
|------|----------|-----------------|------------|
| file_conflict | high | Same file:location modified by multiple domains within same group | Coordinate modification order |
| cross_group_file_conflict | critical | Same file modified by multiple execution groups | Requires merge coordination or branch rebase strategy |
| dependency_cycle | critical | Circular dependencies in task graph (within or across groups) | Remove or reorganize dependencies |
| strategy_conflict | medium | Multiple high-risk tasks in same file from different domains/groups | Review approaches and align on strategy |

**Detection Activities**:
1. **File Conflicts (Intra-Group)**: Group modification points by file:location within each group
2. **Cross-Group File Conflicts**: Identify files modified by multiple execution groups
3. **Dependency Cycles**: Build dependency graph including cross-group dependencies, detect cycles
4. **Strategy Conflicts**: Identify files with high-risk tasks from multiple groups

**Cross-Group Conflict Detection**:
- Parse `cross_group_files[]` from execution-groups.json
- Scan all tasks for files modified by multiple groups
- Flag as critical conflict requiring merge strategy

### Step 3.3: Update execution-groups.json with Conflicts

Append detected cross-group conflicts to execution-groups.json.

**Update Structure**:
```json
{
  "groups": [
    {
      "group_id": "EG-001",
      "cross_group_files": [
        {
          "file": "src/shared/config.ts",
          "conflicting_groups": ["EG-002"],
          "conflict_type": "both modify shared configuration",
          "resolution": "Coordinate changes or use merge strategy"
        }
      ]
    }
  ]
}
```

### Step 3.4: Generate Conflict Artifacts (Extended)

Write conflict results with group context.

**conflicts.json Structure** (extended):
- `detected_at`: Detection timestamp
- `total_conflicts`: Number of conflicts
- `intra_group_conflicts[]`: Conflicts within single group
- `cross_group_conflicts[]`: ⭐ Conflicts across execution groups
- `conflicts[]`: All conflict objects with group IDs

**plan-note.md Update**: Populate "冲突标记" section with:
- Intra-group conflicts (can be resolved during group execution)
- Cross-group conflicts (require coordination or merge strategy)

**Success Criteria**:
- All tasks analyzed for intra-group and cross-group conflicts
- `conflicts.json` written with group-aware detection results
- `execution-groups.json` updated with cross_group_files
- `plan-note.md` updated with conflict markers
- Cross-group conflicts flagged as critical

---

## Phase 4: Execution Strategy Generation

**Objective**: Generate branch strategy and codex execution commands for parallel development.

### Step 4.1: Generate Branch Strategy

Create Git branch strategy for multi-branch parallel development.

**Branch Strategy Decisions**:

1. **Independent Groups** (no cross-group conflicts):
   - Each group works on independent branch from main
   - Branches can be merged independently
   - Parallel development fully supported

2. **Dependent Groups** (cross-group dependencies but no file conflicts):
   - Groups with dependencies must coordinate completion order
   - Independent branches, but merge order matters
   - Group A completes → merge to main → Group B starts/continues

3. **Conflicting Groups** (cross-group file conflicts):
   - Strategy 1: Sequential - Complete one group, merge, then start next
   - Strategy 2: Feature branch + rebase - Each group rebases on main periodically
   - Strategy 3: Shared integration branch - Both groups branch from shared base, coordinate merges

**Default Strategy**: Independent branches with merge order based on dependencies

### Step 4.2: Generate execution-strategy.md

Create execution strategy document with concrete commands.

**execution-strategy.md Structure**:

```markdown
# Execution Strategy: {session_id}

## Overview

- **Total Execution Groups**: {N}
- **Group Strategy**: {automatic|balanced|manual}
- **Branch Strategy**: {independent|dependent|conflicting}
- **Estimated Total Effort**: {sum of all groups}

## Execution Groups

### EG-001: Frontend Development
- **Codex Instance**: codex-1
- **Domains**: frontend, ui-components
- **Branch**: feature/cplan-auth-eg-001-frontend
- **Dependencies**: None (can start immediately)
- **Estimated Effort**: High

### EG-002: Backend Development
- **Codex Instance**: codex-2
- **Domains**: backend-api, database
- **Branch**: feature/cplan-auth-eg-002-backend
- **Dependencies**: None (can start immediately)
- **Estimated Effort**: Medium

### EG-003: Testing
- **Codex Instance**: codex-3
- **Domains**: testing
- **Branch**: feature/cplan-auth-eg-003-testing
- **Dependencies**: EG-001, EG-002 (must complete first)
- **Estimated Effort**: Low

## Branch Creation Commands

```bash
# Create branches for all execution groups
git checkout main
git pull

# Group 1: Frontend
git checkout -b feature/cplan-auth-eg-001-frontend
git push -u origin feature/cplan-auth-eg-001-frontend

# Group 2: Backend
git checkout main
git checkout -b feature/cplan-auth-eg-002-backend
git push -u origin feature/cplan-auth-eg-002-backend

# Group 3: Testing
git checkout main
git checkout -b feature/cplan-auth-eg-003-testing
git push -u origin feature/cplan-auth-eg-003-testing
```

## Parallel Execution Commands

Execute these commands in parallel (separate terminal sessions or background):

```bash
# Terminal 1: Execute Group 1 (Frontend)
PLAN=".workflow/.planning/CPLAN-auth-2025-02-03/plan-note.md" \
  GROUP="EG-001" \
  /workflow:unified-execute-parallel

# Terminal 2: Execute Group 2 (Backend)
PLAN=".workflow/.planning/CPLAN-auth-2025-02-03/plan-note.md" \
  GROUP="EG-002" \
  /workflow:unified-execute-parallel

# Terminal 3: Execute Group 3 (Testing) - starts after EG-001 and EG-002 complete
PLAN=".workflow/.planning/CPLAN-auth-2025-02-03/plan-note.md" \
  GROUP="EG-003" \
  WAIT_FOR="EG-001,EG-002" \
  /workflow:unified-execute-parallel
```

## Cross-Group Conflicts

### Critical Conflicts Detected

1. **File: src/shared/config.ts**
   - Modified by: EG-001 (frontend), EG-002 (backend)
   - Resolution: Coordinate changes or use merge strategy
   - Recommendation: EG-001 completes first, EG-002 rebases before continuing

### Resolution Strategy

- **Option 1**: Sequential execution (EG-001 → merge → EG-002 rebases)
- **Option 2**: Manual coordination (both groups align on config changes before execution)
- **Option 3**: Split file (refactor into separate configs if feasible)

## Merge Strategy

### Independent Groups (EG-001, EG-002)
```bash
# After EG-001 completes
git checkout main
git merge feature/cplan-auth-eg-001-frontend
git push

# After EG-002 completes
git checkout main
git merge feature/cplan-auth-eg-002-backend
git push
```

### Dependent Group (EG-003)
```bash
# After EG-001 and EG-002 merged to main
git checkout feature/cplan-auth-eg-003-testing
git rebase main  # Update with latest changes
# Continue execution...

# After EG-003 completes
git checkout main
git merge feature/cplan-auth-eg-003-testing
git push
```

## Monitoring Progress

Track execution progress:
```bash
# Check execution logs for each group
cat .workflow/.execution/EXEC-eg-001-*/execution-events.md
cat .workflow/.execution/EXEC-eg-002-*/execution-events.md
cat .workflow/.execution/EXEC-eg-003-*/execution-events.md
```

### Step 4.3: Generate plan.md Summary (Extended)

Create human-readable summary with execution group information.

**plan.md Structure** (extended):

| Section | Content |
|---------|---------|
| Header | Session ID, task description, creation time |
| 需求 (Requirements) | From plan-note.md "需求理解" |
| 执行组划分 (Execution Groups) | ⭐ Table of groups with domains, branches, codex assignments, dependencies |
| 任务概览 (Task Overview) | All tasks grouped by execution group |
| 冲突报告 (Conflict Report) | Intra-group and cross-group conflicts |
| 执行策略 (Execution Strategy) | Branch strategy, parallel execution commands, merge order |

### Step 4.4: Display Completion Summary

Present session statistics with execution group information.

**Summary Content**:
- Session ID and directory path
- Total execution groups created
- Total domains planned
- Total tasks generated (per group and total)
- Conflict status (intra-group and cross-group)
- Execution strategy summary
- Next step: Use `workflow:unified-execute-parallel` with GROUP parameter

**Success Criteria**:
- `execution-strategy.md` generated with complete branch and execution strategy
- `plan.md` includes execution group information
- All artifacts present in session directory
- User informed of parallel execution approach and commands
- Cross-group conflicts clearly documented with resolution strategies

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--max-groups` | 3 | Maximum execution groups to create |
| `--group-strategy` | automatic | Group assignment: automatic / balanced / manual |
| `--focus` | None | Focus specific domain (optional) |

**Group Strategy Details**:
- **automatic**: Group by dependency relationships (dependent domains in same group)
- **balanced**: Distribute evenly by estimated effort
- **manual**: Prompt user to assign domains to groups interactively

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| Too many groups requested | Limit to maxGroups | Merge low-effort domains |
| Circular group dependencies | Stop execution, report error | Reorganize domain assignments |
| All domains in one group | Warning: No parallelization | Continue or prompt user to split |
| Cross-group file conflicts | Flag as critical | Suggest resolution strategies |
| Manual grouping timeout | Fall back to automatic | Continue with automatic strategy |

---

## Best Practices

### Before Starting Planning

1. **Clear Task Description**: Detailed requirements for better grouping
2. **Understand Dependencies**: Know which modules depend on each other
3. **Choose Group Strategy**:
   - Use `automatic` for dependency-heavy tasks
   - Use `balanced` for independent features
   - Use `manual` for complex architectures you understand well

### During Planning

1. **Review Group Assignments**: Check execution-groups.json makes sense
2. **Verify Dependencies**: Cross-group dependencies should be minimal
3. **Check Branch Names**: Ensure branch names follow project conventions
4. **Monitor Conflicts**: Review conflicts.json for cross-group file conflicts

### After Planning

1. **Review Execution Strategy**: Read execution-strategy.md carefully
2. **Resolve Critical Conflicts**: Address cross-group file conflicts before execution
3. **Prepare Environments**: Ensure multiple codex instances can run in parallel
4. **Plan Merge Order**: Understand which groups must merge first


---

## Migration from Original Workflow

Existing `collaborative-plan-with-file` sessions can be converted to parallel execution:

1. Read existing `plan-note.md` and `requirement-analysis.json`
2. Assign sub-domains to execution groups (run Step 1.2 manually)
3. Generate `execution-groups.json` and `execution-strategy.md`
4. Use `workflow:unified-execute-parallel` for execution

---

**Now execute collaborative-plan-parallel for**: $TASK
