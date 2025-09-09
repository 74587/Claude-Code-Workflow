---
name: execute
description: Execute tasks with appropriate agents and context-aware orchestration
usage: /task:execute <task-id>
argument-hint: task-id
examples:
  - /task:execute impl-1
  - /task:execute impl-1.2
  - /task:execute impl-3
---

### 🚀 **Command Overview: `/task:execute`**

-   **Purpose**: Executes tasks using intelligent agent selection, context preparation, and progress tracking.
-   **Core Principles**: @~/.claude/workflows/workflow-architecture.md

### ⚙️ **Execution Modes**

-   **auto (Default)**
    -   Fully autonomous execution with automatic agent selection.
    -   Provides progress updates at each checkpoint.
    -   Automatically completes the task when done.
-   **guided**
    -   Executes step-by-step, requiring user confirmation at each checkpoint.
    -   Allows for dynamic adjustments and manual review during the process.
-   **review**
    -   Executes under the supervision of a `review-agent`.
    -   Performs quality checks and provides detailed feedback at each step.

### 🤖 **Agent Selection Logic**

The system determines the appropriate agent for a task using the following logic.

```pseudo
FUNCTION select_agent(task, agent_override):
    // A manual override always takes precedence.
    // Corresponds to the --agent=<agent-type> flag.
    IF agent_override IS NOT NULL:
        RETURN agent_override

    // If no override, select based on keywords in the task title.
    ELSE:
        CASE task.title:
            WHEN CONTAINS "Build API", "Implement":
                RETURN "code-developer"
            WHEN CONTAINS "Design schema", "Plan":
                RETURN "planning-agent"
            WHEN CONTAINS "Write tests":
                RETURN "test-agent"
            WHEN CONTAINS "Review code":
                RETURN "review-agent"
            DEFAULT:
                RETURN "code-developer" // Default agent
        END CASE
END FUNCTION
```

### 🔄 **Core Execution Protocol**

`Pre-Execution` **->** `Execution` **->** `Post-Execution`

### ✅ **Pre-Execution Protocol**

`Validate Task & Dependencies` **->** `Prepare Execution Context` **->** `Coordinate with TodoWrite`

-   **Validation**: Checks for the task's JSON file in `.task/` and resolves its dependencies.
-   **Context Preparation**: Loads task and workflow context, preparing it for the selected agent.
-   **TodoWrite Coordination**: Generates execution Todos and checkpoints, syncing with `TODO_LIST.md`.

### 🏁 **Post-Execution Protocol**

`Update Task Status` **->** `Generate Summary` **->** `Save Artifacts` **->** `Sync All Progress` **->** `Validate File Integrity`

-   Updates status in the task's JSON file and `TODO_LIST.md`.
-   Creates a summary in `.summaries/`.
-   Stores outputs and syncs progress across the entire workflow session.

### 🧠 **Task & Subtask Execution Logic**

This logic defines how single, multiple, or parent tasks are handled.

```pseudo
FUNCTION execute_task_command(task_id, mode, parallel_flag):
    // Handle parent tasks by executing their subtasks.
    IF is_parent_task(task_id):
        subtasks = get_subtasks(task_id)
        EXECUTE_SUBTASK_BATCH(subtasks, mode)

    // Handle wildcard execution (e.g., IMPL-001.*)
    ELSE IF task_id CONTAINS "*":
        subtasks = find_matching_tasks(task_id)
        IF parallel_flag IS true:
            EXECUTE_IN_PARALLEL(subtasks)
        ELSE:
            FOR each subtask in subtasks:
                EXECUTE_SINGLE_TASK(subtask, mode)
  
    // Default case for a single task ID.
    ELSE:
        EXECUTE_SINGLE_TASK(task_id, mode)
END FUNCTION
```

### 🛡️ **Error Handling & Recovery Logic**

```pseudo
FUNCTION pre_execution_check(task):
    // Ensure dependencies are met before starting.
    IF task.dependencies ARE NOT MET:
        LOG_ERROR("Cannot execute " + task.id)
        LOG_INFO("Blocked by: " + unmet_dependencies)
        HALT_EXECUTION()

FUNCTION on_execution_failure(checkpoint):
    // Provide user with recovery options upon failure.
    LOG_WARNING("Execution failed at checkpoint " + checkpoint)
    PRESENT_OPTIONS([
        "Retry from checkpoint",
        "Retry from beginning",
        "Switch to guided mode",
        "Abort execution"
    ])
    AWAIT user_input
    // System performs the selected action.
END FUNCTION
```

### ✨ **Advanced Execution Controls**

-   **Dry Run (`--dry-run`)**: Simulates execution, showing the agent, estimated time, and files affected without making changes.
-   **Custom Checkpoints (`--checkpoints="..."`)**: Overrides the default checkpoints with a custom, comma-separated list (e.g., `"design,implement,deploy"`).
-   **Conditional Execution (`--if="..."`)**: Proceeds with execution only if a specified condition (e.g., `"tests-pass"`) is met.
-   **Rollback (`--rollback`)**: Reverts file modifications and restores the previous task state.

### 📄 **Simplified Context Structure (JSON)**

This is the simplified data structure loaded to provide context for task execution.

```json
{
  "task": {
    "id": "impl-1",
    "title": "Build authentication module",
    "type": "feature",
    "status": "active",
    "agent": "code-developer",
    "context": {
      "requirements": ["JWT authentication", "OAuth2 support"],
      "scope": ["src/auth/*", "tests/auth/*"],
      "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"],
      "inherited_from": "WFS-user-auth"
    },
    "relations": {
      "parent": null,
      "subtasks": ["impl-1.1", "impl-1.2"],
      "dependencies": ["impl-0"]
    }
  },
  "workflow": {
    "session": "WFS-user-auth",
    "phase": "IMPLEMENT"
  },
  "execution": {
    "agent": "code-developer",
    "mode": "auto",
    "attempts": 0
  }
}
```

### 🎯 **Agent-Specific Context**

Different agents receive context tailored to their function:
-   **`code-developer`**: Code patterns, dependencies, file scopes.
-   **`planning-agent`**: High-level requirements, constraints, success criteria.
-   **`test-agent`**: Test requirements, code to be tested, coverage goals.
-   **`review-agent`**: Quality standards, style guides, review criteria.

### 🗃️ **Simplified File Output**

-   **Task JSON File (`.task/<task-id>.json`)**: Updated with status and last attempt time only.
-   **Session File (`workflow-session.json`)**: Updated task stats (completed count).
-   **Summary File**: Generated in `.summaries/` upon completion (optional).

### 📝 **Simplified Summary Template**

Optional summary file generated at `.summaries/impl-[task-id]-summary.md`.

```markdown
# Task Summary: impl-1 Build Authentication Module

## What Was Done
- Created src/auth/login.ts with JWT validation
- Added tests in tests/auth.test.ts

## Execution Results
- **Agent**: code-developer
- **Status**: completed

## Files Modified
- `src/auth/login.ts` (created)
- `tests/auth.test.ts` (created)
```
