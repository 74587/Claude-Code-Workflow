---
name: task-sync
description: Synchronize task data with workflow session
usage: /task:sync [--force] [--dry-run]
argument-hint: [optional: force sync or dry run]
examples:
  - /task:sync
  - /task:sync --force
  - /task:sync --dry-run
---

# Task Sync Command (/task:sync)

## Overview
Ensures bidirectional synchronization between hierarchical JSON tasks, TODO_LIST.md, and workflow-session.json.

## Core Principles
**System Architecture:** @~/.claude/workflows/unified-workflow-system-principles.md  


## Bidirectional Sync Operations

### 1. JSON Task Files → TODO_LIST.md Sync
**Authoritative Source**: JSON task files in `.task/` directory
- **Status Updates**: pending → active → completed reflected in checkboxes
- **Hierarchical Progress**: Parent progress = average of children (up to 3 levels)
- **Structure Sync**: TODO_LIST.md hierarchy matches JSON parent_id relationships
- **Cross-References**: Links to JSON files and summary files validated
- **Progress Rollup**: Automatic calculation from leaf tasks to root

### 2. JSON Task Files → Workflow Session Sync  
**Session State Updates**: workflow-session.json reflects current task state
- **Task Lists**: Main task IDs updated per phase
- **Progress Metrics**: Overall and phase-specific completion percentages
- **Complexity Assessment**: Structure level based on current task count
- **Blocked Task Detection**: Dependency analysis across entire hierarchy
- **Session Metadata**: Last sync timestamps and validation status

### 3. Workflow Session → JSON Task Sync
**Context Propagation**: Session context distributed to individual tasks
- **Global Context**: Workflow requirements inherited by all tasks
- **Requirement Updates**: Changes in session context propagated
- **Issue Associations**: Workflow-level issues linked to relevant tasks
- **Phase Transitions**: Task context updated when phases change

### 4. TodoWrite Tool → File System Sync
**Real-time Coordination**: TodoWrite tool state synced with persistent files
- **Active Task Sync**: TodoWrite status reflected in JSON files
- **Completion Triggers**: TodoWrite completion updates JSON and TODO_LIST.md
- **Progress Coordination**: TodoWrite progress synced with file-based tracking
- **Session Continuity**: TodoWrite state preserved in TODO_LIST.md

## Sync Rules

### Automatic Sync Points
- After `/task:create` - Add to workflow
- After `/task:execute` - Update progress
- After `/task:replan` - Sync changes
- After `/workflow:*` commands - Propagate context

### Conflict Resolution
Priority order:
1. Recently modified (timestamp)
2. More complete data
3. User confirmation (if needed)

## Usage Examples

### Standard Sync with Report Generation
```bash
/task:sync

🔄 Comprehensive Task Synchronization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing file system state...
- JSON task files: 8 tasks across 3 levels in .task/
- TODO_LIST.md: Present, 8 displayed tasks, last modified 2h ago
- workflow-session.json: 3 main tasks tracked, Level 1 structure
- Summary files: 3 completed task summaries in .summaries/

Validating cross-references...
✅ Parent-child relationships: All valid
✅ Hierarchy depth: Within limits (max 3 levels)
✅ File naming: Follows impl-N.M.P format

Found synchronization differences:
- Task impl-1.2: completed in JSON, pending in TODO_LIST.md checkbox
- Progress: impl-1 shows 75% (from subtasks) vs 45% in session
- Hierarchy: impl-2.3.1 exists in JSON but missing from TODO_LIST.md
- Cross-refs: Summary link for impl-1.2 missing in TODO_LIST.md

Synchronizing files...
✅ Updated impl-1.2 checkbox: [ ] → [x] in TODO_LIST.md
✅ Recalculated hierarchical progress: impl-1 = 75%
✅ Added impl-2.3.1 to TODO_LIST.md hierarchy display
✅ Updated summary link: impl-1.2 → .summaries/IMPL-1.2-summary.md
✅ Propagated context updates to 3 task files
✅ Updated workflow-session.json progress metrics

Generating sync report...
✅ Sync report saved: .summaries/sync-report-20250907-160000.md

Sync complete: 6 updates applied, 0 conflicts resolved
Next sync recommended: In 1 hour or after next task operation
```

### Dry Run with Detailed Analysis
```bash
/task:sync --dry-run

🔍 Sync Analysis (Dry Run Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scanning .task/ directory: 8 JSON files found
Analyzing TODO_LIST.md: Last modified 2h ago
Checking workflow-session.json: In sync
Validating .summaries/: 3 summary files present

Potential changes identified:
ℹ️ Update 2 task statuses: impl-1.2, impl-1.3
ℹ️ Recalculate progress for parent: impl-1 (67% → 75%)
ℹ️ Add 1 missing cross-reference in TODO_LIST.md
ℹ️ Update workflow session progress: 45% → 62%
ℹ️ Generate missing summary link for impl-1.2

File changes would be made to:
- TODO_LIST.md (3 line changes)
- workflow-session.json (progress update)
- No JSON task files need changes (already authoritative)

Conflicts detected: None
Risk level: Low
Estimated sync time: <5 seconds

(No actual changes made - run without --dry-run to apply)
```

