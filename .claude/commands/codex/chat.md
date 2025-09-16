---
name: chat

description: Simple Codex CLI interaction command for direct codebase analysis and development
usage: /codex:chat "inquiry"
argument-hint: "your question or development request"
examples:
  - /codex:chat "analyze the authentication flow"
  - /codex:chat "how can I optimize this React component performance?"
  - /codex:chat "implement user profile editing functionality"
allowed-tools: Bash(codex:*)
model: sonnet
---

### 🚀 **Command Overview: `/codex:chat`**

-   **Type**: Basic Codex CLI Wrapper
-   **Purpose**: Direct interaction with the `codex` CLI for simple codebase analysis and development
-   **Core Tool**: `Bash(codex:*)` - Executes the external Codex CLI tool

⚠️ **Critical Difference**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

### 📥 **Parameters & Usage**

-   **`<inquiry>` (Required)**: Your question or development request
-   **`@{patterns}` (Required)**: File patterns must be explicitly specified
-   **`--save-session` (Optional)**: Saves the interaction to current workflow session directory
-   **`--full-auto` (Optional)**: Enable autonomous development mode

### 🔄 **Execution Workflow**

`Parse Input` **->** `Infer File Patterns` **->** `Construct Prompt` **->** `Execute Codex CLI` **->** `(Optional) Save Session`

### 📚 **Context Assembly**

Context is gathered from:
1. **Project Guidelines**: Always includes `@{CLAUDE.md,**/*CLAUDE.md}`
2. **Inferred Patterns**: Auto-detects relevant files based on inquiry keywords
3. **Comprehensive Fallback**: Uses `@{**/*}` when pattern inference unclear

### 📝 **Prompt Format**

```
=== CONTEXT ===
@{CLAUDE.md,**/*CLAUDE.md} [Project guidelines]
@{inferred_patterns} [Auto-detected or comprehensive patterns]

=== USER INPUT ===
[The user inquiry text]
```

### ⚙️ **Execution Implementation**

```pseudo
FUNCTION execute_codex_chat(user_inquiry, flags):
  // Always include project guidelines
  patterns = "@{CLAUDE.md,**/*CLAUDE.md}"
  
  // Infer relevant file patterns from inquiry keywords
  inferred_patterns = infer_file_patterns(user_inquiry)
  IF inferred_patterns:
    patterns += "," + inferred_patterns
  ELSE:
    patterns += ",@{**/*}"  // Fallback to all files
  
  // Construct prompt
  prompt = "=== CONTEXT ===\n" + patterns + "\n"
  prompt += "\n=== USER INPUT ===\n" + user_inquiry
  
  // Execute codex CLI
  IF flags contain "--full-auto":
    result = execute_tool("Bash(codex:*)", "--full-auto", prompt)
  ELSE:
    result = execute_tool("Bash(codex:*)", "exec", prompt)
  
  // Save session if requested
  IF flags contain "--save-session":
    save_chat_session(user_inquiry, patterns, result)
  
  RETURN result
END FUNCTION
```

### 🎯 **Pattern Inference Logic**

**Auto-detects file patterns based on keywords:**

| Keywords | Inferred Pattern | Purpose |
|----------|-----------------|---------|
| "auth", "login", "user" | `@{**/*auth*,**/*user*}` | Authentication code |
| "React", "component" | `@{src/**/*.{jsx,tsx}}` | React components |
| "API", "endpoint", "route" | `@{**/api/**/*,**/routes/**/*}` | API code |
| "test", "spec" | `@{test/**/*,**/*.test.*,**/*.spec.*}` | Test files |
| "config", "setup" | `@{*.config.*,package.json}` | Configuration |
| "database", "db", "model" | `@{**/models/**/*,**/db/**/*}` | Database code |
| "style", "css" | `@{**/*.{css,scss,sass}}` | Styling files |

**Fallback**: If no keywords match, uses `@{**/*}` for comprehensive analysis.

### 💾 **Session Persistence**

When `--save-session` flag is used:
-   Check for existing active session (`.workflow/.active-*` markers)
-   Save to existing session's `.chat/` directory or create new session
-   File format: `chat-YYYYMMDD-HHMMSS.md`
-   Include query, context patterns, and response in saved file

**Session Template:**
```markdown
# Chat Session: [Timestamp]

## Query
[Original user inquiry]

## Context Patterns
[File patterns used in analysis]

## Codex Response
[Complete response from Codex CLI]

## Pattern Inference
[How file patterns were determined]
```

### 🔧 **Usage Examples**

#### Basic Development Chat
```bash
/codex:chat "implement password reset functionality"
# Executes: codex --full-auto exec "@{CLAUDE.md,**/*CLAUDE.md,**/*auth*,**/*user*} implement password reset functionality" -s danger-full-access
```

#### Architecture Discussion
```bash
/codex:chat "how should I structure the user management module?"
# Executes: codex --full-auto exec "@{CLAUDE.md,**/*CLAUDE.md,**/*user*,src/**/*} how should I structure the user management module?" -s danger-full-access
```

#### Performance Optimization
```bash
/codex:chat "optimize React component rendering performance"
# Executes: codex --full-auto exec "@{CLAUDE.md,**/*CLAUDE.md,src/**/*.{jsx,tsx}} optimize React component rendering performance" -s danger-full-access
```

#### Full Auto Mode
```bash
/codex:chat "create a complete user dashboard with charts" --full-auto
# Executes: codex --full-auto exec "@{CLAUDE.md,**/*CLAUDE.md,**/*user*,**/*dashboard*} create a complete user dashboard with charts" -s danger-full-access
```

### ⚠️ **Error Prevention**

-   **Pattern validation**: Ensures @ patterns match existing files
-   **Fallback patterns**: Uses comprehensive `@{**/*}` when inference fails
-   **Context verification**: Always includes project guidelines
-   **Session handling**: Graceful handling of missing workflow directories

### 📊 **Codex vs Gemini Chat**

| Feature | Codex Chat | Gemini Chat |
|---------|------------|-------------|
| File Loading | `@` patterns **required** | `--all-files` available |
| Pattern Inference | Automatic keyword-based | Manual or --all-files |
| Development Focus | Code generation & implementation | Analysis & exploration |
| Automation | `--full-auto` mode available | Interactive only |
| Command Structure | `codex exec "@{patterns}"` | `gemini --all-files -p` |

### 🚀 **Advanced Features**

#### Multi-Pattern Inference
```bash
/codex:chat "implement React authentication with API integration"
# Infers: @{CLAUDE.md,**/*CLAUDE.md,src/**/*.{jsx,tsx},**/*auth*,**/api/**/*}
```

#### Context-Aware Development
```bash
/codex:chat "add unit tests for the payment processing module"
# Infers: @{CLAUDE.md,**/*CLAUDE.md,**/*payment*,test/**/*,**/*.test.*}
```

#### Configuration Analysis
```bash
/codex:chat "review and optimize build configuration"
# Infers: @{CLAUDE.md,**/*CLAUDE.md,*.config.*,package.json,webpack.*,vite.*}
```

For detailed syntax, patterns, and advanced usage see:
**@~/.claude/workflows/tools-implementation-guide.md**