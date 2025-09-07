---
name: workflow-implement
description: Implementation phase with simple, medium, and complex execution modes
usage: /workflow:implement [--type=<simple|medium|complex>] [--auto-create-tasks]
argument-hint: [optional: complexity type and auto-create]
examples:
  - /workflow:implement
  - /workflow:implement --type=simple
  - /workflow:implement --type=complex --auto-create-tasks
---

# Workflow Implement Command (/workflow:implement)

## Overview
Executes implementation phase with three complexity modes (simple/medium/complex), replacing separate complexity commands.

## Core Principles
  
**Session Management:** @~/.claude/workflows/session-management-principles.md

## Complexity Modes

### Simple Mode (Single file, bug fixes)
```bash
/workflow:implement --type=simple
```
**Agent Flow:** code-developer → code-review-agent  
**TodoWrite:** 3-4 items  
**Documents:** TODO_LIST.md + IMPLEMENTATION_LOG.md (auto-generated)
- Streamlined planning, direct implementation
- Quick review cycle
- < 2 hours effort

### Medium Mode (Multi-file features)
```bash
/workflow:implement --type=medium
```
**Agent Flow:** planning-agent → code-developer → code-review-agent  
**TodoWrite:** 5-7 items  
**Documents:** IMPL_PLAN.md + TODO_LIST.md (auto-triggered)
- Structured planning with hierarchical JSON task decomposition
- Test-driven development
- Comprehensive review
- 2-8 hours effort

### Complex Mode (System-level changes)
```bash
/workflow:implement --type=complex
```
**Agent Flow:** planning-agent → code-developer → code-review-agent → iterate  
**TodoWrite:** 7-10 items  
**Documents:** IMPL_PLAN.md + TODO_LIST.md (mandatory)
- Detailed planning with mandatory 3-level JSON task hierarchy
- Risk assessment and quality gates
- Multi-faceted review with multiple iterations
- > 8 hours effort

## Execution Flow

1. **Detect Complexity** (if not specified)
   - Read from workflow-session.json
   - Auto-detect from task description
   - Default to medium if unclear

2. **Initialize Based on Complexity**
   
   **Simple:**
   - Use existing IMPL_PLAN.md (minimal updates)
   - Direct JSON task creation (impl-*.json)
   - Minimal state tracking
   
   **Medium:**
   - Update IMPL_PLAN.md with implementation strategy
   - Auto-trigger TODO_LIST.md creation
   - Create hierarchical JSON tasks (impl-*.*.json up to 2 levels)
   - Standard agent flow
   
   **Complex:**
   - Comprehensive IMPL_PLAN.md with risk assessment
   - Mandatory TODO_LIST.md with progress tracking
   - Full 3-level JSON task hierarchy (impl-*.*.*.json)
   - Full iteration support with cross-document synchronization

3. **Update Session**
   ```json
   {
     "current_phase": "IMPLEMENT",
     "type": "simple|medium|complex",
     "phases": {
       "IMPLEMENT": {
         "status": "active",
         "complexity": "simple|medium|complex",
         "agent_flow": [...],
         "todos": [...],
         "tasks": ["impl-1", "impl-2", "impl-3"],
         "progress": 0,
         "documents_generated": ["TODO_LIST.md", "IMPLEMENTATION_LOG.md"],
         "documents_updated": ["IMPL_PLAN.md"]
       }
     },
     "documents": {
       "IMPL_PLAN.md": {
         "status": "updated",
         "path": ".workflow/WFS-[topic-slug]/IMPL_PLAN.md",
         "last_updated": "2025-09-05T10:30:00Z"
       },
       "TODO_LIST.md": {
         "status": "generated", 
         "path": ".workflow/WFS-[topic-slug]/TODO_LIST.md",
         "last_updated": "2025-09-05T11:20:00Z",
         "type": "task_tracking"
       },
       "IMPLEMENTATION_LOG.md": {
         "status": "generated",
         "path": ".workflow/WFS-[topic-slug]/IMPLEMENTATION_LOG.md", 
         "last_updated": "2025-09-05T11:20:00Z",
         "type": "execution_log",
         "auto_update": true
       }
     },
     "task_system": {
       "max_depth": 3,
       "task_count": {
         "main_tasks": 3,
         "total_tasks": 8
       }
     }
   }
   ```

4. **Execute Agent Flow**
   - Create TodoWrite entries
   - Execute agents based on complexity
   - Track checkpoints
   - Support pause/resume

## Document Generation Rules

### Decomposition Triggers (Medium Workflows)
Task decomposition documents generated when ANY condition met:
- Task involves >3 modules/components
- >5 distinct subtasks identified  
- Complex interdependencies detected
- Estimated effort >4 hours
- Cross-team coordination required

### Mandatory Generation (Complex Workflows)
Always generates complete document suite:
- **Enhanced IMPL_PLAN.md structure** - Hierarchical task breakdown integrated into main plan
- **TODO_LIST.md** - Progress tracking with cross-links
- Links to existing IMPL_PLAN.md from planning phase

### Document-JSON Synchronization
- **Document Creation** → Update workflow session with document references
- **Task Status Changes** → Update TODO_LIST.md progress
- **Task Completion** → Mark items complete in checklist
- **New Tasks Added** → Add to both JSON and enhanced implementation plan

