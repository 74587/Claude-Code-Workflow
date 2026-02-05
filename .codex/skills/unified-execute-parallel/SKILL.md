---
name: unified-execute-parallel
description: Worktree-based parallel execution engine. Execute group tasks in isolated Git worktree. Codex-optimized.
argument-hint: "PLAN=\"<path>\" GROUP=\"<group-id>\" [--auto-commit] [--dry-run]"
---

# Codex Unified-Execute-Parallel Workflow

## Quick Start

Execute tasks for a specific execution group in isolated Git worktree.

**Core workflow**: Load Plan → Select Group → Create Worktree → Execute Tasks → Mark Complete

**Key features**:
- **Worktree isolation**: Each group executes in `.ccw/worktree/{group-id}/`
- **Parallel execution**: Multiple codex instances can run different groups simultaneously
- **Simple focus**: Execute only, merge handled by separate command

## Overview

1. **Plan & Group Selection** - Load plan, select execution group
2. **Worktree Setup** - Create Git worktree for group's branch
3. **Task Execution** - Execute group tasks serially in worktree
4. **Mark Complete** - Record completion status

**Note**: Merging is handled by `/workflow:worktree-merge` command.

## Output Structure

```
.ccw/worktree/
├── {group-id}/                      # Git worktree for group
│   ├── (full project checkout)
│   └── .execution/                  # Execution artifacts
│       ├── execution.md             # Task overview
│       └── execution-events.md      # Execution log

.workflow/.execution/
└── worktree-status.json             # ⭐ All groups completion status
```

---

## Implementation Details

### Session Variables

- `planPath`: Path to plan file
- `groupId`: Selected execution group ID (required)
- `worktreePath`: `.ccw/worktree/{groupId}`
- `branchName`: From execution-groups.json
- `autoCommit`: Boolean for auto-commit mode
- `dryRun`: Boolean for dry-run mode

---

## Phase 1: Plan & Group Selection

**Objective**: Load plan, extract group metadata, filter tasks.

### Step 1.1: Load Plan File

Read plan file and execution-groups.json from same directory.

**Required Files**:
- `plan-note.md` or `plan.json` - Task definitions
- `execution-groups.json` - Group metadata with branch names

### Step 1.2: Select Group

Validate GROUP parameter.

**Validation**:
- Group exists in execution-groups.json
- Group has assigned tasks
- Branch name is defined

### Step 1.3: Filter Group Tasks

Extract only tasks belonging to selected group.

**Task Filtering**:
- Match by `execution_group` field, OR
- Match by `domain` if domain in group.domains

Build execution order from filtered tasks.

---

## Phase 2: Worktree Setup

**Objective**: Create Git worktree for isolated execution.

### Step 2.1: Create Worktree Directory

Ensure worktree base directory exists.

```bash
mkdir -p .ccw/worktree
```

### Step 2.2: Create Git Worktree

Create worktree with group's branch.

**If worktree doesn't exist**:
```bash
# Create branch and worktree
git worktree add -b {branch-name} .ccw/worktree/{group-id} main
```

**If worktree exists**:
```bash
# Verify worktree is on correct branch
cd .ccw/worktree/{group-id}
git status
```

**Branch Naming**: From execution-groups.json `branch_name` field.

### Step 2.3: Initialize Execution Folder

Create execution tracking folder inside worktree.

```bash
mkdir -p .ccw/worktree/{group-id}/.execution
```

Create initial `execution.md`:
- Group ID and branch name
- Task list for this group
- Start timestamp

**Success Criteria**:
- Worktree created at `.ccw/worktree/{group-id}/`
- Working on correct branch
- Execution folder initialized

---

## Phase 3: Task Execution

**Objective**: Execute group tasks serially in worktree.

### Step 3.1: Change to Worktree Directory

All execution happens inside worktree.

```bash
cd .ccw/worktree/{group-id}
```

### Step 3.2: Execute Tasks Sequentially

For each task in group:
1. Execute via CLI in worktree directory
2. Record result in `.execution/execution-events.md`
3. Auto-commit if enabled
4. Continue to next task

**CLI Execution**:
- `--cd .ccw/worktree/{group-id}` - Execute in worktree
- `--mode write` - Allow file modifications

### Step 3.3: Record Progress

Update `.execution/execution-events.md` after each task:
- Task ID and title
- Timestamp
- Status (completed/failed)
- Files modified

### Step 3.4: Auto-Commit (if enabled)

Commit task changes in worktree.

```bash
cd .ccw/worktree/{group-id}
git add .
git commit -m "feat: {task-title} [TASK-{id}]"
```

---

## Phase 4: Mark Complete

**Objective**: Record group completion status.

### Step 4.1: Update worktree-status.json

Write/update status file in main project.

**worktree-status.json** (in `.workflow/.execution/`):
```json
{
  "plan_session": "CPLAN-auth-2025-02-03",
  "groups": {
    "EG-001": {
      "worktree_path": ".ccw/worktree/EG-001",
      "branch": "feature/cplan-auth-eg-001-frontend",
      "status": "completed",
      "tasks_total": 15,
      "tasks_completed": 15,
      "tasks_failed": 0,
      "completed_at": "2025-02-03T14:30:00Z"
    },
    "EG-002": {
      "status": "in_progress",
      "tasks_completed": 8,
      "tasks_total": 12
    }
  }
}
```

### Step 4.2: Display Summary

Report group execution results:
- Group ID and worktree path
- Tasks completed/failed
- Next step: Use `/workflow:worktree-merge` to merge

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `PLAN` | Auto-detect | Path to plan file |
| `GROUP` | Required | Execution group ID (e.g., EG-001) |
| `--auto-commit` | false | Commit after each task |
| `--dry-run` | false | Simulate without changes |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| GROUP missing | Error: Require GROUP parameter |
| Group not found | Error: Check execution-groups.json |
| Worktree exists with wrong branch | Warning: Clean or remove existing worktree |
| Task fails | Record failure, continue to next |

---

## Parallel Execution Example

**3 terminals, 3 groups**:

```bash
# Terminal 1
PLAN=".workflow/.planning/CPLAN-auth/plan-note.md" GROUP="EG-001" --auto-commit

# Terminal 2
PLAN=".workflow/.planning/CPLAN-auth/plan-note.md" GROUP="EG-002" --auto-commit

# Terminal 3
PLAN=".workflow/.planning/CPLAN-auth/plan-note.md" GROUP="EG-003" --auto-commit
```

Each executes in isolated worktree:
- `.ccw/worktree/EG-001/`
- `.ccw/worktree/EG-002/`
- `.ccw/worktree/EG-003/`

After all complete, use `/workflow:worktree-merge` to merge.

---

**Now execute unified-execute-parallel for**: $PLAN with GROUP=$GROUP
