```markdown
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
    -   `{template}`: Template injection using `$(cat ~/.claude/workflows/gemini-templates/prompts/[category]/[template].txt)` for standardized analysis
    -   `@{pattern}`: A special syntax for referencing files and directories.

-   **Template Usage**:
    ```bash
    # Without template (manual prompt)
    gemini -p "@{src/**/*} @{CLAUDE.md} Analyze code patterns and conventions"
    
    # With template (recommended)
    gemini -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"
    
    # Multi-template composition
    gemini -p "@{src/**/*} @{CLAUDE.md} $(cat <<'EOF'
    $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/architecture.txt)
    
    Additional Security Focus:
    $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/security.txt)
    EOF
    )"
    ```

### 🔄 Execution Modes

-   **1. Directory-Scoped**: Navigate to a directory first, then run `gemini`.
    ```bash
    cd src/components && gemini --all-files -p "@{CLAUDE.md} Analyze component patterns"
    ```
-   **2. Pattern-Based**: Target files directly from any location using patterns.
    ```bash
    gemini -p "@{src/components/**/*} @{CLAUDE.md} Analyze component patterns"
    ```
-   **3. Template-Injected**: Use `$(cat)` to inject a predefined prompt template.
    ```bash
    gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"
    ```
-   **4. Parallel Execution**: Run multiple analyses concurrently for efficiency.
    ```bash
    (
      gemini -p "@{**/*auth*} @{CLAUDE.md} Auth patterns" &
      gemini -p "@{**/api/**/*} @{CLAUDE.md} API patterns" &
      wait
    )
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

### 🧠 Smart Pattern Discovery - Logic Flow

This feature automates the process of finding relevant files for analysis.

`Step 1: Analyze File Extensions` -> `Step 2: Generate Patterns` -> `Step 3: Execute Gemini`

```pseudo
FUNCTION analyze_and_run_gemini(analysis_type):
  // Step 1: Analyze the project's file types.
  // Corresponds to the `discover_extensions` shell function.
  discovered_extensions = analyze_project_extensions()
  log("Discovered extensions:", discovered_extensions)

  // Also identify the likely primary programming language.
  // Corresponds to the `detect_primary_language` shell function.
  primary_language = detect_main_language(discovered_extensions)
  log("Primary language:", primary_language)

  // Step 2: Generate file patterns based on the analysis type (e.g., "code", "config").
  // Corresponds to the `generate_patterns_by_extension` shell function.
  patterns = generate_patterns(analysis_type, discovered_extensions)
  log("Generated patterns:", patterns)

  // Step 3: Construct and execute the gemini command.
  // Always include project standards from CLAUDE.md.
  // Uses a pre-defined analysis template for consistency.
  command = "gemini -p \"" + patterns + " @{CLAUDE.md} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)\""
  execute_shell(command)

END FUNCTION
```

### 📜 Smart Discovery - Shell Implementation

These functions provide the concrete implementation for the smart discovery logic.

-   **Step 1: Analyze File Extensions & Language**
    ```bash
    # Discover actual file types in project
    discover_extensions() {
        echo "=== File Extension Analysis ==="
        find . -type f -name "*.*" 2>/dev/null | \
            sed 's/.*\.//' | \
            sort | uniq -c | sort -rn | \
            head -10
    }

    # Identify primary language
    detect_primary_language() {
        local extensions=$(find . -type f -name "*.*" 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn)
        if echo "$extensions" | grep -q "js\|jsx\|ts\|tsx"; then
            echo "JavaScript/TypeScript"
        elif echo "$extensions" | grep -q "py\|pyw"; then
            echo "Python"
        # ... other language checks ...
        else
            echo "Unknown/Mixed"
        fi
    }
    ```
-   **Step 2: Generate Patterns**
    ```bash
    # Generate patterns from discovered extensions
    generate_patterns_by_extension() {
        local analysis_type="$1"
        local top_exts=$(find . -type f -name "*.*" 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -5 | awk '{print $2}')
        local pattern=""
        case "$analysis_type" in
            "code")
                for ext in $top_exts; do
                    case $ext in
                        js|ts|jsx|tsx|py|java|go|rs|cpp|c|h)
                            pattern="${pattern}**/*.${ext},"
                            ;;
                    esac
                done
                echo "@{${pattern%,}}"
                ;;
            "config") echo "@{*.json,*.yml,*.yaml,*.toml,*.ini,*.env}" ;;
            "docs") echo "@{**/*.md,**/*.txt,**/README*}" ;;
            "all")
                for ext in $top_exts; do pattern="${pattern}**/*.${ext},"; done
                echo "@{${pattern%,}}"
                ;;
        esac
    }
    ```

