---
name: gemini-chat
parent: /gemini
description: Simple Gemini CLI interaction command for direct codebase analysis
usage: /gemini:chat "inquiry"
argument-hint: "your question or analysis request"
examples:
  - /gemini:chat "analyze the authentication flow"
  - /gemini:chat "how can I optimize this React component performance?"
  - /gemini:chat "review security vulnerabilities in src/auth/"
allowed-tools: Bash(gemini:*)
model: sonnet
---

### 🚀 **Command Overview: `/gemini:chat`**

-   **Type**: Basic Gemini CLI Wrapper
-   **Purpose**: Direct interaction with the `gemini` CLI for simple codebase analysis
-   **Core Tool**: `Bash(gemini:*)` - Executes the external Gemini CLI tool

### 📥 **Parameters & Usage**

-   **`<inquiry>` (Required)**: Your question or analysis request
-   **`--all-files` (Optional)**: Includes the entire codebase in the analysis context
-   **`--save-session` (Optional)**: Saves the interaction to current workflow session directory
-   **File References**: Specify files or patterns using `@{path/to/file}` syntax

### 🔄 **Execution Workflow**

`Parse Input` **->** `Assemble Context` **->** `Construct Prompt` **->** `Execute Gemini CLI` **->** `(Optional) Save Session`

### 📚 **Context Assembly**

Context is gathered from:
1. **Project Guidelines**: Always includes `@{CLAUDE.md,**/*CLAUDE.md}`
2. **User-Explicit Files**: Files specified by the user (e.g., `@{src/auth/*.js}`)
3. **All Files Flag**: The `--all-files` flag includes the entire codebase

### 📝 **Prompt Format**

```
=== CONTEXT ===
@{CLAUDE.md,**/*CLAUDE.md} [Project guidelines]
@{target_files} [User-specified files or all files if --all-files is used]

=== USER INPUT ===
[The user inquiry text]
```

### ⚙️ **Execution Implementation**

```pseudo
FUNCTION execute_gemini_chat(user_inquiry, flags):
  // Construct basic prompt
  prompt = "=== CONTEXT ===\n"
  prompt += "@{CLAUDE.md,**/*CLAUDE.md}\n"
  
  // Add user-specified files or all files
  IF flags contain "--all-files":
    result = execute_tool("Bash(gemini:*)", "--all-files", "-p", prompt + user_inquiry)
  ELSE:
    prompt += "\n=== USER INPUT ===\n" + user_inquiry
    result = execute_tool("Bash(gemini:*)", "-p", prompt)
  
  // Save session if requested
  IF flags contain "--save-session":
    save_chat_session(user_inquiry, result)
  
  RETURN result
END FUNCTION
```

### 💾 **Session Persistence**

When `--save-session` flag is used:
-   Check for existing active session (`.workflow/.active-*` markers)
-   Save to existing session's `.chat/` directory or create new session
-   File format: `chat-YYYYMMDD-HHMMSS.md`
-   Include query, context, and response in saved file

**Session Template:**
```markdown
# Chat Session: [Timestamp]

## Query
[Original user inquiry]

## Context
[Files and patterns included in analysis]

## Gemini Response
[Complete response from Gemini CLI]
```