### Force Sync with Backup
```bash
/task:sync --force

⚠️ Force Sync Mode - Creating Backups
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backing up current state...
✅ TODO_LIST.md → .summaries/backup-TODO_LIST-20250907-160000.md
✅ workflow-session.json → .summaries/backup-session-20250907-160000.json

Force sync operations:
❗ Using JSON task files as authoritative source
❗ Overwriting TODO_LIST.md without conflict resolution
❗ Rebuilding workflow-session.json task data
❗ Regenerating all cross-references
❗ Recalculating all progress from scratch

Sync completed with authority conflicts resolved:
✅ 3 conflicts overwritten in favor of JSON files
✅ TODO_LIST.md completely regenerated
✅ workflow-session.json task list rebuilt
✅ All cross-references validated and updated

Backup files available for rollback if needed:
- .summaries/backup-TODO_LIST-20250907-160000.md
- .summaries/backup-session-20250907-160000.json

Force sync report: .summaries/force-sync-20250907-160000.md
```

## Data Integrity Checks

### Validation Steps
1. **File Existence**: Both JSON files exist
2. **Session Match**: Same session_id
3. **ID Consistency**: All task IDs valid
4. **Status Logic**: No impossible states
5. **Progress Math**: Calculation accurate

### Error Recovery
```bash
❌ Sync failed: tasks.json corrupted
→ Attempting recovery from backup...
✅ Restored from backup
→ Retry sync? (y/n)
```

## Progress Calculation
```javascript
progress = (completed_tasks / total_tasks) * 100

// With subtasks
weighted_progress = sum(task.weight * task.progress) / total_weight
```

## JSON Updates

### workflow-session.json
```json
{
  "phases": {
    "IMPLEMENT": {
      "tasks": ["IMPL-001", "IMPL-002", "IMPL-003"],
      "completed_tasks": ["IMPL-001", "IMPL-002"],
      "progress": 67,
      "last_sync": "2025-01-16T14:00:00Z"
    }
  }
}
```

### Individual Task Files
Each task file maintains sync metadata:
```json
{
  "id": "IMPL-001",
  "title": "Build authentication module", 
  "status": "completed",
  "type": "feature",
  "agent": "code-developer",
  
  "metadata": {
    "created_at": "2025-09-05T10:30:00Z",
    "started_at": "2025-09-05T10:35:00Z",
    "completed_at": "2025-09-05T13:15:00Z",
    "last_updated": "2025-09-05T13:15:00Z",
    "last_sync": "2025-09-05T13:15:00Z",
    "version": "1.0"
  }
}
```

## Performance & File Management

### Sync Performance
- **Incremental Analysis**: Only processes changed files since last sync
- **Cached Validation**: Reuses validation results for unchanged files
- **Batch File Updates**: Groups related changes for efficiency
- **Typical Sync Time**: <100ms for standard workflows, <500ms for complex

### Generated Reports
**Automatic Documentation**: Every sync creates audit trail

- **Standard Sync Report**: `.summaries/sync-report-[timestamp].md`
- **Dry Run Analysis**: `.summaries/sync-analysis-[timestamp].md`
- **Force Sync Report**: `.summaries/force-sync-[timestamp].md`
- **Conflict Resolution Log**: Embedded in sync reports
- **Backup Files**: Created during force operations

### File System Maintenance
- **Cleanup Policy**: Keep last 10 sync reports, archive older ones
- **Backup Management**: Automatic cleanup of force sync backups after 7 days
- **Error Recovery**: Complete rollback capability from backup files
- **Integrity Monitoring**: Continuous validation of file system consistency

## File System Integration

### Integration Points
- **JSON Task Files**: Authoritative source for all task data
- **TODO_LIST.md**: Display layer synchronized from JSON files
- **workflow-session.json**: High-level session state and progress
- **Summary Files**: Completion documentation linked from TODO_LIST.md
- **TodoWrite Tool**: Real-time task management interface

### File Output Summary
**Generated Files**:
- **Sync Reports**: `.summaries/sync-report-[timestamp].md`
- **Backup Files**: `.summaries/backup-[file]-[timestamp].[ext]`
- **Analysis Reports**: `.summaries/sync-analysis-[timestamp].md`
- **Updated TODO_LIST.md**: Refreshed with current task state
- **Updated workflow-session.json**: Current progress and task references

### Quality Assurance
- **Pre-sync Validation**: File existence and format checks
- **Post-sync Verification**: Cross-reference validation
- **Rollback Testing**: Backup restoration validation
- **Performance Monitoring**: Sync time and efficiency tracking

## Related Commands
- `/task:context --sync-check` - Validate current sync status
- `/task:create` - Creates tasks requiring sync
- `/task:execute` - Generates summaries requiring sync
- `/task:replan` - Structural changes requiring sync
- `/workflow:sync` - Full workflow document synchronization