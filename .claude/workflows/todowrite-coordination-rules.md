# TodoWrite-Workflow Coordination Rules

## Overview


This document defines the complete coordination system between Claude's TodoWrite tool and the workflow persistence layer (TODO_LIST.md and JSON task files).

## TodoWrite Tool Architecture

### Tool Purpose and Scope
**TodoWrite Tool**:
- Claude's internal task coordination interface
- Real-time progress tracking during active sessions
- Agent coordination and status management
- Immediate task visibility for execution context

**NOT for**:
- Long-term task persistence (that's JSON task files)
- Cross-session task continuity (that's TODO_LIST.md)
- Historical task audit trails (that's workflow summaries)

## Core Coordination Principles

### Execution Order Rules
1. **Create TodoWrite FIRST** - Before any agent coordination begins
2. **Real-time Updates** - Agents update todo status during execution
3. **Progress Tracking** - Maintain visible workflow state throughout
4. **Single Active Rule** - Only one todo in_progress at any time
5. **Completion Gates** - Mark completed only when truly finished
6. **Persistence Sync** - TodoWrite changes trigger workflow file updates

### Integration Architecture
```
TodoWrite Tool (Claude Internal)
    ↕ Real-time sync
TODO_LIST.md (Workflow Persistence)  
    ↕ Bidirectional updates
JSON Task Files (Detailed State)
    ↕ Status propagation
Workflow Session (Master State)
```

## Mandatory TodoWrite Creation

### Pre-execution Requirements
Every workflow execution MUST create TodoWrite entries before agent coordination begins.

**Workflow Initialization**:
1. Analyze workflow complexity 
2. Create appropriate TodoWrite pattern based on complexity
3. Initialize TODO_LIST.md file if complexity warrants it
4. Begin agent coordination with TodoWrite context

### Agent Handoff Protocol
**Agent → TodoWrite**:
- Agents receive TodoWrite context on initialization
- Agents update todo status in real-time during execution
- Agents mark completion only when truly finished
- Agents create new todos when discovering additional work

## TodoWrite Patterns by Complexity

### Simple Workflows (3-4 todos)
**Pattern**: Linear execution with minimal tracking
```
1. [pending] Context gathering
2. [pending] Solution implementation  
3. [pending] Code review and validation
4. [pending] Task completion
```

**Coordination**: Direct TodoWrite → JSON files (no TODO_LIST.md)

### Medium Workflows (5-7 todos)
**Pattern**: Structured execution with progress tracking
```
1. [pending] Implementation planning
2. [pending] Context gathering
3. [pending] Implementation with testing
4. [pending] Functionality validation
5. [pending] Code quality review
6. [pending] Task completion
```

**Coordination**: TodoWrite ↔ TODO_LIST.md ↔ JSON files

### Complex Workflows (7-10 todos)
**Pattern**: Comprehensive execution with full documentation
```
1. [pending] Detailed planning
2. [pending] Documentation generation
3. [pending] Context and dependency gathering
4. [pending] Comprehensive implementation
5. [pending] Acceptance criteria validation
6. [pending] Thorough review process
7. [pending] Feedback iteration
8. [pending] Task completion
```

**Coordination**: Full three-way sync with audit trails

## Synchronization Protocols

### TodoWrite → TODO_LIST.md Sync
**Trigger Events**:
- Todo status change (pending → active → completed)
- Todo creation during workflow execution
- Todo blocking/unblocking status changes
- Progress milestone achievement

**Sync Actions**:
- Update TODO_LIST.md checkbox states
- Recalculate progress percentages
- Update task status summaries
- Propagate completion timestamps

### TODO_LIST.md → TodoWrite Sync
**Trigger Events**:
- Manual checkbox modification in TODO_LIST.md
- External task status updates
- Workflow resumption from paused state
- Cross-session task inheritance

**Sync Actions**:
- Reconstruct TodoWrite state from TODO_LIST.md
- Initialize appropriate todo patterns
- Restore progress tracking context
- Re-establish agent coordination context

### Bidirectional JSON Integration
**TodoWrite → JSON**:
- Task completion triggers JSON status updates
- Progress checkpoints sync to JSON execution state
- Agent assignments propagate to JSON context

**JSON → TodoWrite**:
- JSON task creation generates TodoWrite entries
- JSON status changes reflect in TodoWrite display
- JSON dependency updates trigger TodoWrite coordination

## State Management Rules

### Session Lifecycle Integration
**Active Session**:
- TodoWrite automatically syncs with workflow session
- Real-time updates propagate to persistent files
- Progress tracking maintains workflow continuity

**Session Pause**:
- TodoWrite state preserved in TODO_LIST.md
- JSON files maintain detailed task context
- Workflow session tracks overall progress

**Session Resume**:
- TodoWrite reconstructed from TODO_LIST.md + JSON files
- Previous progress state fully restored
- Agent context re-established from preserved state

**Session Switch**:
- Current TodoWrite state saved to workflow files
- New session TodoWrite initialized from target session files
- Seamless context switching without data loss

### Progress Calculation Rules
**Simple Workflows**: Progress = completed todos / total todos
**Medium Workflows**: Progress = weighted completion across todo + subtask hierarchy
**Complex Workflows**: Progress = multi-level rollup with checkpoint weighting

### Blocking and Dependency Management
**Todo Blocking**:
- Blocked todos tracked with resolution requirements
- Upstream dependencies prevent todo activation
- Dependency resolution automatically unblocks downstream todos

**Cross-Todo Dependencies**:
- TodoWrite enforces dependency order
- JSON files maintain dependency graph
- TODO_LIST.md visualizes dependency relationships

## Error Handling and Recovery

### TodoWrite State Corruption
**Recovery Strategy**:
1. Attempt to reconstruct from TODO_LIST.md
2. Fallback to JSON file task status
3. Last resort: regenerate from workflow session state
4. Manual intervention if all sources inconsistent

### Sync Conflict Resolution
**Priority Order**:
1. **TodoWrite** (most recent user interaction)
2. **JSON Files** (authoritative task state)
3. **TODO_LIST.md** (persistence layer)
4. **Manual Resolution** (complex conflicts)

### Validation Rules
- Todo IDs must map to valid JSON task IDs
- Todo status must be consistent across all coordination layers
- Progress calculations must align with actual task completion
- Single active todo rule must be enforced at all times

## Integration with Specialized Systems

### Task Management Integration

**Hierarchical Support**: TodoWrite flattens task hierarchy for execution view
**Status Synchronization**: Bidirectional sync with JSON task status

### Session Management Integration  
**Multi-Session Support**: TodoWrite aware of active session context
**Context Switching**: Seamless integration with session switching

### Complexity Classification Integration
**Pattern Selection**: TodoWrite patterns match complexity classification
**Auto-scaling**: TodoWrite patterns adapt to workflow complexity changes

## Quality Assurance

### Mandatory Validation Checks
- TodoWrite entries exist before agent coordination
- Single active todo rule maintained throughout execution
- Progress tracking accuracy across all coordination layers
- Completion gates properly validated before marking tasks complete
- Sync consistency across TodoWrite, TODO_LIST.md, and JSON files

### Performance Requirements
- TodoWrite updates must be real-time (< 100ms response)
- Sync operations must complete within 500ms
- Progress calculation must be immediate
- Context switching must preserve full state

---

**System ensures**: Seamless coordination between TodoWrite tool interface and persistent workflow state with real-time progress tracking and reliable state management