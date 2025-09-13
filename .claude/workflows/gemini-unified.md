---
name: gemini-unified
description: Consolidated Gemini CLI guidelines - core rules, syntax, patterns, templates, and best practices
type: technical-guideline
---

### 🚀 Command Overview: `gemini`

-   **Purpose**: A CLI tool for comprehensive codebase analysis, context gathering, and pattern detection across multiple files.
-   **Directory Analysis Rule**: When user intends to analyze specific directory (cd XXX), always navigate first: `cd XXX && gemini  -p "prompt"`
-   **Primary Triggers**:
    -   When user intent is to "analyze", "get context", or "understand the codebase".
    -   When a task requires understanding relationships between multiple files.
    -   When the problem scope exceeds a single file.
-   **Core Use Cases**:
    -   Project-wide context acquisition.
    -   Architectural analysis and pattern detection.
    -   Identification of coding standards and conventions.

## ⭐ **RECOMMENDED: Use `gemini-wrapper` as Primary Method**

> **🎯 Core Recommendation**: Always use `gemini-wrapper` instead of direct `gemini` commands. This intelligent wrapper handles token limits, approval modes, and error management automatically.

### 🎯 Intelligent Wrapper: `gemini-wrapper` (PRIMARY METHOD)

-   **Purpose**: Smart wrapper that automatically manages `--all-files` flag and approval modes based on project analysis
-   **Location**: `~/.claude/scripts/gemini-wrapper` (auto-installed)
-   **Token Threshold**: 2,000,000 tokens (configurable via `GEMINI_TOKEN_LIMIT`)
-   **Auto-Management Features**:
    -   **Token-based `--all-files`**: Small projects get `--all-files`, large projects use patterns
    -   **Smart approval modes**: Analysis tasks use `default`, execution tasks use `yolo`
    -   **Error logging**: Captures and logs execution errors to `~/.claude/.logs/gemini-errors.log`
-   **Task Detection**:
    -   **Analysis keywords**: "analyze", "analysis", "review", "understand", "inspect", "examine" → `--approval-mode default`
    -   **All other tasks**: → `--approval-mode yolo`
-   **Usage**: Use full path `~/.claude/scripts/gemini-wrapper` - all parameters pass through unchanged
-   **Benefits**: Prevents token limits, optimizes approval workflow, provides error tracking
-   **Setup**: Script auto-installs to `~/.claude/scripts/` location

**⚡ Quick Start Examples:**
```bash
# RECOMMENDED: Let wrapper handle everything automatically
bash(~/.claude/scripts/gemini-wrapper -p "Analyze authentication patterns")

# Analysis task - wrapper auto-detects and uses --approval-mode default
bash(~/.claude/scripts/gemini-wrapper -p "Review code quality and conventions")

# Development task - wrapper auto-detects and uses --approval-mode yolo  
bash(~/.claude/scripts/gemini-wrapper -p "Implement user dashboard feature")

# Directory-specific analysis
bash(cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Analyze module patterns")
```

### ⚙️ Command Syntax & Arguments

-   **Basic Structure**:
    ```bash
    gemini [flags] -p "@{patterns} {template} prompt"
    ```
-   **Key Arguments**:
    -   `--all-files`: Includes all files in the current working directory
    -   `-p`: The prompt string, which must contain file reference patterns and the analysis query.
    -   `{template}`: Template injection using `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)` for standardized analysis
    -   `@{pattern}`: A special syntax for referencing files and directories.
    -   `--approval-mode`: Tool approval mode (`default` for analysis | `yolo` for execution)
    -   `--include-directories`: Additional workspace directories (max 5, comma-separated)

-   **Template Usage**:
    ```bash
    # Without template (manual prompt)
    bash(gemini --all-files -p "@{src/**/*} @{CLAUDE.md} Analyze code patterns and conventions")
    
    # With template (recommended)
    bash(gemini --all-files -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)")
    
    # Multi-template composition
    bash(gemini --all-files -p "@{src/**/*} @{CLAUDE.md} $(cat <<'EOF'
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt)
    
    Additional Security Focus:
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)
    EOF
    )")
    ```


### 📂 File Pattern Rules

-   **Syntax**:
    -   `@{pattern}`: Single file or directory pattern.
    -   `@{pattern1,pattern2}`: Multiple patterns, comma-separated.
-   **Wildcards**:
    ```bash
    *         # Any character (excluding path separators)
    **        # Any directory levels (recursive)
    ?         # Any single character
    [abc]     # Any character within the brackets
    {a,b,c}   # Any of the options within the braces
    ```
-   **Cross-Platform Rules**:
    -   Always use forward slashes (`/`) for paths.
    -   Enclose paths with spaces in quotes: `@{"My Project/src/**/*"}`.
    -   Escape special characters like brackets: `@{src/**/*\[bracket\]*}`.

### ⏱️ Execution Settings

