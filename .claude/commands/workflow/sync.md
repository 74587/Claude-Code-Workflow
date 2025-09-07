---
name: workflow-sync
description: Synchronize workflow documents and validate data integrity with comprehensive reporting
usage: /workflow:sync [--check] [--fix] [--force] [--export-report]
argument-hint: [optional: check-only, auto-fix, force, or export report]
examples:
  - /workflow:sync
  - /workflow:sync --check
  - /workflow:sync --fix
  - /workflow:sync --force
  - /workflow:sync --export-report
---

# Workflow Sync Command (/workflow:sync)

## Overview
Ensures consistency between workflow-session.json, tasks.json, and related documents.

## Core Principles
**Dynamic Change Management:** @~/.claude/workflows/dynamic-change-management.md

## Sync Targets

### Primary Files
- `workflow-session.json` - Workflow state
- `tasks.json` - Task data
- `IMPL_PLAN.md` - Planning document
- `REVIEW.md` - Review results

### Validation Checks
- Session ID consistency
- Task ID references
- Progress calculations
- Status transitions
- Timestamp logic

## Usage Modes

### Default Mode
```bash
/workflow:sync

🔄 Workflow Synchronization
━━━━━━━━━━━━━━━━━━━━━
Checking consistency...

Issues found:
- Progress mismatch: 45% vs 60%
- Task IMPL-003 status differs
- 2 tasks missing from workflow

Fixing...
✅ Updated progress to 60%
✅ Synced IMPL-003 status
✅ Added missing tasks

Sync complete: 3 fixes applied
```

### Check Mode (--check)
```bash
/workflow:sync --check
```
- Read-only validation
- Reports issues without fixing
- Safe for production

### Fix Mode (--fix)
```bash
/workflow:sync --fix
```
- Auto-fixes safe issues
- Prompts for conflicts
- Creates backup first

### Force Mode (--force)
```bash
/workflow:sync --force
```
- Overwrites all conflicts
- No confirmation prompts
- Use with caution

## Sync Rules

### Data Authority
1. **workflow-session.json** - Highest (main state)
2. **tasks.json** - High (task details)
3. **Markdown files** - Medium (documentation)
4. **TodoWrite** - Low (temporary state)

### Conflict Resolution
- Recent changes win (timestamp)
- More complete data preferred
- User confirmation for ambiguous

### Auto-fix Scenarios
- Progress calculation errors
- Missing task references
- Invalid status transitions

## Report Generation

### Sync Report Export (--export-report)
When `--export-report` flag is used, generates comprehensive sync reports:

