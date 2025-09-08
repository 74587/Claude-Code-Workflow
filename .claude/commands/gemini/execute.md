---
name: gemini-execute
parent: /gemini
description: Intelligent context inference executor with auto-approval capabilities, supporting user descriptions and task ID execution modes
usage: /gemini/execute <description|task-id>
argument-hint: "implementation description or task-id"
examples:
  - /gemini/execute "implement user authentication system" 
  - /gemini/execute "optimize React component performance"
  - /gemini/execute IMPL-001 
  - /gemini/execute "fix API performance issues"
allowed-tools: Bash(gemini:*)
model: sonnet
---

### 🚀 Command Overview: /gemini/execute


-   **Type**: Intelligent Context Inference Executor.
-   **Purpose**: Infers context files to automatically execute implementation tasks using the Gemini CLI.
-   **Key Feature**: Non-interactive, auto-approved execution by default for streamlined workflows.
-   **Core Tool**: `Bash(gemini:*)`.

### ⚙️ Execution Modes

-   **Direct User Description Mode**:
    -   **Input**: A natural language description of the task (e.g., `"implement user authentication system"`).
    -   **Process**: Analyzes keywords in the description to intelligently infer and collect relevant context files before execution.
-   **Task ID Mode**:
    -   **Input**: A specific task identifier (e.g., `IMPL-001`).
    -   **Process**: Parses the corresponding `.task/impl-*.json` file to determine scope, type, and related files for execution.

### 📥 Command Parameters

-   `--debug`: Outputs detailed logs of the inference process and execution steps.
-   `--save-session`: Saves the entire execution session to the `.workflow/WFS-[topic-slug]/.chat/` directory.

**Note**: All executions run in auto-approval mode by default (equivalent to previous --yolo behavior).

### 🔄 High-Level Execution Flow

-   **Description Input**: `Keyword Extraction` -> `Pattern Mapping` -> `Context Collection` -> `Gemini Execution`
-   **Task ID Input**: `Task Parsing` -> `Type & Scope Analysis` -> `Reference Integration` -> `Gemini Execution`

### 🧠 Intelligent Inference Logic

This logic determines which files are collected as context before calling the Gemini CLI.

```pseudo
FUNCTION infer_context(input, user_description):
  collected_files = ["@{CLAUDE.md,**/*CLAUDE.md}"] // Base context

  // Check for and process user-specified file overrides first
  IF user_description contains "@{...}":
    user_patterns = extract_patterns_from_string(user_description)
    collected_files += user_patterns

  // Determine execution mode based on input format
  IF input matches pattern 'IMPL-*': // Task ID Mode
    task_data = read_json_file(".task/" + input + ".json")
    IF task_data is not found:
      RAISE_ERROR("Task ID not found")
      RETURN

    // Infer patterns based on task type (e.g., "feature", "bugfix")
    type_patterns = get_patterns_for_task_type(task_data.type)
    collected_files += type_patterns
    collected_files += task_data.brainstorming_refs
  ELSE: // User Description Mode
    keywords = extract_tech_keywords(user_description)
    // Map keywords to file patterns (e.g., "React" -> "src/components/**/*.{jsx,tsx}")
    inferred_patterns = map_keywords_to_file_patterns(keywords)
    collected_files += inferred_patterns

  // The final collected files are used to construct the Gemini command
  // This corresponds to calling the allowed tool `Bash(gemini:*)`
  run_gemini_cli(collected_files, user_description)
END FUNCTION
```

### 🖐️ User Override Logic

Users can override or supplement the automatic inference.

```pseudo
FUNCTION calculate_final_patterns(description):
  inferred_patterns = get_inferred_patterns(description) // e.g., **/*auth*
  user_patterns = extract_user_patterns(description)     // e.g., @{custom/auth/helpers.js}

  // The final context is the union of inferred and user-specified patterns
  final_patterns = inferred_patterns + user_patterns
  RETURN final_patterns
END FUNCTION
```

### 🛠️ Gemini CLI Integration (Templated)

The following templates are used to call the `gemini` command via the `Bash` tool.

```bash
# User Description Mode
gemini --all-files --yolo -p "@{intelligently_inferred_file_patterns} @{CLAUDE.md,**/*CLAUDE.md}

Implementation Task: [user_description]

Based on intelligently inferred context, please provide:
- Specific implementation code
- File modification locations (file:line)
- Test cases
- Integration guidance"

# Task ID Mode
gemini --all-files --yolo -p "@{task_related_files} @{brainstorming_refs} @{CLAUDE.md,**/*CLAUDE.md}

Task Execution: [task_title] (ID: [task-id])
Task Description: [extracted_from_json]
Task Type: [feature/bugfix/refactor/etc]

Please execute implementation based on task definition:
- Follow task acceptance criteria
- Based on brainstorming analysis results
- Provide specific code and tests"
```

### 🔗 Workflow System Integration Logic

The command integrates deeply with the workflow system with auto-approval by default.

