# Workflow Document System - Complete Integration Guide

## 🎯 Overview

This document provides a comprehensive guide to the integrated workflow document system that successfully merges the original design philosophy with the current command architecture. The system follows the core principle: **"Documents store primary plans, JSON manages state"**.

## 📋 Core Design Philosophy

### Document-State Separation
- **Documents (Markdown)**: Store requirements, task decomposition, implementation strategies, and acceptance criteria
- **JSON States**: Manage execution status, progress tracking, session coordination, and real-time state changes
- **Bidirectional Sync**: Automatic coordination between planning documents and state management systems

### Planning-First Approach
**"Measure twice, cut once"** - Comprehensive planning prevents costly mistakes and ensures quality outcomes.

## 🏗️ Complete Directory Structure

### Unified Workflow Directory
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json          # Session state and document tracking
├── PLAN.md                         # Basic planning (all complexities)
├── IMPLEMENTATION_PLAN.md          # Staged execution plan (complex only)
├── TASK_DECOMPOSITION.md           # Task breakdown (medium+/complex)
├── TODO_CHECKLIST.md               # Progress tracking (medium+/complex)
├── .task/                          # Task management system
│   └── tasks/                      # Individual task JSON files
│       ├── IMPL-001.json
│       ├── IMPL-002.json
│       └── IMPL-003.json
└── artifacts/                      # Generated files and logs
    ├── reports/                    # Progress and analysis reports
    ├── logs/                       # Execution logs and checkpoints
    └── execution/                  # Task execution artifacts
        └── IMPL-001/
            ├── summary.json
            ├── outputs/
            └── logs/
```

## 📄 Document Types and Usage

### 1. PLAN.md - Universal Planning Document
**Generated for**: All workflow complexities  
**Purpose**: Basic planning and task identification  

```markdown
# Implementation Plan - [Project Name]

## Overview
Brief description of what needs to be implemented

## Requirements
- [Inherited from workflow session context]
- [Specific functional requirements]

## Task Breakdown
- IMPL-001: [Task description]
- IMPL-002: [Task description]
- IMPL-003: [Task description]

## Dependencies
- Task order and relationships
- External dependencies

## Success Criteria
- Acceptance criteria for completion
- Definition of done
```

### 2. IMPLEMENTATION_PLAN.md - Complex Workflow Strategy
**Generated for**: Complex workflows only  
**Purpose**: Detailed staged execution plan with risk assessment

```markdown
# Implementation Plan - [Project Name]

## Executive Summary
High-level overview and strategic approach

## Phase Breakdown

### Phase 1: Foundation
- **Objective**: [Core infrastructure/base components]
- **Tasks**: IMPL-001, IMPL-002
- **Duration**: [Estimate]
- **Success Criteria**: [Measurable outcomes]

### Phase 2: Core Implementation  
- **Objective**: [Main functionality]
- **Tasks**: IMPL-003, IMPL-004, IMPL-005
- **Dependencies**: Phase 1 completion

### Phase 3: Integration & Testing
- **Objective**: [System integration and validation]
- **Tasks**: IMPL-006, IMPL-007

## Risk Assessment
- **High Risk**: [Description] - Mitigation: [Strategy]
- **Medium Risk**: [Description] - Mitigation: [Strategy]

## Quality Gates
- Code review requirements
- Testing coverage targets
- Performance benchmarks

## Rollback Strategy
- Rollback triggers and procedures
- Data preservation approach
```

### 3. TASK_DECOMPOSITION.md - Hierarchical Task Breakdown
**Generated for**: Medium+ workflows when triggered, Complex workflows always  
**Purpose**: Detailed task hierarchy with dependencies and context

```markdown
# Task Decomposition - [Project Name]

## Task Hierarchy

### IMPL-001: [Parent Task Name]
**Owner**: [Agent Type]  
**Effort**: [Estimate]  
**Status**: [pending|active|completed]

#### Context
- **Requirements**: [Specific requirements for this task]
- **Scope**: [Files and components to be modified]
- **Acceptance Criteria**: [What constitutes completion]

