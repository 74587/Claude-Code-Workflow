---
name: workflow-context
description: Unified workflow context analysis and status overview with file export capabilities
usage: /workflow:context [--detailed] [--health-check] [--format=<tree|json|summary>] [--export]
argument-hint: Optional flags for analysis depth, output format, and file export
examples:
  - /workflow:context
  - /workflow:context --detailed
  - /workflow:context --health-check
  - /workflow:context --format=tree
  - /workflow:context --detailed --export
  - /workflow:context --health-check --export
---

# Workflow Context Command (/workflow:context)

## Overview
Unified workflow context analysis command providing comprehensive state analysis and quick overview of current work status.

## Core Principles
**System:** @~/.claude/workflows/unified-workflow-system-principles.md

## Features

### Core Functionality
- **Real-time Status Snapshot** → Complete workflow state display
- **Task Progress Overview** → Completed, active, pending task statistics
- **Document Health Check** → Document consistency and completeness analysis
- **Dependency Analysis** → Task dependency and conflict identification
- **Time Estimation** → Completion time prediction based on current progress

### Advanced Analysis
- **Blocker Identification** → Automatic detection of progress obstacles
- **Priority Recommendations** → Next action suggestions based on dependencies
- **Risk Assessment** → Execution risk evaluation for current plan

## Core Principles
**System:** @~/.claude/workflows/unified-workflow-system-principles.md

## Display Modes

### Summary View (/workflow:context)
```
🔍 Workflow Status Overview
========================

📋 Session Information:
  - Session ID: WFS-2025-001
  - Current Phase: Implementation
  - Start Time: 2025-01-15 09:30:00
  - Duration: 2h 45m

📊 Task Progress:
  ✅ Completed: 9/15 (60%)
  🔄 In Progress: 2 tasks
  ⏳ Pending: 4 tasks  
  🚫 Blocked: 0 tasks

📁 Document Status:
  ✅ IMPL_PLAN.md - Healthy
  ✅ TODO_LIST.md - Healthy  
  ⚠️  TODO_CHECKLIST.md - Needs sync
  ❌ WORKFLOW_ISSUES.md - Missing

⏱️  Estimated Completion: 2025-01-15 16:45 (4h 15m remaining)

🎯 Next Steps:
  1. Complete current API endpoint implementation
  2. Update TODO_CHECKLIST.md status
  3. Start frontend user interface development
```

### Detailed View (/workflow:context --detailed)
```
🔍 Detailed Workflow Analysis
========================

📋 Session Details:
  Session ID: WFS-2025-001
  Workflow Type: Complex
  Main Task: "Implement OAuth2 User Authentication System"
  
📊 Detailed Progress Analysis:
  
  ✅ Completed Tasks (9):
    - [PLAN-001] Requirements analysis and architecture design
    - [PLAN-002] Database model design
    - [IMPL-001] User model implementation
    - [IMPL-002] JWT token service
    - [IMPL-003] Password encryption service
    - [TEST-001] Unit tests - User model
    - [TEST-002] Unit tests - JWT service
    - [DOC-001] API documentation - Auth endpoints
    - [DOC-002] Database migration documentation
  
  🔄 In Progress Tasks (2):
    - [IMPL-004] OAuth2 provider integration (70% complete)
      ↳ Dependencies: [PLAN-002], [IMPL-001]
      ↳ Estimated remaining: 1.5h
    - [TEST-003] Integration tests - OAuth flow (30% complete)  
      ↳ Dependencies: [IMPL-004]
      ↳ Estimated remaining: 2h
  
  ⏳ Pending Tasks (4):
    - [IMPL-005] Frontend login interface
    - [IMPL-006] Session management middleware  
    - [TEST-004] End-to-end testing
    - [DOC-003] User documentation

📁 Document Health Analysis:
  
  ✅ IMPL_PLAN.md:
    - Status: Healthy
    - Last updated: 2025-01-15 10:15
    - Coverage: 100% (all tasks defined)
    
  ✅ TODO_LIST.md:
    - Status: Healthy
    - Progress tracking: 15 tasks, 4 levels
    - Dependencies: Verified
    
  ⚠️  TODO_CHECKLIST.md:
    - Status: Needs sync
    - Issue: 3 completed tasks not marked
    - Recommendation: Run /workflow:sync

🔗 Dependency Analysis:
  
  Critical Path:
    [IMPL-004] → [TEST-003] → [IMPL-005] → [TEST-004]
    
  Potential Blockers:
    ❌ No blockers detected
    
  Parallel Execution Suggestions:
    - [IMPL-005] can start immediately after [TEST-003] completes
    - [DOC-003] can run in parallel with [IMPL-006]

⚠️  Risk Assessment:
  
  🟢 Low Risk (Current Status)
  - OAuth2 integration progressing as expected
  - All tests passing
  - No technical debt accumulation
  
  Potential Risks:
  - Frontend interface design not finalized (Impact: Medium)
  - Third-party OAuth service dependency (Impact: Low)
```

