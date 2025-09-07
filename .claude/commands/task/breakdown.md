---
name: task-breakdown
description: Intelligent task decomposition with context-aware subtask generation
usage: /task:breakdown <task-id> [--strategy=<auto|interactive>] [--depth=<1-3>]
argument-hint: task-id [optional: strategy and depth]
examples:
  - /task:breakdown IMPL-1
  - /task:breakdown IMPL-1 --strategy=auto
  - /task:breakdown IMPL-1.1 --depth=2 --strategy=interactive
---

# Task Breakdown Command (/task:breakdown)

## Overview
Intelligently breaks down complex tasks into manageable subtasks with automatic context distribution and agent assignment.

## Core Principles
**System:** @~/.claude/workflows/unified-workflow-system-principles.md  
**Task Schema:** @~/.claude/workflows/task-management-principles.md

## Features

⚠️ **CRITICAL**: Before breakdown, MUST check for existing active session to avoid creating duplicate sessions.

### Session Check Process
1. **Query Session Registry**: Check `.workflow/session_status.jsonl` for active sessions. If the file doesn't exist, create it.
2. **Session Validation**: Use existing active session containing the parent task
3. **Context Integration**: Load existing session state and task hierarchy

### Smart Decomposition
- **Auto Strategy**: AI-powered subtask generation based on title
- **Interactive Mode**: Guided breakdown with suggestions
- **Context Distribution**: Subtasks inherit parent context
- **Agent Mapping**: Automatic agent assignment per subtask

### Built-in Task Management
- **JSON Task Hierarchy**: Creates hierarchical JSON subtasks (impl-N.M.P)
- **TODO_LIST.md Integration**: Automatically updates progress display with new subtask structure
- **TODO_LIST.md Maintenance**: Updates task hierarchy display with parent-child relationships
- **Context Distribution**: Subtasks inherit and refine parent context
- **Progress Synchronization**: Updates hierarchical progress calculations in TODO_LIST.md
- **No External Commands**: All task operations are internal to this command

### Breakdown Rules
- Only `pending` tasks can be broken down
- Parent becomes container (not directly executable)
- Subtasks use hierarchical format: impl-N.M.P (e.g., IMPL-1.1.2)
- Maximum depth: 3 levels (impl-N.M.P)
- Parent task progress = average of subtask progress
- Automatically updates TODO_LIST.md with hierarchical structure

## Usage

### Basic Breakdown
```bash
/task:breakdown IMPL-1
```

Interactive prompt with automatic task management:
```
Task: Build authentication module
Workflow: 28 total tasks (Complex workflow detected)

Suggested subtasks:
1. Design authentication schema
2. Implement login endpoint  
3. Add JWT token handling
4. Write unit tests

Internal task processing:
✅ Level 2 hierarchy will be created (embedded logic)
   Reason: >15 total tasks detected
   Process: Automatic task hierarchy creation without external command calls

Accept task breakdown? (y/n/edit): y
```

### Auto Strategy with Override Options
```bash
/task:breakdown IMPL-1 --strategy=auto
/task:breakdown IMPL-1 --force-level=2    # Force specific document level
/task:breakdown IMPL-1 --no-split         # Disable automatic document splitting
```

Automatic generation:
```
✅ Task IMPL-1 broken down:
├── IMPL-1.1: Design authentication schema
├── IMPL-1.2: Implement core auth logic
├── IMPL-1.3: Add security middleware
└── IMPL-1.4: Write comprehensive tests

Agents assigned:
- IMPL-1.1 → planning-agent
- IMPL-1.2 → code-developer
- IMPL-1.3 → code-developer
- IMPL-1.4 → test-agent

📄 Internal task processing:
- JSON subtasks: IMPL-1.1, IMPL-1.2, IMPL-1.3, IMPL-1.4 created
- Task structure: Level 2 hierarchy established through embedded logic
- Progress tracking: TODO_LIST.md updated with hierarchical progress display
- Cross-references: All task links generated and validated internally
```

## Decomposition Patterns

### Feature Task Pattern
```
Feature: "Implement shopping cart"
├── Design data model
├── Build API endpoints
├── Add state management
├── Create UI components
└── Write tests
```

### Bug Fix Pattern
```
Bug: "Fix performance issue"
├── Profile and identify bottleneck
├── Implement optimization
├── Verify fix
└── Add regression test
```

### Refactor Pattern
```
Refactor: "Modernize auth system"
├── Analyze current implementation
├── Design new architecture
├── Migrate incrementally
├── Update documentation
└── Deprecate old code
```

## Context Distribution

Parent context is intelligently distributed:
```json
{
  "parent": {
    "id": "IMPL-1",
    "context": {
      "inherited_from": "WFS-[topic-slug]",
      "requirements": ["JWT auth", "2FA support"],
      "scope": ["src/auth/*"],
      "acceptance": ["Authentication system works"]
    }
  },
  "subtasks": [
    {
      "id": "IMPL-1.1",
      "title": "Design authentication schema",
      "status": "pending",
      "agent": "planning-agent",
      "context": {
        "inherited_from": "IMPL-1",
        "requirements": ["JWT auth schema", "User model design"],
        "scope": ["src/auth/models/*"],
        "acceptance": ["Schema validates JWT tokens", "User model complete"]
      }
    }
  ]
}
```

