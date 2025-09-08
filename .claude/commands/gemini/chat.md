---
name: gemini-chat
parent: /gemini
description: Single-execution Gemini CLI interaction command with dynamic template selection for codebase analysis
usage: /gemini:chat "inquiry"
argument-hint: "your question or analysis request"
examples:
  - /gemini:chat "analyze the authentication flow"
  - /gemini:chat "how can I optimize this React component performance?"
  - /gemini:chat "review security vulnerabilities in src/auth/"
  - /gemini:chat "comprehensive code quality assessment"
allowed-tools: Bash(gemini:*), Bash(~/.claude/scripts/chat-template-load.sh:*)
model: sonnet
---

### 🚀 **Command Overview: `/gemini:chat`**


-   **Type**: Gemini CLI Execution Wrapper
-   **Purpose**: To provide direct interaction with the `gemini` CLI, enhanced with intelligent, dynamic prompt template selection for codebase analysis.
-   **Core Tools**:
    -   `Bash(gemini:*)`: Executes the external Gemini CLI tool.
    -   `Bash(~/.claude/scripts/chat-template-load.sh:*)`: Manages all template discovery and selection logic.

### 📥 **Parameters & Usage**

-   **`<inquiry>` (Required)**: Your primary question or analysis request.
-   **`--all-files` (Optional)**: Includes the entire codebase in the analysis context.
-   **`--compress` (Optional)**: Applies context compression for large prompts.
-   **`--save-session` (Optional)**: Saves the full interaction to current workflow session directory.
-   **File References**: Explicitly specify files or patterns within the inquiry using `@{path/to/file}`.

### 🔄 **Core Execution Workflow**

⚠️ **IMPORTANT**: Template selection is **AUTOMATIC** based on input analysis and is the **FIRST STEP** in command execution.

`Parse Input & Intent` **->** `Auto-Select Template` **->** `Load Selected Template` **->** `Determine Context Needs` **->** `Assemble Context` **->** `Construct Prompt` **->** `Execute Gemini CLI` **->** `(Optional) Save Session`

### 🧠 **Template Selection Logic**

⚠️ **CRITICAL**: Templates are selected **AUTOMATICALLY** by analyzing user input. The command execution calls script methods to discover and select the best template.

**Script Methods Available:**
- `~/.claude/scripts/chat-template-load.sh list` - Lists all available templates
- `~/.claude/scripts/chat-template-load.sh load "template_name"` - Loads a specific template

```pseudo
FUNCTION automatic_template_selection(user_inquiry):
  // STEP 1: Command execution calls list method to discover templates
  available_templates = call_script_method("list")
  
  // STEP 2: Analyze user input to determine best template match
  analyzed_intent = analyze_input_keywords_and_context(user_inquiry)
  best_template = match_template_to_intent(analyzed_intent, available_templates)

  // STEP 3: Command execution calls load method with selected template
  IF best_template is FOUND:
    template_content = call_script_method("load", best_template.name)
    log_info("Auto-selected template: " + best_template.name)
  ELSE:
    // Fallback to default template if no clear match
    template_content = call_script_method("load", "default")
    log_warning("No clear template match, using default template")

  RETURN template_content
END FUNCTION
```

**Automatic Selection Flow:**
1. **Command starts** → Calls `list` method to discover available templates
2. **Input analysis** → Analyzes user inquiry for keywords, intent, and context
3. **Template matching** → Automatically selects best template based on analysis
4. **Template loading** → Command calls `load` method with selected template name
5. **Continue execution** → Process the inquiry with loaded template

### 📚 **Context Assembly Priority**

Context is gathered based on a clear hierarchy of sources.

1.  **Template Requirements**: The primary driver. The selected template defines a default set of required file patterns.
2.  **User-Explicit Files**: Files specified by the user (e.g., `@{src/auth/*.js}`) override or add to the template's requirements.
3.  **Command-Level Flags**: The `--all-files` flag overrides all other file specifications to scope the context to the entire project.

### 📝 **Structured Prompt Format**

The final prompt sent to the `gemini` CLI is assembled in three distinct parts.

