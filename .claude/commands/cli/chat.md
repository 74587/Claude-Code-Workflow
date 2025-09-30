---
name: chat

description: Simple CLI interaction command for direct codebase analysis
usage: /cli:chat [--tool <codex|gemini|qwen>] [--enhance] "inquiry"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] inquiry"
examples:
  - /cli:chat "analyze the authentication flow"
  - /cli:chat --tool qwen --enhance "optimize React component"
  - /cli:chat --tool codex "review security vulnerabilities"
allowed-tools: SlashCommand(*), Bash(*)
model: sonnet
---

### 🚀 **Command Overview: `/cli:chat`**

-   **Type**: CLI Tool Wrapper for Interactive Analysis
-   **Purpose**: Direct interaction with CLI tools for codebase analysis
-   **Supported Tools**: codex, gemini (default), qwen

### 📥 **Parameters & Usage**

-   **`<inquiry>` (Required)**: Your question or analysis request
-   **`--tool <codex|gemini|qwen>` (Optional)**: Select CLI tool (default: gemini)
-   **`--enhance` (Optional)**: Enhance inquiry with `/enhance-prompt` before execution
-   **`--all-files` (Optional)**: Includes the entire codebase in the analysis context
-   **`--save-session` (Optional)**: Saves the interaction to current workflow session directory
-   **File References**: Specify files or patterns using `@{path/to/file}` syntax

### 🔄 **Execution Workflow**

`Parse Tool` **->** `Parse Input` **->** `[Optional] Enhance` **->** `Assemble Context` **->** `Construct Prompt` **->** `Execute CLI Tool` **->** `(Optional) Save Session`

### 🛠️ **Tool Selection**

| Tool | Best For | Wrapper |
|------|----------|---------|
| **gemini** (default) | General analysis, exploration | `~/.claude/scripts/gemini-wrapper` |
| **qwen** | Architecture, design patterns | `~/.claude/scripts/qwen-wrapper` |
| **codex** | Development queries, deep analysis | `codex --full-auto exec` |

### 🔄 **Original Execution Workflow**

`Parse Input` **->** `[Optional] Enhance` **->** `Assemble Context` **->** `Construct Prompt` **->** `Execute Gemini CLI` **->** `(Optional) Save Session`

### 🎯 **Enhancement Integration**

**When `--enhance` flag present**:
```bash
# Step 1: Enhance the inquiry
SlashCommand(command="/enhance-prompt \"[inquiry]\"")

# Step 2: Use enhanced output for chat
# Enhanced output provides enriched context and structured intent
```

**Example**:
```bash
# User: /gemini:chat --enhance "fix the login"

# Step 1: Enhance
/enhance-prompt "fix the login"
# Returns:
# INTENT: Debug login authentication failure
# CONTEXT: JWT auth in src/auth/, session state issue
# ACTION: Check token validation → verify middleware → test flow

# Step 2: Chat with enhanced context
gemini -p "Debug login authentication failure. Focus on JWT token validation
in src/auth/, verify middleware integration, and test authentication flow.
Known issue: session state management"
```

### 📚 **Context Assembly**

Context is gathered from:
1. **Project Guidelines**: Always includes `@{CLAUDE.md,**/*CLAUDE.md}`
2. **User-Explicit Files**: Files specified by the user (e.g., `@{src/auth/*.js}`)
3. **All Files Flag**: The `--all-files` flag includes the entire codebase

### 📝 **Prompt Format**

**Core Guidelines**: @~/.claude/workflows/intelligent-tools-strategy.md

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [clear analysis/inquiry goal]
TASK: [specific analysis or question]
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} @{target_files}
EXPECTED: [expected response format]
RULES: [constraints or focus areas]
"
```

### ⚙️ **Execution Implementation**

**Standard Template**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [user inquiry goal]
TASK: [specific question or analysis]
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} @{inferred_or_specified_files}
EXPECTED: Analysis with file references and code examples
RULES: [focus areas based on inquiry]
"
```

**With --all-files flag**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [user inquiry goal]
TASK: [specific question or analysis]
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase]
EXPECTED: Comprehensive analysis across all files
RULES: [focus areas based on inquiry]
"
```

**Example - Authentication Analysis**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand authentication flow implementation
TASK: Analyze authentication flow and identify patterns
CONTEXT: @{**/*auth*,**/*login*} @{CLAUDE.md}
EXPECTED: Flow diagram, security assessment, integration points
RULES: Focus on security patterns and JWT handling
"
```

**Example - Performance Optimization**:
```bash
cd src/components && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Optimize React component performance
TASK: Identify performance bottlenecks in component rendering
CONTEXT: @{**/*.{jsx,tsx}} @{CLAUDE.md}
EXPECTED: Specific optimization recommendations with file:line references
RULES: Focus on re-render patterns and memoization opportunities
"
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