## Agent Assignment Logic

Based on subtask type:
- **Design/Planning** → `planning-agent`
- **Implementation** → `code-developer`
- **Testing** → `test-agent`
- **Documentation** → `docs-agent`
- **Review** → `review-agent`

## Validation

### Pre-breakdown Checks
1. Task exists and is valid
2. Task status is `pending`
3. Not already broken down
4. Workflow in IMPLEMENT phase

### Post-breakdown Actions
1. Update parent status to `container`
2. Create subtask JSON files with document references
3. Update IMPL_PLAN.md with enhanced task hierarchy structure
4. Create/update TODO_LIST.md with progress tracking
5. Update workflow session with document references
6. Validate phase alignment with IMPL_PLAN.md (if exists)
7. Generate execution plan with document coordination

## Execution Planning

After breakdown, generates execution order:
```
Execution Plan for IMPL-1:
Phase 1 (Parallel):
  - IMPL-1.1: Design authentication schema
  
Phase 2 (Sequential):
  - IMPL-1.2: Implement core auth logic
  - IMPL-1.3: Add security middleware
  
Phase 3 (Parallel):
  - IMPL-1.4: Write comprehensive tests
  
Dependencies resolved automatically
```

## Built-in Document Management

### Automatic File Structure Creation (Based on Workflow Scale)

#### Level 0: Unified Documents (<15 tasks)
```
.workflow/WFS-[topic-slug]/
├── IMPL_PLAN.md (enhanced)    # Updated with new task hierarchy
├── TODO_LIST.md         # Updated with new progress entries
├── workflow-session.json     # Session state
└── .task/
    ├── IMPL-1.json                   # Parent task (container) 
    ├── IMPL-1.1.json                 # Subtask 1
    └── IMPL-1.2.json                 # Subtask 2
```

#### Level 1: Enhanced Structure (5-15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json
├── IMPL_PLAN.md                    # Combined planning document
├── TODO_LIST.md                    # Progress tracking (auto-generated)
├── .summaries/                     # Task completion summaries
│   ├── IMPL-*.md                   # Main task summaries
│   └── IMPL-*.*.md                 # Subtask summaries  
└── .task/
    ├── IMPL-*.json                 # Main task definitions
    └── IMPL-*.*.json               # Subtask definitions (up to 3 levels)
```

#### Level 2: Complete Structure (>15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json
├── IMPL_PLAN.md                    # Comprehensive planning document
├── TODO_LIST.md                    # Progress tracking and monitoring
├── .summaries/                     # Task completion summaries
│   ├── IMPL-*.md                   # Main task summaries
│   ├── IMPL-*.*.md                 # Subtask summaries
│   └── IMPL-*.*.*.md              # Detailed subtask summaries
└── .task/
    ├── IMPL-*.json                 # Task hierarchy (max 3 levels deep)
    ├── IMPL-*.*.json               # Subtasks
    └── IMPL-*.*.*.json             # Detailed subtasks
```

### Built-in Document Creation Process

#### Level 0: Unified Document Updates (<15 tasks)
When task count is below threshold, command automatically updates unified documents:
- Updates existing IMPL_PLAN.md with enhanced task hierarchy structure
- Updates existing TODO_LIST.md with progress tracking
- Maintains TODO_LIST.md for progress coordination

#### Level 1: Task-Based Document Generation (15-50 tasks)
When enhanced complexity detected, command automatically:

**Updates IMPL_PLAN.md with task breakdown**:
- Adds hierarchical task structure with subtasks
- Updates requirements and acceptance criteria
- Maintains cross-references to JSON task files
- Preserves overall workflow context

**Creates/Updates TODO_LIST.md**:
- Displays hierarchical task structure with checkboxes
- Shows progress percentages and completion status
- Cross-references task details with JSON files
- Provides at-a-glance workflow progress overview

#### Level 2: Complete Structure Document Updates (>15 tasks)
When complex workflows detected, command automatically:

**Expands IMPL_PLAN.md with comprehensive planning**:
- Detailed task hierarchy with up to 3 levels deep
- Complete requirements analysis and acceptance criteria
- Risk assessment and mitigation strategies
- Cross-references to all JSON task files

**Maintains comprehensive TODO_LIST.md**:
- Full hierarchical display with progress rollups
- Multi-level task completion tracking
- Detailed progress percentages across task hierarchy
- Cross-references to .summaries/ for completed tasks

**Manages .summaries/ directory**:
- Creates task completion documentation structure
- Maintains audit trail of implementation decisions
- Links completed tasks back to workflow session

### JSON Task Management Integration