```pseudo
FUNCTION execute_with_workflow(task, flags):
  // All confirmation steps are automatically approved by default
  confirm_inferred_files = TRUE
  confirm_gemini_execution = TRUE
  confirm_file_modifications = TRUE

  // Execute the task with auto-approval
  execute_gemini_task(task)
  // Actions performed after successful execution
  generate_task_summary_doc()
  update_workflow_status_files() // Updates WFS & workflow-session.json
END FUNCTION
```

### 📄 Task Summary Template (Templated)

This template is automatically filled and generated after execution.

```markdown
# Task Summary: [Task-ID/Generated-ID] [Task Name/Description]

## Execution Content
- **Intelligently Inferred Files**: [inferred_file_patterns]
- **Gemini Analysis Results**: [key_findings]
- **Implemented Features**: [specific_implementation_content]
- **Modified Files**: [file:line references]

## Issues Resolved
- [list_of_resolved_problems]

## Links
- [🔙 Back to Task List](../TODO_LIST.md#[Task-ID])
- [📋 Implementation Plan](../IMPL_PLAN.md#[Task-ID])
```

### 🛡️ Error Handling Protocols

-   **Keyword Inference Failure**: `Use generic pattern 'src/**/*'` -> `Prompt user for manual specification`.
-   **Task ID Not Found**: `Display error message` -> `List available tasks`.
-   **File Pattern No Matches**: `Expand search scope` -> `Log debug info`.
-   **Gemini CLI Failure**: `Attempt fallback mode (e.g., --all-files -> @{patterns})` -> `Simplify context & retry`.

### ⚡ Performance Optimizations

-   **Caching**: Caches frequently used keyword-to-pattern mapping results.
-   **Pattern Optimization**: Avoids overly broad file patterns like `**/*` where possible.
-   **Progressive Inference**: Tries precise patterns (`src/api/auth`) before broader ones (`**/*auth*`).
-   **Path Navigation**: Switches to the optimal execution directory based on inference to shorten paths.

### 🤝 Integration & Coordination

-   **vs. `gemini-chat`**: `gemini-chat` is for pure analysis; `/gemini-execute` performs analysis **and** execution.
-   **vs. `code-developer`**: `code-developer` requires manual context provision; `/gemini-execute` infers context automatically.
-   **Typical Workflow Sequence**:
    1.  `workflow:session "..."`
    2.  `workflow:brainstorm`
    3.  `workflow:plan`
    4.  `/gemini-execute IMPL-001`
    5.  `workflow:review`

### 💾 Session Persistence

⚠️ **CRITICAL**: Before saving, MUST check for existing active session to avoid creating duplicate sessions.

-   **Trigger**: Activated by the `--save-session` flag.
-   **Action**: Saves the complete execution session, including inferred context, Gemini analysis, and implementation results.
-   **Session Check**: Check for `.workflow/.active-*` marker file to identify current active session. No file creation needed.
-   **Location Strategy**: 
    - **IF active session exists**: Save to existing `.workflow/WFS-[topic-slug]/.chat/` directory
    - **IF no active session**: Create new session directory following WFS naming convention

**Core Principles**: @~/.claude/workflows/core-principles.md  
**File Structure**: @~/.claude/workflows/file-structure-standards.md
-   **File Format**: `execute-YYYYMMDD-HHMMSS.md` with timestamp for unique identification.
-   **Structure**: Integrates with session management system using WFS-[topic-slug] format for consistency.
-   **Coordination**: Session files coordinate with workflow-session.json and maintain document-state separation.

### 🔗 Execution Session Integration

**Storage Structure:**
```
.workflow/WFS-[topic-slug]/.chat/
├── execute-20240307-143022.md   # Execution sessions with timestamps
├── execute-20240307-151445.md   # Chronologically ordered
└── analysis-[topic].md          # Referenced analysis sessions
```

**Execution Session Template:**
```markdown
# Execution Session: [Timestamp] - [Task/Description]

## Input
[Original user description or Task ID]

## Context Inference
[Intelligently inferred file patterns and rationale]

## Task Details (if Task ID mode)
[Extracted task data from .task/*.json]

## Gemini Execution
[Complete Gemini CLI command and parameters]

## Implementation Results
[Code generated, files modified, test cases]

## Key Outcomes
- [Files modified/created]
- [Features implemented]
- [Issues resolved]

## Integration Links
- [🔙 Workflow Session](../workflow-session.json)
- [📋 Implementation Plan](../IMPL_PLAN.md)
- [📝 Task Definitions](../.task/)
- [📑 Summary](../.summaries/)
```

### ✅ Quality Assurance Principles

-   **Inference Accuracy**: Keyword mapping tables are regularly updated based on project patterns and user feedback.
-   **Execution Reliability**: Implements robust error handling and leverages debug mode for detailed tracing.
-   **Documentation Completeness**: Ensures auto-generated summaries are structured and workflow statuses are synced in real-time.
### 📚 Related Documentation