### Tree Format (/workflow:context --format=tree)
```
📁 WFS-2025-001: User Authentication
├── 📋 PLAN [Completed]
│   └── Output: IMPL_PLAN.md
├── 🔨 IMPLEMENT [Active - 45%]
│   ├── ✅ IMPL-001: Authentication
│   ├── ✅ IMPL-002: Database
│   ├── ✅ IMPL-003: JWT
│   ├── 🔄 IMPL-004: OAuth2 (70%)
│   ├── ⏳ IMPL-005: Testing
│   ├── 🚫 IMPL-006: Integration
│   └── ⏳ IMPL-007: Documentation
└── 📝 REVIEW [Pending]
```

### JSON Format (/workflow:context --format=json)
Returns merged workflow-session.json + task data for programmatic access.

## File Export Feature

### Export Mode (/workflow:context --export)
When `--export` flag is used, generates persistent status report files in addition to console output.

#### Generated Files

**Status Report Generation:**
- **Standard Mode**: Creates `reports/STATUS_REPORT.md`
- **Detailed Mode**: Creates `reports/DETAILED_STATUS_REPORT.md`
- **Health Check Mode**: Creates `reports/HEALTH_CHECK.md`

#### File Storage Location
```
.workflow/WFS-[topic-slug]/reports/
├── STATUS_REPORT.md           # Standard context export
├── DETAILED_STATUS_REPORT.md  # Detailed context export
├── HEALTH_CHECK.md            # Health check export
└── context-exports/           # Historical exports
    ├── status-2025-09-07-14-30.md
    ├── detailed-2025-09-07-15-45.md
    └── health-2025-09-07-16-15.md
```

#### Export File Structure

**STATUS_REPORT.md Format:**
```markdown
# Workflow Status Report
*Generated: 2025-09-07 14:30:00*

## Session Information
- **Session ID**: WFS-2025-001
- **Current Phase**: Implementation
- **Start Time**: 2025-01-15 09:30:00
- **Duration**: 2h 45m

## Task Progress Summary
- **Completed**: 9/15 (60%)
- **In Progress**: 2 tasks
- **Pending**: 4 tasks  
- **Blocked**: 0 tasks

## Document Status
- ✅ IMPL_PLAN.md - Healthy
- ✅ TODO_LIST.md - Healthy  
- ⚠️  TODO_CHECKLIST.md - Needs sync
- ❌ WORKFLOW_ISSUES.md - Missing

## Time Estimation
- **Estimated Completion**: 2025-01-15 16:45
- **Remaining Time**: 4h 15m

## Next Steps
1. Complete current API endpoint implementation
2. Update TODO_CHECKLIST.md status
3. Start frontend user interface development

---
*Report generated by /workflow:context --export*
```

**HEALTH_CHECK.md Format:**
```markdown
# Workflow Health Check Report
*Generated: 2025-09-07 16:15:00*

## Overall Health Score: 85/100 (Good)

## System Health Analysis

### ✅ Session State Check
- **workflow-session.json**: Exists and valid
- **Backup files**: 3 backups available
- **Data integrity**: Verified

### 📋 Document Consistency Check
- **IMPL_PLAN.md ↔ TODO_LIST.md**: ✅ 100% consistency
- **TODO_CHECKLIST.md ↔ TodoWrite status**: ⚠️ 80% (3 items out of sync)
- **WORKFLOW_ISSUES.md**: ❌ Missing file

### 🔄 Progress Tracking Health
- **TodoWrite integration**: ✅ Running normally
- **Timestamp recording**: ✅ Complete
- **Progress estimation**: ⚠️ 85% accuracy

## Recommendations

### Immediate Actions
1. Run /workflow:sync to sync document status
2. Execute /workflow:issue create to establish issue tracking

### Planned Actions  
3. Consider creating more checkpoints to improve recovery capability
4. Optimize dependencies to reduce critical path length

## Detailed Analysis
[Detailed health metrics and analysis...]

---
*Health check generated by /workflow:context --health-check --export*
```