### Document Storage Structure
```
.workflow/WFS-[topic-slug]/
├── IMPL_PLAN.md               # From planning phase (all complexities)
├── (enhanced IMPL_PLAN.md)      # Enhanced structure in implement phase (medium+/complex)
├── TODO_LIST.md               # Generated in implement phase (ALL complexities)
├── IMPLEMENTATION_LOG.md      # Execution progress log (ALL complexities)
├── workflow-session.json      # Updated with document references
└── artifacts/
    ├── logs/
    ├── backups/               # Task state backups
    └── implementation/        # Implementation artifacts
```

## File Generation Details

### TODO_LIST.md Generation (All Complexities)
**Always Generated**: Now created for Simple, Medium, and Complex workflows

**Simple Workflow Structure:**
```markdown
# Implementation Task List
*Session: WFS-[topic-slug]*

## Quick Implementation Tasks
- [ ] **IMPL-001**: Core implementation
- [ ] **IMPL-002**: Basic testing
- [ ] **IMPL-003**: Review and cleanup

## Progress Tracking
- **Total Tasks**: 3
- **Completed**: 0/3 (0%)
- **Estimated Time**: < 2 hours

---
*Generated by /workflow:implement --type=simple*
```

**Medium/Complex Workflow Structure:**
```markdown
# Implementation Task List
*Session: WFS-[topic-slug]*

## Main Implementation Tasks

### Phase 1: Foundation
- [ ] **IMPL-001**: Set up base infrastructure
  - Dependencies: None
  - Effort: 2h
  - Agent: code-developer

### Phase 2: Core Features
- [ ] **IMPL-002**: Implement main functionality
  - Dependencies: IMPL-001
  - Effort: 4h
  - Agent: code-developer

### Phase 3: Testing & Review
- [ ] **IMPL-003**: Comprehensive testing
  - Dependencies: IMPL-002
  - Effort: 2h
  - Agent: code-review-agent

## Progress Summary
- **Total Tasks**: 8
- **Completed**: 0/8 (0%)
- **Current Phase**: Foundation
- **Estimated Completion**: 2025-09-07 18:00

---
*Generated by /workflow:implement --type=medium*
```

### IMPLEMENTATION_LOG.md Generation (All Complexities)
**Always Generated**: Real-time execution progress tracking

```markdown
# Implementation Execution Log
*Session: WFS-[topic-slug] | Started: 2025-09-07 14:00:00*

## Execution Summary
- **Workflow Type**: Medium
- **Total Tasks**: 8
- **Current Status**: In Progress
- **Progress**: 3/8 (37.5%)

## Execution Timeline

### 2025-09-07 14:00:00 - Implementation Started
- **Phase**: IMPLEMENT
- **Agent**: code-developer
- **Status**: Task execution initialized

### 2025-09-07 14:15:00 - IMPL-001 Started
- **Task**: Set up base infrastructure
- **Agent**: code-developer
- **Approach**: Standard project structure setup

### 2025-09-07 14:45:00 - IMPL-001 Completed
- **Duration**: 30 minutes
- **Status**: ✅ Successful
- **Output**: Base project structure created
- **Next**: IMPL-002

### 2025-09-07 15:00:00 - IMPL-002 Started
- **Task**: Implement main functionality
- **Agent**: code-developer
- **Dependencies**: IMPL-001 ✅

## Current Task Progress
- **Active Task**: IMPL-002
- **Progress**: 60%
- **Estimated Completion**: 15:30
- **Agent**: code-developer

## Issues & Resolutions
- No issues reported

## Next Actions
1. Complete IMPL-002 implementation
2. Begin IMPL-003 testing phase
3. Schedule review checkpoint

---
*Log updated: 2025-09-07 15:15:00*
```

## Individual Task Files Structure
```json
{
  "id": "IMPL-001",
  "title": "Build authentication module",
  "status": "pending",
  "type": "feature",
  "agent": "code-developer",
  "effort": "4h",
  "context": {
    "inherited_from": "WFS-2025-001",
    "requirements": ["JWT authentication"],
    "scope": ["src/auth/*"],
    "acceptance": ["Module handles JWT tokens"]
  },
  "dependencies": {
    "upstream": [],
    "downstream": ["IMPL-002"]
  },
  "subtasks": [],
  "execution": {
    "attempts": 0,
    "current_attempt": null,
    "history": []
  },
  "metadata": {
    "created_at": "2025-09-05T10:30:00Z",
    "version": "1.0"
  }
}
```

## Integration Points

### Automatic Behaviors
- Creates individual task JSON files (.task/tasks/IMPL-XXX.json) as needed
- Generates decomposition documents based on complexity triggers
- Links documents to workflow-session.json with paths and status
- Enables task commands (/task:*) with document integration
- Initializes tasks in 'pending' state within their JSON files
- Synchronizes task creation between documents and JSON states

### Next Actions
```bash
# After /workflow:implement
/task:create "First task"     # Create tasks
/task:status                  # View task list
/task:execute IMPL-001        # Execute tasks
```

## Sync Mechanism
- Every task operation updates workflow-session.json
- Progress calculated from task completion
- Issues automatically linked

## Related Commands
- `/workflow:plan` - Should complete first
- `/task:create` - Create implementation tasks
- `/task:status` - Monitor progress
- `/workflow:review` - Next phase after implementation