#### Generated Files
- **reports/SYNC_REPORT.md** - Detailed synchronization analysis
- **reports/sync-backups/** - Backup files created during sync
- **reports/sync-history/** - Historical sync reports

#### File Storage Structure
```
.workflow/WFS-[topic-slug]/reports/
├── SYNC_REPORT.md                    # Latest sync report
├── sync-backups/                     # Pre-sync backups
│   ├── workflow-session-backup.json
│   ├── TODO_LIST-backup.md
│   └── IMPL_PLAN-backup.md
├── sync-history/                     # Historical reports
│   ├── sync-2025-09-07-14-30.md
│   ├── sync-2025-09-07-15-45.md
│   └── sync-2025-09-07-16-15.md
└── sync-logs/                        # Detailed sync logs
    └── sync-operations.jsonl
```

### SYNC_REPORT.md Structure
```markdown
# Workflow Synchronization Report
*Generated: 2025-09-07 14:30:00*

## Sync Operation Summary
- **Operation Type**: Full Sync with Auto-fix
- **Duration**: 2.3 seconds
- **Files Processed**: 5
- **Issues Found**: 3
- **Issues Fixed**: 3
- **Backup Created**: Yes

## Pre-Sync State Analysis
### Document Integrity Check
- ✅ **workflow-session.json**: Valid JSON structure
- ⚠️ **TODO_LIST.md**: 3 completed tasks not marked
- ❌ **IMPL_PLAN.md**: Missing 2 task references
- ✅ **WORKFLOW_ISSUES.md**: Healthy
- ⚠️ **IMPLEMENTATION_LOG.md**: Timestamp inconsistency

### Data Consistency Analysis
- **Task References**: 85% consistent (missing 2 references)
- **Progress Tracking**: 78% accurate (3 items out of sync)
- **Cross-Document Links**: 92% valid (1 broken link)

## Synchronization Operations

### 1. Progress Calculation Fix
- **Issue**: Progress mismatch between JSON and markdown
- **Before**: workflow-session.json: 45%, TODO_LIST.md: 60%
- **Action**: Updated workflow-session.json progress to 60%
- **Result**: ✅ Progress synchronized

### 2. Task Reference Update
- **Issue**: Missing task references in IMPL_PLAN.md
- **Before**: 8 tasks in JSON, 6 tasks in IMPL_PLAN.md
- **Action**: Added IMPL-007 and IMPL-008 references
- **Result**: ✅ All tasks referenced

### 3. TodoWrite Status Sync
- **Issue**: 3 completed tasks not marked in checklist
- **Before**: TodoWrite showed completed, TODO_LIST.md showed pending
- **Action**: Updated TODO_LIST.md completion status
- **Result**: ✅ TodoWrite and documents synchronized

## Post-Sync State
### Document Health Status
- ✅ **workflow-session.json**: Healthy (100% consistent)
- ✅ **TODO_LIST.md**: Healthy (100% accurate)
- ✅ **IMPL_PLAN.md**: Healthy (all references valid)
- ✅ **WORKFLOW_ISSUES.md**: Healthy (no issues)
- ✅ **IMPLEMENTATION_LOG.md**: Healthy (timestamps corrected)

### Data Integrity Metrics
- **Task References**: 100% consistent
- **Progress Tracking**: 100% accurate  
- **Cross-Document Links**: 100% valid
- **Timestamp Consistency**: 100% aligned

## Backup Information
### Created Backups
- **workflow-session-backup.json**: Original session state
- **TODO_LIST-backup.md**: Original task list
- **IMPL_PLAN-backup.md**: Original implementation plan

### Backup Location
```
.workflow/WFS-[topic-slug]/reports/sync-backups/2025-09-07-14-30/
```

## Recommendations
### Immediate Actions
- No immediate actions required
- All issues successfully resolved

### Preventive Measures
1. Consider running sync more frequently during active development
2. Enable auto-sync triggers for task completion events
3. Review document update procedures to maintain consistency

## Next Sync Recommendation
- **Frequency**: Every 2 hours during active development
- **Trigger Events**: After task completion, before major operations
- **Auto-fix**: Enabled for minor consistency issues

---
*Report generated by /workflow:sync --export-report*
```

### Session Updates
After sync operations, workflow-session.json is updated with sync metadata:
```json
{
  "sync_history": [
    {
      "timestamp": "2025-09-07T14:30:00Z",
      "type": "full_sync_with_autofix",
      "duration_seconds": 2.3,
      "issues_found": 3,
      "issues_fixed": 3,
      "backup_created": true,
      "report_path": "reports/SYNC_REPORT.md"
    }
  ],
  "last_sync": {
    "timestamp": "2025-09-07T14:30:00Z",
    "status": "successful",
    "integrity_score": 100
  },
  "documents": {
    "reports": {
      "SYNC_REPORT.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/reports/SYNC_REPORT.md",
        "generated_at": "2025-09-07T14:30:00Z",
        "type": "sync_report"
      }
    }
  }
}
```

### Sync Operation Logging
All sync operations are logged in `sync-logs/sync-operations.jsonl`:
```jsonl
{"timestamp":"2025-09-07T14:30:00Z","operation":"progress_fix","before":{"session":45,"checklist":60},"after":{"session":60,"checklist":60},"status":"success"}
{"timestamp":"2025-09-07T14:30:01Z","operation":"task_reference_update","tasks_added":["IMPL-007","IMPL-008"],"status":"success"}
{"timestamp":"2025-09-07T14:30:02Z","operation":"todowrite_sync","tasks_updated":3,"status":"success"}
```
- Timestamp inconsistencies

## Example Outputs

### Success
```
✅ All documents in sync
- Files checked: 4
- Issues found: 0
- Last sync: 2 minutes ago
```

### With Issues
```
⚠️ Sync issues detected:
1. Progress: 45% (should be 60%)
2. Task IMPL-003: 'completed' vs 'active'
3. Missing: IMPL-005 not in workflow

Run with --fix to resolve
```

### After Fix
```
✅ Sync completed:
- Fixed: 3 issues
- Backup: .backup/sync-20250116
- Verified: All consistent
```

## Error Handling

### Common Errors
```bash
❌ workflow-session.json not found
→ Run: /workflow:init first

❌ tasks.json corrupted
→ Restoring from backup...
✅ Restored successfully

❌ Permission denied
→ Check file permissions
```

## Performance
- Incremental checks (fast)
- Cached validations
- Typical time: < 200ms

## Related Commands
- `/task:sync` - Task-specific sync
- `/workflow:status` - View current state
- `/task:status` - Task details