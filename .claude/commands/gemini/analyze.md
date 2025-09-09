---
name: analyze

description: Advanced Gemini CLI analysis with template-driven pattern detection and comprehensive codebase insights
usage: /gemini:analyze <target>
argument-hint: "analysis target or description"
examples:
  - /gemini:analyze "Find all React hooks usage patterns"
  - /gemini:analyze "Analyze component hierarchy and structure"
  - /gemini:analyze "Scan for authentication vulnerabilities"
  - /gemini:analyze "Trace user login implementation"
  - /gemini:analyze "Identify potential bottlenecks"
  - /gemini:analyze "Find all API endpoints"
model: haiku
---

### 🚀 Command Overview: `/gemini:analyze`


-   **Purpose**: To perform advanced, template-driven analysis on a codebase for various insights like patterns, architecture, and security.
-   **Core Principle**: Leverages intelligent context detection to apply optimized analysis templates.

### 🔄 High-Level Execution Flow

`User Input` **->** `Intelligent Context Detection` **->** `Template-Based Analysis`

### 🎯 Analysis Types

| Type           | Purpose                          | Example Usage                               |
| :------------- | :------------------------------- | :------------------------------------------ |
| **pattern**      | Code pattern detection           | `/gemini-mode pattern "React hooks usage"`  |
| **architecture** | System structure analysis        | `/gemini-mode architecture "component hierarchy"` |
| **security**     | Security vulnerabilities         | `/gemini-mode security "auth vulnerabilities"` |
| **performance**  | Performance bottlenecks          | `/gemini-mode performance "rendering issues"` |
| **feature**      | Feature implementation tracing   | `/gemini-mode feature "user authentication"`|
| **quality**      | Code quality assessment          | `/gemini-mode quality "testing coverage"`   |
| **dependencies** | Third-party dependencies         | `/gemini-mode dependencies "outdated packages"` |
| **migration**    | Legacy modernization             | `/gemini-mode migration "React class to hooks"` |
| **custom**       | Custom analysis                  | `/gemini-mode custom "find user data processing"` |

### ⚙️ Command Options

| Option           | Purpose                               |
| :--------------- | :------------------------------------ |
| `--yolo`         | Auto-approve analysis (non-interactive mode). |
| `--debug`        | Enable debug mode for verbose logging. |
| `--interactive`  | Start an interactive session for follow-up questions. |
| `--model <name>` | Specify which Gemini model to use.    |
| `--sandbox`      | Run the analysis in a secure sandbox environment. |

### 📚 Template System

The command's intelligence is powered by a set of predefined templates for different analysis categories.

| Template Category     | Purpose                             | Source Reference                                  |
| :-------------------- | :---------------------------------- | :------------------------------------------------ |
| **Core Analysis**     | Pattern, architecture, security, etc. | `@~/.claude/workflows/gemini-core-templates.md`     |
| **DMS Operations**    | Documentation management            | `@~/.claude/workflows/gemini-dms-templates.md`    |
| **Agent Workflows**   | Agent-specific templates            | `@~/.claude/workflows/gemini-agent-templates.md`  |
| **Intelligent Context** | Smart targeting & detection logic   | `@~/.claude/workflows/gemini-intelligent-context.md` |

### 🧠 Smart File Targeting Logic

The command automatically determines which files to analyze based on context.

```pseudo
FUNCTION determine_target_files(analysis_type, keywords):
  // 1. Detect technology stack (e.g., React, Python)
  tech_stack = detect_project_tech()
  file_extensions = get_extensions_for(tech_stack) // e.g., {js,ts,jsx} for React

  // 2. Generate patterns based on keywords
  // Corresponds to: Keywords: "auth" -> auth files, "api" -> API files
  IF "auth" in keywords:
    add_pattern("@{**/auth/**/*,**/user/**/*}")
  ELSE IF "api" in keywords:
    add_pattern("@{api/**/*,routes/**/*,controllers/**/*}")

  // 3. Generate patterns based on analysis type
  // Corresponds to: Analysis type: Security -> auth/security files
  CASE analysis_type:
    WHEN "security":
      add_pattern("@{**/auth/**/*,**/security/**/*}")
    WHEN "architecture":
      add_pattern("@{src/**/*,app/**/*,lib/**/*}")

  // 4. Inject standard relevant context
  add_pattern("@{CLAUDE.md,**/*CLAUDE.md}")

  RETURN combined_patterns
END FUNCTION
```