#### Subtasks
- IMPL-001.1: [Subtask name] - [Agent] - [Status]
- IMPL-001.2: [Subtask name] - [Agent] - [Status]

#### Dependencies
- **Upstream**: [Tasks that must complete first]
- **Downstream**: [Tasks blocked by this task]

## Execution Order
1. **Parallel Track A**: IMPL-001, IMPL-003
2. **Sequential**: IMPL-002 (depends on Track A)
3. **Final**: IMPL-006 (depends on all above)

## Progress Tracking
- **Total Tasks**: [Count]
- **Completed**: [Count] ([Percentage]%)
- **In Progress**: [Count]
- **Blocked**: [Count]
```

### 4. TODO_CHECKLIST.md - Progress Tracking
**Generated for**: Medium+ workflows when triggered, Complex workflows always  
**Purpose**: Real-time progress tracking with task status

```markdown
# TODO Checklist - [Project Name]

## Progress Overview
- **Overall Progress**: [X]% ([completed]/[total] items)
- **Current Phase**: [Phase name]
- **Active Tasks**: [Count]

## Phase 1: Foundation
### IMPL-001: [Task Name]
- [ ] **IMPL-001.1**: [Subtask] ([Agent])
  - [ ] Design component interface
  - [x] Implement basic structure  
  - [ ] Add unit tests
- [x] **IMPL-001.2**: [Completed subtask] ([Agent])

**Status**: In Progress (1/2 subtasks complete)

## Blocked Items
- **IMPL-003**: Waiting for API specification
  - **Blocker**: External dependency
  - **Action**: Follow up with API team

## Completed Items ✅
- **IMPL-000**: [Completed task] - Completed [Date]

## Cross-References
- Task Details: See TASK_DECOMPOSITION.md
- Implementation Strategy: See IMPLEMENTATION_PLAN.md
```

## 🔄 Document Generation Rules

### Complexity-Based Generation

#### Simple Workflows
**Document Requirements**: Minimal or skip documentation
- **Generated**: Optional basic PLAN.md
- **Focus**: Direct implementation over documentation
- **Use Cases**: Single file changes, bug fixes, small modifications

#### Medium Workflows  
**Document Requirements**: Structured planning with conditional decomposition
- **Always Generated**: PLAN.md
- **Conditionally Generated**: TASK_DECOMPOSITION.md + TODO_CHECKLIST.md
- **Trigger Conditions**:
  - Task involves >3 modules/components
  - >5 distinct subtasks identified
  - Complex interdependencies detected
  - Estimated effort >4 hours

#### Complex Workflows
**Document Requirements**: Complete documentation suite (MANDATORY)
- **Always Generated**: 
  - PLAN.md
  - IMPLEMENTATION_PLAN.md  
  - TASK_DECOMPOSITION.md
  - TODO_CHECKLIST.md
- **Use Cases**: Architecture changes, security implementations, system integrations

### Automatic Generation Triggers

```
Medium Complexity Triggers:
IF (modules_affected > 3) OR 
   (subtasks_count > 5) OR 
   (estimated_effort > "4h") OR
   (dependencies_count > 2)
THEN generate_task_decomposition()

Complex Complexity Triggers:
IF (architecture_changes = true) OR
   (security_implementation = true) OR
   (performance_optimization = true) OR
   (estimated_effort > "8h") OR
   (risk_level = "high")
