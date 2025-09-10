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
Intelligently breaks down complex tasks into manageable subtasks with automatic context distribution and agent assignment.

## Core Principles
**Task Schema:** @~/.claude/workflows/workflow-architecture.md

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
- impl-1.4 → code-review-test-agent

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
      },
      "implementation": {
        "files": [
          {
            "path": "src/auth/models/User.ts",
            "location": {
              "function": "UserSchema",
              "lines": "auto-detect",
              "description": "User schema definition for authentication"
            },
            "original_code": "// Requires gemini analysis for current schema structure",
            "modifications": {
              "current_state": "Basic user model without auth fields",
              "proposed_changes": [
                "Add JWT token storage fields",
                "Include authentication provider fields",
                "Add timestamp tracking for security"
              ],
              "logic_flow": [
                "defineSchema() ───► addAuthFields() ───► validateStructure()",
                "◊─── if JWT ───► addTokenFields() ───► addExpirationLogic()",
                "◊─── if OAuth ───► addProviderFields() ───► linkExternalAccounts()"
              ],
              "reason": "Support comprehensive authentication system requirements",
              "expected_outcome": "Robust user schema supporting multiple authentication methods"
            }
          }
        ],
        "context_notes": {
          "dependencies": ["mongoose", "jsonwebtoken"],
          "affected_modules": ["auth-service", "user-controller"],
          "risks": [
            "Database migration required for existing users",
            "Schema validation complexity with multiple auth types"
          ],
          "performance_considerations": "Index auth fields for fast lookups",
          "error_handling": "Graceful validation errors for schema changes"
        },
        "analysis_source": "auto-detected"
      }
    }
  ]
}
```

## Implementation Field Inheritance

### Parent to Subtask Context Flow
When breaking down tasks, implementation details are inherited and refined:

**Parent Implementation Context**:
- High-level file scope (e.g., "src/auth/*")
- General requirements and dependencies
- Architecture-level risks and considerations

**Subtask Implementation Refinement**:
- Specific file paths (e.g., "src/auth/models/User.ts")
- Precise function locations and line ranges
- Detailed modification steps and logic flows
- Subtask-specific risks and dependencies

**Auto-Population Strategy for Subtasks**:
1. **Inherit from Parent**: Copy relevant files from parent.implementation.files
2. **Refine Scope**: Narrow down to subtask-specific files and functions
3. **Generate Details**: Create subtask-specific modifications and logic flows
4. **Risk Analysis**: Identify subtask-level risks from parent context
5. **Gemini Trigger**: Mark analysis_source as "gemini" when details need extraction

## Agent Assignment Logic

Based on subtask type and implementation complexity:
- **Design/Planning** → `planning-agent` (architectural implementation planning)
- **Implementation** → `code-developer` (file-level code changes)
- **Testing** → `code-review-test-agent` (test implementation for specific functions)
- **Review** → `review-agent` (code review with implementation context)

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