---
name: context
description: Unified context command - Single source of truth for all workflow and task status information
usage: /context [task-id] [--format=<tree|list|json|progress>] [--health-check] [--detailed] [--export] 
argument-hint: [optional task-id] [display format] [analysis options] [export flag]
examples:
  - /context
  - /context IMPL-001
  - /context --format=tree
  - /context --health-check
  - /context --detailed --export
  - /context --format=progress
---

# Unified Context Command (/context)

## Overview

**Single Source of Truth**: This command replaces `/workflow:context` and `/task:context` with a unified interface that generates all views on-demand from JSON data. Eliminates synchronization complexity by making documents read-only views.

## Core Architecture

### Single Source of Truth Principle
- **JSON Authority**: All data read from `.task/*.json` and `workflow-session.json` files
- **Generated Views**: All markdown displays generated on-demand (never manually edited)
- **No Synchronization**: Documents are views, not synchronized states
- **Conflict-Free**: Single direction data flow eliminates conflicts

### Unified Command Interface
- **Global Context**: `/context` shows complete workflow status
- **Task-Specific**: `/context IMPL-001` shows individual task details  
- **Health Checking**: `/context --health-check` validates JSON data integrity
- **Multiple Formats**: Tree, list, progress, and JSON output formats

## Usage Modes

### 1. Global Workflow Context (Default)
```bash
/context
```

**Generated Output** (from JSON data):
```
🔍 Workflow Status Overview
========================

📋 Session Information:
  - Session ID: WFS-workflow-optimization  
  - Current Phase: IMPLEMENT
  - Complexity: complex
  - Start Time: 2025-09-07 14:30:22Z
  - Duration: 4h 15m

📊 Task Progress (from .task/*.json):
  ✅ Completed: 2/5 (40%)
  🔄 In Progress: 1 task  
  ⏳ Pending: 2 tasks
  🚫 Blocked: 0 tasks

📁 JSON Data Health:
  ✅ workflow-session.json - Valid JSON, complete data
  ✅ .task/ directory - 5 task files, all valid JSON
  ✅ Task relationships - All dependencies valid
  ✅ Progress calculations - Mathematically consistent

⏱️  Estimated Completion: 2025-09-07 20:45 (2h 30m remaining)

🎯 Next Actions (generated from JSON state):
  1. Complete IMPL-003 (currently in progress)
  2. Begin IMPL-004 (dependencies satisfied)
  3. Review completed IMPL-001 and IMPL-002
```

### 2. Task-Specific Context  
```bash
/context IMPL-001
```

**Generated Output** (from JSON file):
```
📋 Task Context: IMPL-001
━━━━━━━━━━━━━━━━━━━━━━

📄 JSON Source: .task/impl-001.json
Status: completed (from JSON authority)
Created: 2025-09-07T14:45:00Z  
Completed: 2025-09-07T16:30:00Z
Duration: 1h 45m

🎯 Task Definition (from JSON):
Title: Implement single source of truth architecture by removing sync commands
Type: architecture
Agent: code-developer
Priority: critical

📋 Context (from JSON):
Requirements: 
  - Remove workflow:sync and task:sync commands
  - Update coordination system documentation  
  - Establish JSON as single authority source
Scope:
  - .claude/commands/workflow/sync.md
  - .claude/commands/task/sync.md
  - .claude/workflows/json-document-coordination-system.md

🔗 Dependencies (from JSON):
Upstream: None
Downstream: IMPL-002, IMPL-003
Parent: None

✅ Completion Status (from JSON):
Result: success
Files Modified: 3 files moved to deprecated, 1 file updated
Next Task: IMPL-002 ready to begin
```

### 3. Health Check Mode
```bash
/context --health-check
```

**Generated Analysis** (from JSON validation):
```
🏥 System Health Check (JSON Data Analysis)
========================================

✅ JSON File Integrity:
  - workflow-session.json: ✅ Valid JSON, complete schema
  - .task/impl-001.json: ✅ Valid JSON, all required fields
  - .task/impl-002.json: ✅ Valid JSON, all required fields  
  - .task/impl-003.json: ✅ Valid JSON, all required fields
  - .task/impl-004.json: ✅ Valid JSON, all required fields
  - .task/impl-005.json: ✅ Valid JSON, all required fields

🔗 Data Consistency Check:
  ✅ Task IDs: All unique, follow impl-N format
  ✅ Dependencies: All referenced tasks exist
  ✅ Status Logic: All transitions valid
  ✅ Progress Math: Calculations consistent
  ✅ Timestamps: All valid, chronologically ordered

📊 Data Completeness:
  ✅ All tasks have required fields
  ✅ All tasks have context information
  ✅ All dependencies properly defined
  ✅ Session state complete

🎯 Overall System Health: 100% (Excellent)
  - Zero data conflicts (Single source of truth benefit)
  - All JSON files valid and consistent
  - No synchronization issues (eliminated by design)
  - Ready for continued execution
```

### 4. Tree Format Display
```bash
/context --format=tree
```

**Generated Tree** (from JSON hierarchy):
```
📁 WFS-workflow-optimization (from workflow-session.json)
├── 📋 PLAN [Completed]
│   └── Output: IMPL_PLAN.md, 5 tasks generated
├── 🔨 IMPLEMENT [Active - 40% complete]
│   ├── ✅ IMPL-001: Single source of truth architecture (completed)
│   ├── ✅ IMPL-002: Automated planning-to-execution flow (completed) 
│   ├── 🔄 IMPL-003: Unified context commands (in_progress)
│   ├── ⏳ IMPL-004: Dynamic complexity escalation (pending)
│   └── ⏳ IMPL-005: Update session management (pending)
└── 📝 REVIEW [Pending]
    └── Awaiting implementation completion
```

