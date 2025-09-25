---
name: chat

description: Simple qwen CLI interaction command for direct codebase analysis
usage: /qwen:chat "inquiry"
argument-hint: "your question or analysis request"
examples:
  - /qwen:chat "analyze the authentication flow"
  - /qwen:chat "how can I optimize this React component performance?"
  - /qwen:chat "review security vulnerabilities in src/auth/"
allowed-tools: Bash(qwen:*)
model: sonnet
---

### 🚀 **Command Overview: `/qwen:chat`**

-   **Type**: Basic qwen CLI Wrapper
-   **Purpose**: Direct interaction with the `qwen` CLI for simple codebase analysis
-   **Core Tool**: `Bash(qwen:*)` - Executes the external qwen CLI tool

### 📥 **Parameters & Usage**

-   **`<inquiry>` (Required)**: Your question or analysis request
-   **`--all-files` (Optional)**: Includes the entire codebase in the analysis context
-   **`--save-session` (Optional)**: Saves the interaction to current workflow session directory
-   **File References**: Specify files or patterns using `@{path/to/file}` syntax

### 🔄 **Execution Workflow**

`Parse Input` **->** `Assemble Context` **->** `Construct Prompt` **->** `Execute qwen CLI` **->** `(Optional) Save Session`

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
FUNCTION execute_qwen_chat(user_inquiry, flags):
  // Construct basic prompt
  prompt = "=== CONTEXT ===\n"
  prompt += "@{CLAUDE.md,**/*CLAUDE.md}\n"
  
  // Add user-specified files or all files
  IF flags contain "--all-files":
    result = execute_tool("Bash(qwen:*)", "--all-files", "-p", prompt + user_inquiry)
  ELSE:
    prompt += "\n=== USER INPUT ===\n" + user_inquiry
    result = execute_tool("Bash(qwen:*)", "-p", prompt)
  
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

## qwen Response
[Complete response from qwen CLI]
```