---
name: task-breakdown
description: Intelligent task decomposition with context-aware subtask generation
usage: /task:breakdown <task-id>
argument-hint: task-id
examples:
  - /task:breakdown IMPL-1
  - /task:breakdown IMPL-1.1
  - /task:breakdown impl-3
---

# Task Breakdown Command (/task:breakdown)

## Overview
Intelligently breaks down complex tasks into manageable subtasks with automatic context distribution and agent assignment.

## Core Principles
**Task Schema:** @~/.claude/workflows/data-model.md

## Features

⚠️ **CRITICAL**: Before breakdown, MUST check for existing active session to avoid creating duplicate sessions.

### Session Check Process
1. **Check Active Session**: Check for `.workflow/.active-*` marker file to identify active session containing the parent task.
2. **Session Validation**: Use existing active session containing the parent task
3. **Context Integration**: Load existing session state and task hierarchy

### Smart Decomposition
- **Auto Strategy**: AI-powered subtask generation based on title
- **Interactive Mode**: Guided breakdown with suggestions
- **Context Distribution**: Subtasks inherit parent context
- **Agent Mapping**: Automatic agent assignment per subtask

### Simplified Task Management
- **JSON Task Hierarchy**: Creates hierarchical JSON subtasks (impl-N.M.P)
- **Context Distribution**: Subtasks inherit parent context
- **Basic Status Tracking**: Updates task relationships only
- **No Complex Synchronization**: Simple parent-child relationships

### Breakdown Rules
- Only `pending` tasks can be broken down
- Parent becomes container (not directly executable)
- Subtasks use hierarchical format: impl-N.M.P (e.g., impl-1.1.2)
- Maximum depth: 3 levels (impl-N.M.P)
- Parent-child relationships tracked in JSON only

## Usage

### Basic Breakdown
```bash
/task:breakdown IMPL-1
```

Interactive prompt:
```
Task: Build authentication module

Suggested subtasks:
1. Design authentication schema
2. Implement login endpoint  
3. Add JWT token handling
4. Write unit tests

Accept task breakdown? (y/n/edit): y
```

### Auto Strategy
```bash
/task:breakdown impl-1 --strategy=auto
```

Automatic generation:
```
✅ Task impl-1 broken down:
├── impl-1.1: Design authentication schema
├── impl-1.2: Implement core auth logic
├── impl-1.3: Add security middleware
└── impl-1.4: Write comprehensive tests

Agents assigned:
- impl-1.1 → planning-agent
- impl-1.2 → code-developer
- impl-1.3 → code-developer
- impl-1.4 → test-agent

JSON files created:
- .task/impl-1.1.json
- .task/impl-1.2.json
- .task/impl-1.3.json
- .task/impl-1.4.json
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
    "id": "impl-1",
    "context": {
      "requirements": ["JWT auth", "2FA support"],
      "scope": ["src/auth/*"],
      "acceptance": ["Authentication system works"],
      "inherited_from": "WFS-user-auth"
    }
  },
  "subtasks": [
    {
      "id": "impl-1.1",
      "title": "Design authentication schema",
      "status": "pending",
      "agent": "planning-agent",
      "context": {
        "requirements": ["JWT auth schema", "User model design"],
        "scope": ["src/auth/models/*"],
        "acceptance": ["Schema validates JWT tokens", "User model complete"],
        "inherited_from": "impl-1"
      },
      "relations": {
        "parent": "impl-1",
        "subtasks": [],
        "dependencies": []
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
2. Create subtask JSON files
3. Update parent task with subtask references
4. Update workflow session stats

## Simple File Management

### File Structure Created
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json     # Session state
├── IMPL_PLAN.md             # Static planning document
└── .task/
    ├── impl-1.json          # Parent task (container) 
    ├── impl-1.1.json        # Subtask 1
    └── impl-1.2.json        # Subtask 2
```

### Output Files
- JSON subtask files in `.task/` directory
- Updated parent task JSON with subtask references
- Updated session stats in `workflow-session.json`

## Examples

### Simple Breakdown
```bash
/task:breakdown impl-1

Result:
impl-1: Build authentication (container)
├── impl-1.1: Design auth schema
├── impl-1.2: Implement auth logic  
├── impl-1.3: Add security middleware
└── impl-1.4: Write tests
```

### Two-Level Breakdown
```bash
/task:breakdown impl-1 --depth=2

Result:  
impl-1: E-commerce checkout (container)
├── impl-1.1: Payment processing
│   ├── impl-1.1.1: Integrate gateway
│   └── impl-1.1.2: Handle transactions
├── impl-1.2: Order management
│   └── impl-1.2.1: Create order model
└── impl-1.3: Testing
```

## Error Handling

```bash
# Task not found
❌ Task impl-5 not found

# Already broken down
⚠️ Task impl-1 already has subtasks

# Max depth exceeded
❌ Cannot create impl-1.2.3.4 (max 3 levels)
```

## Related Commands

- `/task:create` - Create new tasks
- `/task:execute` - Execute subtasks  
- `/context` - View task hierarchy