-   **Default Timeout**: Bash command execution extended to **10 minutes** to handle large codebase analysis.
-   **Token Limit Handling**: When `--all-files` exceeds token limits, **remove `--all-files` and re-execute** with specific `@{patterns}` to target relevant files only.


###  📁 Templates

**Structure**: `~/.claude/workflows/cli-templates/prompts/`

**Categories**:
- `analysis/` - pattern.txt, architecture.txt, security.txt, performance.txt, quality.txt (Gemini primary)
- `development/` - feature.txt, component.txt, refactor.txt, testing.txt, debugging.txt (Codex primary)
- `planning/` - task-breakdown.txt, migration.txt (Cross-tool)
- `review/` - code-review.txt (Cross-tool)

**Usage**: `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)`


### 📦 Standard Command Structures

> **⚠️ IMPORTANT**: Use `gemini-wrapper` for 90% of all tasks. Only use direct `gemini` commands when you need explicit manual control.

#### 🎯 Using Intelligent Wrapper (PRIMARY CHOICE - 90% of tasks)

-   **Automatic Token & Approval Management**
    ```bash
    # Analysis task - auto adds --approval-mode default
    bash(~/.claude/scripts/gemini-wrapper -p "Analyze authentication module patterns and implementation")
    
    # Execution task - auto adds --approval-mode yolo  
    bash(~/.claude/scripts/gemini-wrapper -p "Implement user login feature with JWT tokens")
    
    # Navigate to specific directory with wrapper
    bash(cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Review authentication patterns")
    
    # Override token threshold if needed
    bash(GEMINI_TOKEN_LIMIT=500000 ~/.claude/scripts/gemini-wrapper -p "Custom threshold analysis")
    
    # Multi-directory support with wrapper
    bash(~/.claude/scripts/gemini-wrapper --include-directories /path/to/other/project -p "Cross-project analysis")
    ```

-   **Module-Specific Analysis (Quick Module Analysis)**
    ```bash
    # Navigate to module directory for focused analysis
    bash(cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Analyze authentication module patterns and implementation")
    
    # Or specify module from root directory
    bash(cd backend/services && ~/.claude/scripts/gemini-wrapper -p "Review service architecture and dependencies")
    
    # Template-enhanced module analysis with wrapper
    bash(cd frontend/components && ~/.claude/scripts/gemini-wrapper -p "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)")
    ```

#### 📝 Direct Gemini Usage (Manual Control - Use Only When Needed)

-   **Manual Token Management**
    ```bash
    # Direct gemini usage when you want explicit control
    bash(gemini --all-files -p "Analyze authentication module patterns and implementation")
    
    # Fallback when wrapper suggests pattern usage
    bash(gemini -p "@{src/auth/**/*} @{CLAUDE.md} Analyze authentication patterns")
    ```

-   **Basic Structure (Manual Prompt)**
    ```bash
    bash(gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md}

    Context: [Analysis type] targeting @{target_patterns}
    Guidelines: Include CLAUDE.md standards

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples")
    ```

-   **Template-Enhanced (Recommended)**
    ```bash
    # Using a predefined template for consistent, high-quality analysis
    bash(gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples")
    ```

-   **Multi-Template Composition**
    ```bash
    bash(gemini --all-files -p "@{src/**/*} @{CLAUDE.md} 
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

    Additional Security Focus:
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples")
    ```

-   **Token Limit Fallback**
    ```bash
    # If --all-files exceeds token limits, immediately retry with targeted patterns:
    
    # Original command that failed:
    bash(gemini --all-files -p "Analyze authentication patterns")
    
    # Fallback with specific patterns:
    bash(gemini -p "@{src/auth/**/*} @{src/middleware/**/*} @{CLAUDE.md} Analyze authentication patterns")
    
    # Or focus on specific file types:
    bash(gemini -p "@{**/*.ts} @{**/*.js} @{CLAUDE.md} Analyze authentication patterns")
    ```

### ⭐ Best Practices & Rules


**When to Use @ Patterns:**
1. **User explicitly provides @ patterns** - ALWAYS preserve them exactly
2. **Cross-directory analysis** - When analyzing relationships between modules
3. **Configuration files** - When analyzing scattered config files
4. **Selective inclusion** - When you only need specific file types

**CLAUDE.md Loading Rules:**
- **With --all-files**: CLAUDE.md files automatically included (no @ needed)
- **Without --all-files**: Must use `@{CLAUDE.md}` or `@{**/CLAUDE.md}`


#### ⚠️ Error Prevention

-   **Quote paths with spaces**: Use proper shell quoting
-   **Test patterns first**: Validate @ patterns match existing files  
-   **Prefer directory navigation**: Reduces complexity and improves performance
-   **Preserve user patterns**: When user provides @, always keep them
-   **Handle token limits**: If `--all-files` fails due to token limits, immediately retry without `--all-files` using targeted `@{patterns}`

