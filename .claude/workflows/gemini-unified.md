---
name: gemini-unified
description: Consolidated Gemini CLI guidelines - core rules, syntax, patterns, templates, and best practices
type: technical-guideline
---

### 🚀 Command Overview: `gemini`

-   **Purpose**: A CLI tool for comprehensive codebase analysis, context gathering, and pattern detection across multiple files.
-   **Primary Triggers**:
    -   When user intent is to "analyze", "get context", or "understand the codebase".
    -   When a task requires understanding relationships between multiple files.
    -   When the problem scope exceeds a single file.
-   **Core Use Cases**:
    -   Project-wide context acquisition.
    -   Architectural analysis and pattern detection.
    -   Identification of coding standards and conventions.

### ⚙️ Command Syntax & Arguments

-   **Basic Structure**:
    ```bash
    gemini [flags] -p "@{patterns} {template} prompt"
    ```
-   **Key Arguments**:
    -   `--all-files`: Includes all files in the current working directory.
    -   `-p`: The prompt string, which must contain file reference patterns and the analysis query.
    -   `{template}`: Template injection using `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)` for standardized analysis
    -   `@{pattern}`: A special syntax for referencing files and directories.

-   **Template Usage**:
    ```bash
    # Without template (manual prompt)
    gemini -p "@{src/**/*} @{CLAUDE.md} Analyze code patterns and conventions"
    
    # With template (recommended)
    gemini -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"
    
    # Multi-template composition
    gemini -p "@{src/**/*} @{CLAUDE.md} $(cat <<'EOF'
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt)
    
    Additional Security Focus:
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)
    EOF
    )"
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


###  TPL (Templates)

> **📋 Complete Template Reference**: See [Shared Template System](./shared-template-system.md) for comprehensive template directory structure, selection guide, and cross-tool compatibility details.

#### 🗂️ Template System Overview
Gemini uses a shared template system with Codex, located at `~/.claude/workflows/cli-templates/`. Templates are organized by primary use case:

- **`analysis/`** - Code analysis templates (Gemini primary)
- **`development/`** - Development templates (Codex primary, Gemini compatible) 
- **`planning/`** - Planning templates (Cross-tool)
- **`review/`** - Review templates (Cross-tool)

#### 🧭 Quick Template Selection (Gemini Focus)
| Task Type | Primary Template | Usage Pattern |
|---|---|---|
| Understand Existing Code | `analysis/pattern.txt` | Analysis & onboarding |
| Security Review | `analysis/security.txt` | Vulnerability assessment |
| Performance Analysis | `analysis/performance.txt` | Bottleneck investigation |
| Code Quality Assessment | `analysis/quality.txt` | Technical debt review |
| Architecture Review | `analysis/architecture.txt` | System design analysis |
| Plan New Features | `planning/task-breakdown.txt` | Development planning |

> **💡 Template Usage**: All templates work with both `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)` syntax and multi-template composition patterns.


### 📦 Standard Command Structures

These are recommended command templates for common scenarios.

-   **Module-Specific Analysis (Quick Module Analysis)**
    ```bash
    # Navigate to module directory for focused analysis
    cd src/auth && gemini --all-files -p "Analyze authentication module patterns and implementation"
    
    # Or specify module from root directory
    cd backend/services && gemini --all-files -p "Review service architecture and dependencies"
    
    # Template-enhanced module analysis (see shared-template-system.md for all available templates)
    cd frontend/components && gemini --all-files -p "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"
    ```

-   **Basic Structure (Manual Prompt)**
    ```bash
    gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md}

    Context: [Analysis type] targeting @{target_patterns}
    Guidelines: Include CLAUDE.md standards

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples"
    ```

-   **Template-Enhanced (Recommended)**
    ```bash
    # Using a predefined template for consistent, high-quality analysis
    gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples"
    "
    ```

-   **Multi-Template Composition**
    ```bash
    gemini -p "@{src/**/*} @{CLAUDE.md} 
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

    Additional Security Focus:
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples"
    "
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