THEN generate_full_documentation_suite()
```

## 🔧 Command Integration

### Workflow Commands Integration

#### /workflow:session start
```bash
/workflow:session start <complexity> "task description"
```
**Document Actions**:
- Creates session directory structure
- Initializes document templates based on complexity
- Prepares JSON state files with document references
- Sets up document generation capabilities

#### /workflow:plan
```bash
/workflow:plan [--force-complex|--force-simple]
```
**Document Actions**:
- Generates PLAN.md for all complexities
- Generates IMPLEMENTATION_PLAN.md for complex workflows
- Updates workflow-session.json with document references
- Creates document directory structure

#### /workflow:implement  
```bash
/workflow:implement --type=<simple|medium|complex>
```
**Document Actions**:
- Checks decomposition triggers for medium workflows
- MANDATORY generates TASK_DECOMPOSITION.md + TODO_CHECKLIST.md for complex
- Creates individual task JSON files linked to documents
- Synchronizes task creation between documents and JSON states

### Task Commands Integration

#### /task:create
```bash
/task:create "task title" [--from-decomposition]
```
**Document Actions**:
- Updates TASK_DECOMPOSITION.md and TODO_CHECKLIST.md if they exist
- Can import from existing TASK_DECOMPOSITION.md structure
- Maintains cross-references between documents and JSON
- Triggers document generation if conditions are met

#### /task:status
```bash
/task:status [--format=tree|list|json] [--detailed]
```
**Document Actions**:
- Displays progress from TODO_CHECKLIST.md
- Shows document-based task hierarchy
- Indicates document sync status
- Provides document-aware progress reporting

#### /task:breakdown
```bash
/task:breakdown <task-id> [--strategy=auto|interactive]
```
**Document Actions**:
- Generates/updates TASK_DECOMPOSITION.md
- Creates corresponding TODO_CHECKLIST.md entries
- Maintains parent-child relationships in documents
- Updates document cross-references

#### /task:execute
```bash
/task:execute <task-id> [--mode=auto|guided|review]
```
**Document Actions**:
- Uses context from TASK_DECOMPOSITION.md if available
- Updates TODO_CHECKLIST.md progress during execution
- Stores execution artifacts in structured directory
- Maintains document-JSON synchronization

## 🔄 Document-JSON Coordination

### Data Ownership Rules

#### Documents Own (Source of Truth)
- Requirements and scope definition
- Task breakdown and structure
- Implementation strategies and approaches
- Acceptance criteria and quality standards
- Risk assessments and mitigation plans

#### JSON States Own (Source of Truth)
- Current execution status (pending/active/completed/blocked)
- Progress percentages and timing
- Agent assignments and execution results
- Session metadata and timestamps
- Dynamic state changes

#### Shared Responsibility (Synchronized)
- Task hierarchies (structure in docs, status in JSON)
- Dependencies (defined in docs, status tracked in JSON)
- Progress tracking (structure in docs, current state in JSON)

### Synchronization Mechanisms

#### Document → JSON Updates
```
Event: Task decomposition document created
Action: 
  - Create corresponding task entries in JSON
  - Import task hierarchy and dependencies
  - Initialize status as "pending"
  - Link JSON tasks to document sections
```

#### JSON → Document Updates  
```
Event: Task status changed in JSON
Action:
  - Update TODO_CHECKLIST.md with new status
  - Update progress percentages
  - Mark completion timestamps
  - Update dependency blocking status