#### Session Updates
When files are exported, the workflow-session.json is updated:
```json
{
  "documents": {
    "reports": {
      "STATUS_REPORT.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/reports/STATUS_REPORT.md",
        "generated_at": "2025-09-07T14:30:00Z",
        "type": "status_report"
      },
      "HEALTH_CHECK.md": {
        "status": "generated", 
        "path": ".workflow/WFS-[topic-slug]/reports/HEALTH_CHECK.md",
        "generated_at": "2025-09-07T16:15:00Z",
        "type": "health_check"
      }
    }
  },
  "export_history": [
    {
      "type": "status_report",
      "timestamp": "2025-09-07T14:30:00Z",
      "file": "reports/STATUS_REPORT.md"
    }
  ]
}
```

#### Historical Exports
- **Automatic archiving**: Previous exports moved to `context-exports/` with timestamps
- **Retention policy**: Keep last 10 exports of each type
- **Cross-referencing**: Links to historical data in current reports

### Health Check Mode (/workflow:context --health-check)
```
🏥 Workflow Health Diagnosis
========================

✅ Session State Check:
  - workflow-session.json: Exists and valid
  - Backup files: 3 backups available
  - Data integrity: Verified

📋 Document Consistency Check:
  
  ✅ IMPL_PLAN.md ↔ TODO_LIST.md
    - Task definition consistency: ✅ 100%
    - Progress synchronization: ✅ 100%
    
  ⚠️  TODO_CHECKLIST.md ↔ TodoWrite status
    - Sync status: ❌ 80% (3 items out of sync)
    - Recommended action: Run /workflow:sync
    
  ❌ WORKFLOW_ISSUES.md
    - Status: File does not exist
    - Recommendation: Create issue tracking document

🔄 Progress Tracking Health:
  
  ✅ TodoWrite integration: Running normally
  ✅ Timestamp recording: Complete
  ⚠️  Progress estimation: Based on historical data, 85% accuracy
  
🔧 System Recommendations:
  
  Immediate Actions:
  1. Run /workflow:sync to sync document status
  2. Execute /workflow:issue create to establish issue tracking
  
  Planned Actions:  
  3. Consider creating more checkpoints to improve recovery capability
  4. Optimize dependencies to reduce critical path length

🎯 Overall Health Score: 85/100 (Good)
```

## Use Cases

### Case 1: Work Recovery
User returns after interrupting work and needs quick status understanding:
```bash
/workflow:context
# Get quick overview, understand progress and next actions
```

### Case 2: Status Reporting  
Need to report project progress to team or management:
```bash
/workflow:context --detailed
# Get detailed progress analysis and estimates
```

### Case 3: Problem Diagnosis
Workflow shows anomalies and needs problem diagnosis:
```bash
/workflow:context --health-check
# Comprehensive health check and repair recommendations
```

### Case 4: Pre-change Assessment
Before adding new requirements or modifying plans, assess current state:
```bash
/workflow:context --detailed --health-check
# Complete status analysis to inform change decisions
```

## Technical Implementation

### Data Source Integration
- **workflow-session.json** - Session state and history
- **TodoWrite status** - Real-time task progress
- **Document analysis** - Workflow-related document parsing
- **Git status** - Code repository change tracking

### Intelligent Analysis Algorithms
- **Dependency graph construction** - Auto-build dependency graphs from task definitions
- **Critical path algorithm** - Identify key task sequences affecting overall progress
- **Health scoring** - Multi-dimensional workflow state health assessment
- **Time estimation model** - Intelligent estimation based on historical data and current progress

### Caching and Performance Optimization
- **Status caching** - Cache computationally intensive analysis results
- **Incremental updates** - Only recalculate changed portions
- **Asynchronous analysis** - Background execution of complex analysis tasks