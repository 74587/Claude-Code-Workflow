---
description: Merge completed worktrees back to main branch. Handle cross-group conflicts and dependency order.
argument-hint: "[--plan=<plan-session>] [--group=<group-id>] [--all] [--cleanup]"
---

# Codex Worktree-Merge Workflow

## Quick Start

Merge completed execution group worktrees back to main branch.

**Core workflow**: Load Status → Check Dependencies → Merge Groups → Cleanup Worktrees

**Key features**:
- **Dependency-aware merge**: Merge groups in correct order
- **Conflict detection**: Check for cross-group file conflicts
- **Selective or bulk merge**: Merge single group or all completed groups
- **Cleanup option**: Remove worktrees after successful merge

## Overview

1. **Load Status** - Read worktree-status.json and execution-groups.json
2. **Validate Dependencies** - Check group dependencies are merged first
3. **Merge Worktree** - Merge group's branch to main
4. **Update Status** - Mark group as merged
5. **Cleanup** (optional) - Remove worktree after merge

**Note**: This command only merges, execution is handled by `/workflow:unified-execute-parallel`.

## Input Files

```
.workflow/.execution/
└── worktree-status.json             # Group completion status

.workflow/.planning/{session}/
├── execution-groups.json            # Group metadata and dependencies
└── conflicts.json                   # Cross-group conflicts (if any)

.ccw/worktree/
├── {group-id}/                      # Worktree to merge
│   ├── .execution/                  # Execution logs
│   └── (modified files)
```

## Output

```
.workflow/.execution/
├── worktree-status.json             # Updated with merge status
└── merge-log.md                     # Merge history and details
```

---

## Implementation Details

### Command Parameters

- `--plan=<session>`: Plan session ID (auto-detect if not provided)
- `--group=<id>`: Merge specific group (e.g., EG-001)
- `--all`: Merge all completed groups in dependency order
- `--cleanup`: Remove worktree after successful merge

**Examples**:
```bash
# Merge single group
--group=EG-001

# Merge all completed groups
--all

# Merge and cleanup
--group=EG-001 --cleanup
```

---

## Phase 1: Load Status

**Objective**: Read completion status and group metadata.

### Step 1.1: Load worktree-status.json

Read group completion status.

**Status File Location**: `.workflow/.execution/worktree-status.json`

**Required Fields**:
- `plan_session`: Planning session ID
- `groups[]`: Array of group status objects
  - `status`: "completed" / "in_progress" / "failed"
  - `worktree_path`: Path to worktree
  - `branch`: Branch name
  - `merge_status`: "not_merged" / "merged"

### Step 1.2: Load execution-groups.json

Read group dependencies.

**Metadata File**: `.workflow/.planning/{session}/execution-groups.json`

**Required Fields**:
- `groups[]`: Group metadata with dependencies
  - `group_id`: Group identifier
  - `dependencies_on_groups[]`: Groups that must merge first
  - `cross_group_files[]`: Files modified by multiple groups

### Step 1.3: Determine Merge Targets

Select groups to merge based on parameters.

**Selection Logic**:

| Parameter | Behavior |
|-----------|----------|
| `--group=EG-001` | Merge only specified group |
| `--all` | Merge all groups with status="completed" |
| Neither | Prompt user to select from completed groups |

**Validation**:
- Group must have status="completed"
- Group's worktree must exist
- Group must not already be merged

---

## Phase 2: Validate Dependencies

**Objective**: Ensure dependencies are merged before target group.

### Step 2.1: Build Dependency Graph

Create merge order based on inter-group dependencies.

**Dependency Analysis**:
1. For target group, check `dependencies_on_groups[]`
2. For each dependency, verify merge status
3. Build topological order for merge sequence

**Example**:
```json
EG-003 depends on [EG-001, EG-002]
→ Merge order: EG-001, EG-002, then EG-003
```

### Step 2.2: Check Dependency Status

Validate all dependencies are merged.

**Check Logic**:
```
For each dependency in target.dependencies_on_groups:
  ├─ Check dependency.merge_status == "merged"
  ├─ If not merged: Error or prompt to merge dependency first
  └─ If merged: Continue
```