#### Task JSON Structure
```json
{
  "id": "IMPL-1.1",
  "title": "Design authentication schema",
  "parent_id": "IMPL-1", 
  "status": "pending",
  "type": "design",
  "agent": "planning-agent",
  "effort": "1h",
  
  "context": {
    "inherited_from": "IMPL-1",
    "requirements": ["User model schema", "JWT token design"],
    "scope": ["src/auth/models/*", "auth-schema.md"],
    "acceptance": ["Schema validates JWT tokens", "User model complete"]
  },
  
  "hierarchy_context": {
    "parent_task": "IMPL-1",
    "level": 2,
    "siblings": ["IMPL-1.2", "IMPL-1.3", "IMPL-1.4"]
  },
  
  "dependencies": {
    "upstream": [],
    "downstream": ["IMPL-1.2", "IMPL-1.3"]
  },
  
  "metadata": {
    "created_by": "task:breakdown IMPL-1 --split-docs",
    "document_sync": "2025-09-05T10:35:00Z",
    "splitting_level": 2
  }
}
```

#### TODO_LIST.md Integration
The task breakdown automatically updates TODO_LIST.md with:

- **Hierarchical Task Display**: Shows parent-child relationships using checkbox indentation
- **Progress Tracking**: Calculates completion percentages based on subtask status
- **JSON Cross-References**: Links to .task/ JSON files for detailed task information
- **Status Synchronization**: Keeps TODO_LIST.md checkboxes in sync with JSON task status

### Coordination with IMPL_PLAN.md

If IMPL_PLAN.md exists (complex workflows), task breakdown validates against phase structure:

```markdown
### Phase 1: Foundation
- **Tasks**: IMPL-1 → Now broken down to IMPL-1.1-4
- **Validation**: ✅ All subtasks align with phase objectives
- **Dependencies**: ✅ Phase dependencies preserved
```

## Advanced Options

### Depth Control
```bash
# Single level (default)
/task:breakdown IMPL-1 --depth=1

# Two levels (for complex tasks)
/task:breakdown IMPL-1 --depth=2
```

### Custom Breakdown
```bash
/task:breakdown IMPL-1 --custom
> Enter subtask 1: Custom subtask title
> Assign agent (auto/manual): auto
> Enter subtask 2: ...
```

## Task Validation & Error Handling

### Comprehensive Validation Checks
```bash
/task:breakdown impl-1 --validate

Pre-breakdown validation:
✅ workflow-session.json exists and is writable
✅ .task/ directory accessible
✅ Parent task JSON file valid
✅ Hierarchy depth within limits (max 3 levels)
⚠️ Complexity threshold reached - will generate TODO_LIST.md

Post-breakdown validation:
✅ All subtask JSON files created in .task/
✅ Parent-child relationships established
✅ Cross-references consistent across files
✅ TODO_LIST.md generated/updated (if triggered)
✅ workflow-session.json synchronized
✅ File structure matches complexity level
```

### Error Recovery & File Management
```bash
# JSON file conflicts
⚠️ Parent task JSON structure inconsistent with breakdown
→ Auto-sync parent JSON file? (y/n)

# Missing directory structure  
❌ .task/ directory not found
→ Create required directory structure? (y/n)

# Complexity level mismatch
⚠️ Task count suggests Level 1 but structure is Level 0
→ 1. Upgrade structure  2. Keep minimal  3. Manual adjustment

# Hierarchy depth violation
❌ Attempting to create impl-1.2.3.4 (exceeds 3-level limit)
→ 1. Flatten hierarchy  2. Reorganize structure  3. Abort
```

## Integration

### Workflow Updates
- Updates task count in session
- Recalculates progress metrics  
- Maintains task hierarchy in both JSON and documents
- Synchronizes document references across all files

### File System Integration
- **Real-time Sync**: JSON task files updated immediately during breakdown
- **Bidirectional Sync**: Maintains consistency between JSON, TODO_LIST.md, and session
- **Conflict Resolution**: JSON files are authoritative for task details and hierarchy
- **Version Control**: All task changes tracked in .task/ directory
- **Backup Recovery**: Can restore task hierarchy from workflow-session.json
- **Structure Validation**: Ensures compliance with progressive structure standards

### Next Actions
After breakdown:
- `/task:execute` - Run subtasks using JSON task context
- `/task:status` - View hierarchy from JSON files and TODO_LIST.md
- `/context` - Analyze task relationships and JSON structure
- `/task:replan` - Adjust breakdown and update task structure

## Examples

### Complex Feature
```bash
/task:breakdown IMPL-1 --strategy=auto --depth=2

Result:
IMPL-1: E-commerce checkout
├── IMPL-1.1: Payment processing
│   ├── IMPL-1.1.1: Integrate payment gateway
│   ├── IMPL-1.1.2: Handle transactions
│   └── IMPL-1.1.3: Add error handling
├── IMPL-1.2: Order management
│   ├── IMPL-1.2.1: Create order model
│   └── IMPL-1.2.2: Implement order workflow
└── IMPL-1.3: Testing suite
```

## Related Commands

- `/task:create` - Create new tasks
- `/task:context` - Manage task context
- `/task:execute` - Execute subtasks
- `/task:replan` - Adjust breakdown
- `/task:status` - View task hierarchy