### ⚡ Smart Discovery - Quick Commands

| Need | Command | Description |
|------|---------|-------------|
| Analyze Extensions | `discover_extensions` | View project file type distribution. |
| Code Files | `generate_patterns_by_extension "code"` | Generate patterns for source code files only. |
| Config Files | `generate_patterns_by_extension "config"` | Generate patterns for configuration files. |
| Docs | `generate_patterns_by_extension "docs"` | Generate patterns for documentation. |
| All Top Types | `generate_patterns_by_extension "all"` | Generate patterns for all discovered file types. |

###  TPL (Templates)

#### 🗂️ Template Directory Structure
This structure must be located at `~/.claude/workflows/gemini-templates/`.
```
~/.claude/workflows/gemini-templates/
├── prompts/
│   ├── analysis/       # Code analysis templates
│   │   ├── pattern.txt      # ✨ Implementation patterns & conventions
│   │   ├── architecture.txt # 🏗️ System architecture & dependencies
│   │   ├── security.txt     # 🔒 Security vulnerabilities & protection
│   │   ├── performance.txt  # ⚡ Performance bottlenecks & optimization
│   │   └── quality.txt      # 📊 Code quality & maintainability
│   ├── planning/       # Planning templates
│   │   ├── task-breakdown.txt # 📋 Task decomposition & dependencies
│   │   └── migration.txt      # 🚀 System migration & modernization
│   ├── implementation/ # Development templates
│   │   └── component.txt      # 🧩 Component design & implementation
│   ├── review/         # Review templates
│   │   └── code-review.txt    # ✅ Comprehensive review checklist
│   └── dms/           # DMS-specific
│       └── hierarchy-analysis.txt # 📚 Documentation structure optimization
└── commands/          # Command examples
```

#### 🧭 Template Selection Guide
| Task Type | Primary Template | Purpose |
|---|---|---|
| Understand Existing Code | `pattern.txt` | Codebase learning, onboarding. |
| Plan New Features | `task-breakdown.txt`| Feature development planning. |
| Security Review | `security.txt` | Security audits, vulnerability assessment. |
| Performance Tuning | `performance.txt` | Bottleneck investigation. |
| Code Quality Improvement | `quality.txt` | Refactoring, technical debt reduction. |
| System Modernization | `migration.txt` | Tech upgrades, architectural changes. |
| Component Development | `component.txt` | Building reusable components. |
| Pre-Release Review | `code-review.txt` | Release readiness checks. |


### 📦 Standard Command Structures

These are recommended command templates for common scenarios.

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
    gemini --all-files -p "@{target_patterns} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/gemini-templates/prompts/[category]/[template].txt)

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
    $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)

    Additional Security Focus:
    $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/security.txt)

    ## Analysis:
    1. [Point 1]
    2. [Point 2]

    ## Output:
    - File:line references
    - Code examples"
    "
    ```

### ⭐ Best Practices & Rules

-   **Mandatory Context**: Always include `@{CLAUDE.md,**/*CLAUDE.md}` to ground the analysis in project-specific standards.
-   **Specificity**: Use precise file patterns to reduce scope, improve performance, and increase accuracy.
-   **Performance**: Avoid overly broad patterns (`@{**/*}`) on large projects. Prefer directory-scoped execution or parallel chunks.
-   **Agent Integration**: All agent workflows **must** begin with a context analysis step using `gemini`.
    ```bash
    # Mandatory first step for any agent task
    gemini --all-files -p "@{relevant_patterns} @{CLAUDE.md} Context for: [task_description]"
    ```
-   **Error Handling**:
    -   Validate patterns match existing files before executing a long analysis.
    -   Quote paths that contain spaces or special characters.
    -   Test complex patterns on a small subset of files first.