**Options on Dependency Not Met**:
1. **Error**: Refuse to merge until dependencies merged
2. **Cascade**: Automatically merge dependencies first (if --all)
3. **Force**: Allow merge anyway (dangerous, use --force)

---

## Phase 3: Conflict Detection

**Objective**: Check for cross-group file conflicts before merge.

### Step 3.1: Load Cross-Group Files

Read files modified by multiple groups.

**Source**: `execution-groups.json` → `groups[].cross_group_files[]`

**Example**:
```json
{
  "group_id": "EG-001",
  "cross_group_files": [
    {
      "file": "src/shared/config.ts",
      "conflicting_groups": ["EG-002"]
    }
  ]
}
```

### Step 3.2: Check File Modifications

Compare file state across groups and main.

**Conflict Check**:
1. For each cross-group file:
   - Get version on main branch
   - Get version in target worktree
   - Get version in conflicting group worktrees
2. If all different → conflict likely
3. If same → safe to merge

### Step 3.3: Report Conflicts

Display potential conflicts to user.

**Conflict Report**:
```markdown
## Potential Merge Conflicts

### File: src/shared/config.ts
- Modified by: EG-001 (target), EG-002
- Status: EG-002 already merged to main
- Action: Manual review recommended

### File: package.json
- Modified by: EG-001 (target), EG-003
- Status: EG-003 not yet merged
- Action: Safe to merge (EG-003 will handle conflict)
```

**User Decision**:
- Proceed with merge (handle conflicts manually if occur)
- Abort and review files first
- Coordinate with other group maintainers

---

## Phase 4: Merge Worktree

**Objective**: Merge group's branch from worktree to main.

### Step 4.1: Prepare Main Branch

Ensure main branch is up to date.

```bash
git checkout main
git pull origin main
```

### Step 4.2: Merge Group Branch

Merge from worktree's branch.

**Merge Command**:
```bash
# Strategy 1: Regular merge (creates merge commit)
git merge --no-ff {branch-name} -m "Merge {group-id}: {description}"

# Strategy 2: Squash merge (single commit)
git merge --squash {branch-name}
git commit -m "feat: {group-id} - {description}"
```

**Default**: Use regular merge to preserve history.

### Step 4.3: Handle Merge Conflicts

If conflicts occur, provide resolution guidance.

**Conflict Resolution**:
```bash
# List conflicting files
git status

# For each conflict:
# 1. Open file and resolve markers
# 2. Stage resolved file
git add {file}

# Complete merge
git commit
```

**Conflict Types**:
- **Cross-group file**: Expected, requires manual merge
- **Unexpected conflict**: Investigate cause

### Step 4.4: Push to Remote

Push merged changes.

```bash
git push origin main
```

**Validation**:
- Check CI/tests pass after merge
- Verify no regressions

---

## Phase 5: Update Status & Cleanup

**Objective**: Mark group as merged, optionally remove worktree.

### Step 5.1: Update worktree-status.json

Mark group as merged.

**Status Update**:
```json
{
  "groups": {
    "EG-001": {
      "merge_status": "merged",
      "merged_at": "2025-02-03T15:00:00Z",
      "merged_to": "main",
      "merge_commit": "abc123def456"
    }
  }
}
```

### Step 5.2: Append to merge-log.md

Record merge details.

**Merge Log Entry**:
```markdown
## EG-001: Frontend Development

- **Merged At**: 2025-02-03 15:00:00
- **Branch**: feature/cplan-auth-eg-001-frontend
- **Commit**: abc123def456
- **Tasks Completed**: 15/15
- **Conflicts**: 1 file (src/shared/config.ts) - resolved
- **Status**: Successfully merged to main
```

### Step 5.3: Cleanup Worktree (optional)

Remove worktree if --cleanup flag provided.

**Cleanup Commands**:
```bash
# Remove worktree
git worktree remove .ccw/worktree/{group-id}

# Delete branch (optional)
git branch -d {branch-name}
git push origin --delete {branch-name}
```

**When to Cleanup**:
- Group successfully merged
- No need to revisit worktree
- Disk space needed