```

### Session State with Document Tracking

```json
{
  "session_id": "WFS-[topic-slug]", 
  "project": "OAuth2 authentication system",
  "type": "complex",
  "status": "active",
  "current_phase": "IMPLEMENT",
  "directory": ".workflow/WFS-[topic-slug]",
  "documents": {
    "planning": {
      "PLAN.md": {
        "status": "generated", 
        "path": ".workflow/WFS-[topic-slug]/PLAN.md"
      },
      "IMPLEMENTATION_PLAN.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/IMPLEMENTATION_PLAN.md"
      }
    },
    "implementation": {
      "TASK_DECOMPOSITION.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/TASK_DECOMPOSITION.md"
      },
      "TODO_CHECKLIST.md": {
        "status": "generated", 
        "path": ".workflow/WFS-[topic-slug]/TODO_CHECKLIST.md"
      }
    }
  },
  "task_system": {
    "enabled": true,
    "directory": ".workflow/WFS-[topic-slug]/.task",
    "next_task_id": 4
  }
}
```

### Individual Task JSON Structure

```json
{
  "id": "IMPL-001",
  "title": "Build authentication module",
  "status": "pending",
  "type": "feature",
  "agent": "code-developer",
  "effort": "4h",
  "context": {
    "inherited_from": "WFS-[topic-slug]",
    "requirements": ["JWT authentication", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"]
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
    "last_updated": "2025-09-05T10:30:00Z",
    "last_sync": "2025-09-05T10:30:00Z",
    "version": "1.0"
  }
}
```

## 🚀 Usage Examples

### Example 1: Simple Bug Fix
```bash
# Start simple workflow - minimal documentation
/workflow:session start simple "fix login timeout issue"
/workflow:implement --type=simple
# Documents: Optional PLAN.md or skip documentation
# Focus: Direct implementation
```

### Example 2: Medium Feature Implementation
```bash
# Start medium workflow - structured planning
/workflow:session start medium "add user profile editing"
/workflow:plan  # Generates PLAN.md
/workflow:implement --type=medium
# If >3 modules detected: Auto-generates TASK_DECOMPOSITION.md + TODO_CHECKLIST.md
```

### Example 3: Complex System Integration
```bash
# Start complex workflow - full documentation suite
/workflow:session start complex "implement OAuth2 authentication"
/workflow:plan  # Generates PLAN.md + IMPLEMENTATION_PLAN.md
/workflow:implement --type=complex
# MANDATORY: Generates TASK_DECOMPOSITION.md + TODO_CHECKLIST.md
```

### Example 4: Task Management with Documents
```bash
# Create tasks from decomposition document
/task:create --from-decomposition
# Monitor progress with document integration
/task:status --format=tree  # Shows document-based hierarchy
# Execute with document context
/task:execute IMPL-001  # Uses TASK_DECOMPOSITION.md context
```

## 🎯 Key Benefits

### 1. **Unified Planning System**
- Consistent document formats across all workflow types
- Clear complexity-based requirements
- Automatic generation based on triggers

### 2. **Seamless Integration** 
- Documents and JSON work together automatically
- No manual synchronization required
- Real-time coordination between planning and execution

### 3. **Scalable Complexity Management**
- Simple tasks: minimal overhead
- Medium tasks: structured when needed
- Complex tasks: comprehensive documentation

### 4. **Comprehensive Tracking**
- Progress visible in both documents and JSON
- Cross-references maintained automatically
- Full audit trail of decisions and changes

### 5. **Original Design Preserved**
- **Documents**: Store primary plans and strategies
- **JSON**: Manage execution state and progress
- **Coordination**: Automatic bidirectional sync

## 📚 Technical Documentation References

**Core System Architecture**:
- `@~/.claude/workflows/unified-workflow-system-principles.md` - **Master reference for all core principles**

**Implementation Details**:
- `@~/.claude/workflows/workflow-document-management-principles.md` - Document generation templates and rules
- `@~/.claude/workflows/hierarchical-document-splitting-system.md` - **Hierarchical document splitting with 3-level structure**
- `@~/.claude/workflows/session-management-principles.md` - Session state management implementation
- `@~/.claude/workflows/task-management-principles.md` - Task JSON schemas and validation
- `@~/.claude/workflows/file-structure-establishment-process.md` - Directory structure creation process
- `@~/.claude/workflows/json-document-coordination-system.md` - Technical synchronization details

## 🎉 Success Metrics

### Implementation Success
✅ **Complete Document System**: All 4 document types implemented and integrated  
✅ **Hierarchical Structure**: 3-level progressive document splitting (Level 0/1/2)
✅ **Unified Directory Structure**: Consistent `.workflow/WFS-[topic-slug]/` format across all commands  
✅ **Smart Document Management**: Automatic splitting/merging based on project scale
✅ **Automatic Generation**: Smart triggers based on complexity and conditions  
✅ **Bidirectional Sync**: Documents and JSON states coordinate seamlessly  
✅ **Command Integration**: All workflow and task commands support hierarchical document system  
✅ **Scalable Architecture**: Handles projects from simple fixes to complex systems (>100 tasks)
✅ **Original Design Fusion**: Successfully merged original workflow.md vision with current architecture

The workflow document system now fully realizes the vision of **"Documents for primary plans, JSON for state management"** while providing a scalable, integrated, and user-friendly development workflow experience.