### 5. Progress Format
```bash
/context --format=progress
```

**Generated Progress View** (calculated from JSON data):
```
📊 Implementation Progress Report
==============================

🎯 Overall Progress: 40% (2/5 tasks complete)

📈 Progress by Phase:
┌─────────────┬─────────┬──────────┬─────────┐
│ Phase       │ Status  │ Progress │ Tasks   │
├─────────────┼─────────┼──────────┼─────────┤
│ PLAN        │ ✅      │ 100%     │ N/A     │
│ IMPLEMENT   │ 🔄      │ 40%      │ 2/5     │
│ REVIEW      │ ⏳      │ 0%       │ 0/0     │
└─────────────┴─────────┴──────────┴─────────┘

📋 Task Progress Details (from JSON files):
✅ IMPL-001: single source of truth        [100%] ⏱️  1h 45m
✅ IMPL-002: automated planning flow       [100%] ⏱️  2h 10m  
🔄 IMPL-003: unified context commands      [75%]  ⏱️  1h 30m (in progress)
⏳ IMPL-004: dynamic complexity            [0%]   ⏱️  2h 00m (estimated)
⏳ IMPL-005: session management updates    [0%]   ⏱️  1h 15m (estimated)

⏰ Time Analysis (calculated from JSON):
  Time Spent: 5h 25m
  Remaining: 2h 45m  
  Estimated Total: 8h 10m
  Completion: 2025-09-07 21:15
```

## File Export Feature

### Export Generated Views
```bash
/context --export
```

**Generated Files** (all from JSON data):
```
.workflow/WFS-workflow-optimization/reports/
├── CONTEXT_REPORT.md           # Current context view
├── PROGRESS_REPORT.md          # Progress analysis
├── HEALTH_CHECK.md            # System health status
└── context-exports/           # Historical exports
    ├── context-2025-09-07-14-30.md
    ├── progress-2025-09-07-15-45.md  
    └── health-2025-09-07-16-15.md
```

**Report Structure** (generated from JSON):
```markdown
# Workflow Context Report
*Generated: 2025-09-07 16:15:00 from JSON data sources*

## Data Sources
- workflow-session.json (last updated: 2025-09-07T15:45:00Z)
- 5 task JSON files in .task/ directory
- All sources validated and consistent

## Session Overview
[Generated from workflow-session.json]

## Task Analysis  
[Generated from .task/*.json files]

## Health Assessment
[Validated from JSON data integrity]

---
*This report is a generated view from authoritative JSON data*
*No manual editing required - data updates automatically in JSON files*
```

## Advanced Features

### JSON Output for Scripting
```bash
/context --format=json
```

**Generated JSON** (compiled from all sources):
```json
{
  "session": {
    "id": "WFS-workflow-optimization",
    "status": "active", 
    "phase": "implement",
    "progress": 40,
    "data_source": "workflow-session.json"
  },
  "tasks": [
    {
      "id": "IMPL-001",
      "status": "completed",
      "progress": 100,
      "data_source": ".task/impl-001.json"
    }
  ],
  "health": {
    "json_integrity": 100,
    "data_consistency": 100,
    "completeness": 100
  },
  "generated_at": "2025-09-07T16:15:00Z",
  "data_freshness": "current"
}
```

### Health Check Integration
- **Validation Engine**: Checks all JSON files for schema compliance
- **Consistency Verification**: Validates cross-references between files
- **Data Integrity**: Ensures all dependencies and relationships are valid
- **Performance Monitoring**: Tracks data loading and generation speed

## Benefits of Unified Architecture

### Eliminated Complexity
- **No Sync Commands**: Removed `/workflow:sync` and `/task:sync`
- **No Conflicts**: Single source eliminates data drift
- **No Manual Document Editing**: All documents are generated views
- **Simplified User Experience**: One command for all context needs

### Enhanced Reliability  
- **Data Consistency**: JSON authority ensures consistent state
- **Error Reduction**: No synchronization bugs or conflicts
- **Simplified Recovery**: Only JSON files need backup/restore
- **Predictable Behavior**: Views always reflect current JSON state

### Improved Performance
- **On-Demand Generation**: Views created only when requested
- **Efficient Data Access**: Direct JSON file reading
- **No Background Sync**: No overhead from synchronization processes
- **Cached Calculations**: Smart caching for expensive operations

## Technical Implementation

### Data Flow Architecture
```
JSON Files (.task/*.json + workflow-session.json)
      ↓ (Single Direction - Read Only)
View Generation Engine
      ↓
Formatted Output (Console/File)
```

### View Generation Process
1. **Load JSON Data**: Read all relevant JSON files
2. **Validate Data**: Check integrity and consistency  
3. **Calculate Views**: Generate requested format/content
4. **Format Output**: Apply formatting and display
5. **Export (Optional)**: Save generated views to files

### Error Handling
- **Missing Files**: Clear error messages with recovery suggestions
- **Invalid JSON**: Schema validation with specific error details
- **Broken References**: Dependency validation with repair recommendations
- **Data Inconsistencies**: Automatic detection and resolution suggestions


### Data Management
- All commands now work with JSON as single source of truth
- Document generation happens on-demand
- No synchronization commands needed
- Simplified data model improves reliability