### 📂 File Reference Syntax Guide

```
# Basic @ Syntax
@{file}                # Single file
@{dir/*}               # All files in directory
@{dir/**/*}            # All files recursively
@{*.ext}               # Files by extension
@{**/*.ext}            # Files by extension recursively

# Advanced Patterns
@{file1,file2,file3}            # Multiple specific files
@{dir1/**/*,dir2/**/*}            # Multiple directories
@{**/*.{js,ts,jsx,tsx}}        # Multiple extensions
@{**/[module]/**/*}               # Pattern matching

# Context-Specific Targeting
# Frontend components
@{src/components/**/*,src/ui/**/*,src/views/**/*}

# Backend APIs
@{api/**/*,routes/**/*,controllers/**/*,middleware/**/*}

# Configuration files
@{*.config.js,*.json,.env*,config/**/*}

# Test files
@{**/*.test.*,**/*.spec.*,test/**/*,spec/**/*}

# Documentation and guidelines
@{*.md,docs/**/*,CLAUDE.md,**/*CLAUDE.md}
```

### 🔗 Workflow Integration Patterns

⚠️ **CRITICAL**: Before analysis, MUST check for existing active session to ensure proper workflow context and documentation storage.

**Session Check Process:**
1. **Check Active Session**: Check for `.workflow/.active-*` marker file to identify active session. No file creation needed.
2. **Context Integration**: Use existing active session for proper analysis context
3. **Documentation Strategy**: Store analysis results in appropriate session directory structure

-   **Planning Phase**:
    `Check Active Session` **->** `Run /gemini-mode architecture` **->** `Run /gemini-mode pattern` **->** `Feed results into Task(planning-agent, ...)`
-   **Code Review**:
    `Check Active Session` **->** `Run /gemini-mode security "auth"` **->** `Run /gemini-mode performance "rendering"` **->** `Summarize findings for PR comments`
-   **Research & Discovery**:
    `Check Active Session` **->** `Run /gemini-mode architecture "overview"` **->** `Run /gemini-mode dependencies "key libraries"` **->** `Document for new team members`

### 🛠️ Task Tool Integration Example

Integrate `/gemini-mode` directly into automated tasks for analysis-driven actions.

```python
Task(subagent_type="general-purpose", prompt="""
Use /gemini-mode pattern "auth patterns" to analyze authentication.
Summarize findings for implementation planning.
""")
```

### 👍 Best Practices

-   **Scope**: Use specific, focused targets for faster, more accurate results.
-   **Chaining**: Combine analysis types (`architecture` then `pattern`) for a comprehensive view.
-   **Interpretation**: Use Gemini's raw output as input for Claude to interpret, summarize, and act upon.
-   **Performance**: Use `--yolo` for non-destructive analysis to skip confirmations. Be mindful that analyzing all files may be slow on large projects.

### 📋 Common Use Cases

| Use Case               | Recommended Commands                                                                  |
| :--------------------- | :------------------------------------------------------------------------------------ |
| **Project Onboarding**   | `/gemini-mode architecture "overview"`, `/gemini-mode dependencies "key tech"`          |
| **Security Audit**       | `/gemini-mode security "auth vulnerabilities"`, `/gemini-mode security "XSS"`       |
| **Performance Review**   | `/gemini-mode performance "bottlenecks"`, `/gemini-mode performance "optimization"` |
| **Migration Planning**   | `/gemini-mode migration "legacy patterns"`, `/gemini-mode migration "modernization"`|
| **Feature Research**     | `/gemini-mode feature "existing system"`, `/gemini-mode pattern "approaches"`         |

### 🆘 Troubleshooting

| Issue                  | Solution                                            |
| :--------------------- | :-------------------------------------------------- |
| **Analysis timeout**     | Use `--debug` to monitor progress and identify slow steps. |
| **Context limits**     | Break the analysis into smaller, more focused scopes. |
| **Permission errors**  | Ensure the CLI has read access to the target files.   |
| **Complex analysis**   | Use `--interactive` mode to ask follow-up questions. |