```
=== SYSTEM PROMPT ===
[Content from the selected template file is placed here]

=== CONTEXT ===
@{CLAUDE.md,**/*CLAUDE.md} [Project guidelines, always included]
@{target_files} [File context gathered based on the assembly priority]

=== USER INPUT ===
[The original user inquiry text]
```

### ⚙️ **Gemini CLI Execution Logic**

This describes how the external `gemini` binary is invoked with the constructed prompt.

```pseudo
FUNCTION execute_gemini_cli(structured_prompt, flags):
  // Retrieves the path from the user's execution environment.
  current_directory = get_current_working_directory()

  IF flags contain "--all-files":
    // For --all-files, it may be necessary to navigate to the correct directory first.
    navigate_to_project_root(current_directory)
    // Executes the gemini tool using the --all-files flag.
    result = execute_tool("Bash(gemini:*)", "--all-files", "-p", structured_prompt)
  ELSE:
    // Default execution relies on @{file_patterns} resolved by the Gemini CLI.
    // The prompt already contains the necessary @{...} references.
    result = execute_tool("Bash(gemini:*)", "-p", structured_prompt)

  IF result is 'FAILED' AND flags contain "--all-files":
    // Implements the fallback strategy if --all-files fails.
    log_warning("`--all-files` failed. Falling back to pattern-based context.")
    prompt_with_fallback = add_file_patterns_to_prompt(structured_prompt)
    result = execute_tool("Bash(gemini:*)", "-p", prompt_with_fallback)

  RETURN result
END FUNCTION
```

### 💾 **Session Persistence**

⚠️ **CRITICAL**: Before saving, MUST check for existing active session to avoid creating duplicate sessions.

-   **Trigger**: Activated by the `--save-session` flag.
-   **Action**: Saves the complete interaction, including the template used, context, and Gemini's output.
-   **Session Check**: Check for `.workflow/.active-*` marker file to identify current active session. No file creation needed.
-   **Location Strategy**: 
    - **IF active session exists**: Save to existing `.workflow/WFS-[topic-slug]/.chat/` directory
    - **IF no active session**: Create new session directory following WFS naming convention

**File Structure**: @~/.claude/workflows/file-structure-standards.md
-   **File Format**: `chat-YYYYMMDD-HHMMSS.md` with timestamp for unique identification.
-   **Structure**: Integrates with session management system using WFS-[topic-slug] format for consistency.
-   **Coordination**: Session files coordinate with workflow-session.json and maintain document-state separation.

### 🔗 **Chat Session Integration**

**Session Detection Workflow:**
```pseudo
FUNCTION determine_save_location():
  // STEP 1: Check for active session marker
  active_marker = find_file(".workflow/.active-*")
  
  // STEP 2: Extract session name if marker exists
  active_session_name = extract_session_name(active_marker)
  
  IF active_sessions.count > 0:
    // Use existing active session directory
    session_dir = active_sessions[0].session_path + "/.chat/"
    ensure_directory_exists(session_dir)
    RETURN session_dir
  ELSE:
    // No active session - create new one only if necessary
    new_session_slug = generate_topic_slug(user_inquiry)
    session_dir = ".workflow/WFS-" + new_session_slug + "/.chat/"
    create_session_structure(session_dir)
    RETURN session_dir
END FUNCTION
```

**Storage Structure:**
```
.workflow/WFS-[topic-slug]/.chat/
├── chat-20240307-143022.md      # Individual chat sessions
├── chat-20240307-151445.md      # Timestamped for chronological order
└── analysis-security.md         # Named analysis sessions
```

**Session Template:**
```markdown
# Chat Session: [Timestamp] - [Topic]

## Query
[Original user inquiry]

## Template Used  
[Auto-selected template name and rationale]

## Context
[Files and patterns included in analysis]

## Gemini Response
[Complete response from Gemini CLI]

## Key Insights
- [Important findings]
- [Architectural insights] 
- [Implementation recommendations]

## Integration Links
- [🔙 Workflow Session](../workflow-session.json)
- [📋 Implementation Plan](../IMPL_PLAN.md)
- [📝 Task Definitions](../.task/)
```