**When to Keep**:
- May need to reference execution logs
- Other groups may need to coordinate
- Debugging merge issues

### Step 5.4: Display Summary

Report merge results.

**Summary Output**:
```
✓ Merged EG-001 to main
  - Branch: feature/cplan-auth-eg-001-frontend
  - Commit: abc123def456
  - Tasks: 15/15 completed
  - Conflicts: 1 resolved
  - Worktree: Cleaned up

Remaining groups:
  - EG-002: completed, ready to merge
  - EG-003: in progress, waiting for dependencies
```

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--plan` | Auto-detect | Plan session ID |
| `--group` | Interactive | Group to merge |
| `--all` | false | Merge all completed groups |
| `--cleanup` | false | Remove worktree after merge |
| `--force` | false | Ignore dependency checks |
| `--squash` | false | Use squash merge instead of regular |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Group not completed | Error: Complete execution first |
| Group already merged | Skip with warning |
| Dependencies not merged | Error or cascade merge (--all) |
| Merge conflict | Pause for manual resolution |
| Worktree not found | Error: Check worktree path |
| Push fails | Rollback merge, report error |

---

## Merge Strategies

### Strategy 1: Sequential Merge

Merge groups one by one in dependency order.

```bash
# Merge EG-001
--group=EG-001 --cleanup

# Merge EG-002
--group=EG-002 --cleanup

# Merge EG-003 (depends on EG-001, EG-002)
--group=EG-003 --cleanup
```

**Use When**:
- Want to review each merge carefully
- High risk of conflicts
- Testing between merges

### Strategy 2: Bulk Merge

Merge all completed groups at once.

```bash
--all --cleanup
```

**Use When**:
- Groups are independent
- Low conflict risk
- Want fast integration

### Strategy 3: Dependency-First

Merge dependencies before dependent groups.

```bash
# Automatically merges EG-001, EG-002 before EG-003
--group=EG-003 --cascade
```

**Use When**:
- Complex dependency graph
- Want automatic ordering

---

## Best Practices

### Before Merge

1. **Verify Completion**: Check all tasks in group completed
2. **Review Conflicts**: Read conflicts.json for cross-group files
3. **Test Worktree**: Run tests in worktree before merge
4. **Update Main**: Ensure main branch is current

### During Merge

1. **Follow Order**: Respect dependency order
2. **Review Conflicts**: Carefully resolve cross-group conflicts
3. **Test After Merge**: Run CI/tests after each merge
4. **Commit Often**: Keep merge history clean

### After Merge

1. **Update Status**: Ensure worktree-status.json reflects merge
2. **Keep Logs**: Archive merge-log.md for reference
3. **Cleanup Gradually**: Don't rush to delete worktrees
4. **Notify Team**: Inform others of merged groups

---

## Rollback Strategy

If merge causes issues:

```bash
# Find merge commit
git log --oneline

# Revert merge
git revert -m 1 {merge-commit}
git push origin main

# Or reset (dangerous, loses history)
git reset --hard HEAD~1
git push origin main --force

# Update status
# Mark group as not_merged in worktree-status.json
```

---

## Example Workflow

### Scenario: 3 Groups Complete

**Status**:
- EG-001: Completed (no dependencies)
- EG-002: Completed (no dependencies)
- EG-003: Completed (depends on EG-001, EG-002)

### Step 1: Merge Independent Groups

```bash
# Merge EG-001
--group=EG-001

# Test after merge
npm test

# Merge EG-002
--group=EG-002

# Test after merge
npm test
```

### Step 2: Merge Dependent Group

```bash
# EG-003 depends on EG-001, EG-002 (already merged)
--group=EG-003

# Final test
npm test
```

### Step 3: Cleanup All Worktrees

```bash
# Remove all merged worktrees
--cleanup-all
```

---

## When to Use This Workflow

### Use worktree-merge when:
- Execution groups completed via unified-execute-parallel
- Ready to integrate changes to main branch
- Need dependency-aware merge order
- Want to handle cross-group conflicts systematically

### Manual merge when:
- Single group with no dependencies
- Comfortable with Git merge commands
- No cross-group conflicts to handle

---

**Now execute worktree-merge for completed execution groups**
