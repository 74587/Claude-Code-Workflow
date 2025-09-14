---
name: breakdown
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
Breaks down complex tasks into executable subtasks with context inheritance and agent assignment.

## Core Principles
**Task System:** @~/.claude/workflows/task-core.md

## Core Features

⚠️ **CRITICAL**: Check for active session before breakdown to avoid conflicts.

### Breakdown Process
1. **Session Check**: Verify active session contains parent task
2. **Task Validation**: Ensure parent is `pending` status
3. **AI Decomposition**: Generate subtasks based on parent title
4. **Context Distribution**: Inherit parent requirements and scope
5. **Agent Assignment**: Auto-assign agents based on subtask type

### Breakdown Rules
- Only `pending` tasks can be broken down
- Parent becomes `container` status (not executable)
- Subtasks use format: impl-N.M (max 2 levels)
- Context flows from parent to subtasks
- All relationships tracked in JSON

## Usage

### Basic Breakdown
```bash
/task:breakdown impl-1
```

Interactive process:
```
Task: Build authentication module

Suggested subtasks:
1. Design authentication schema
2. Implement core auth logic
3. Add security middleware
4. Write comprehensive tests

Accept breakdown? (y/n): y

✅ Task impl-1 broken down:
▸ impl-1: Build authentication module (container)
  ├── impl-1.1: Design schema → planning-agent
  ├── impl-1.2: Implement logic → code-developer
  ├── impl-1.3: Add middleware → code-developer
  └── impl-1.4: Write tests → code-review-test-agent

Files created: .task/impl-1.json + 4 subtask files
```

## Decomposition Logic

### Agent Assignment
- **Design/Planning** → `planning-agent`
- **Implementation** → `code-developer`
- **Testing** → `code-review-test-agent`
- **Review** → `review-agent`

### Context Inheritance
- Subtasks inherit parent requirements
- Scope refined for specific subtask
- Implementation details distributed appropriately

## Implementation Details

See @~/.claude/workflows/task-core.md for:
- Complete task JSON schema
- Implementation field structure
- Context inheritance rules
- Agent assignment logic

## Validation

### Pre-breakdown Checks
1. Active session exists
2. Task found in session
3. Task status is `pending`
4. Not already broken down

### Post-breakdown Actions
1. Update parent to `container` status
2. Create subtask JSON files
3. Update parent subtasks list
4. Update session stats

## Examples

### Basic Breakdown
```bash
/task:breakdown impl-1

▸ impl-1: Build authentication (container)
  ├── impl-1.1: Design schema → planning-agent
  ├── impl-1.2: Implement logic → code-developer
  └── impl-1.3: Write tests → code-review-test-agent
```

## Error Handling

```bash
# Task not found
❌ Task impl-5 not found

# Already broken down
⚠️ Task impl-1 already has subtasks

# Wrong status
❌ Cannot breakdown completed task impl-2
```

## Related Commands

- `/task:create` - Create new tasks
- `/task:execute` - Execute subtasks
- `/context` - View task hierarchy