#!/bin/bash
# Update CLAUDE.md for a specific module with unified template
# Usage: update_module_claude.sh <module_path> [tool] [model]
#   module_path: Path to the module directory
#   tool: gemini|qwen|codex (default: gemini)
#   model: Model name (optional, uses tool defaults if not specified)
#
# Default Models:
#   gemini: gemini-2.5-flash
#   qwen: coder-model (default, -m optional)
#   codex: gpt5-codex
#
# Features:
# - Respects .gitignore patterns (current directory or git root)
# - Unified template for all modules (folders and files)
# - Template-based documentation generation
# - Configurable model selection per tool

# Build exclusion filters from .gitignore
build_exclusion_filters() {
    local filters=""

    # Common system/cache directories to exclude
    local system_excludes=(
        ".git" "__pycache__" "node_modules" ".venv" "venv" "env"
        "dist" "build" ".cache" ".pytest_cache" ".mypy_cache"
        "coverage" ".nyc_output" "logs" "tmp" "temp"
    )

    for exclude in "${system_excludes[@]}"; do
        filters+=" -not -path '*/$exclude' -not -path '*/$exclude/*'"
    done

    # Find and parse .gitignore (current dir first, then git root)
    local gitignore_file=""

    # Check current directory first
    if [ -f ".gitignore" ]; then
        gitignore_file=".gitignore"
    else
        # Try to find git root and check for .gitignore there
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$git_root" ] && [ -f "$git_root/.gitignore" ]; then
            gitignore_file="$git_root/.gitignore"
        fi
    fi

    # Parse .gitignore if found
    if [ -n "$gitignore_file" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

            # Remove trailing slash and whitespace
            line=$(echo "$line" | sed 's|/$||' | xargs)

            # Skip wildcards patterns (too complex for simple find)
            [[ "$line" =~ \* ]] && continue

            # Add to filters
            filters+=" -not -path '*/$line' -not -path '*/$line/*'"
        done < "$gitignore_file"
    fi

    echo "$filters"
}

update_module_claude() {
    local module_path="$1"
    local tool="${2:-gemini}"
    local model="$3"

    # Validate parameters
    if [ -z "$module_path" ]; then
        echo "❌ Error: Module path is required"
        echo "Usage: update_module_claude.sh <module_path> [tool] [model]"
        return 1
    fi

    if [ ! -d "$module_path" ]; then
        echo "❌ Error: Directory '$module_path' does not exist"
        return 1
    fi

    # Set default models if not specified
    if [ -z "$model" ]; then
        case "$tool" in
            gemini)
                model="gemini-2.5-flash"
                ;;
            qwen)
                model="coder-model"
                ;;
            codex)
                model="gpt5-codex"
                ;;
            *)
                model=""
                ;;
        esac
    fi

    # Build exclusion filters from .gitignore
    local exclusion_filters=$(build_exclusion_filters)

    # Check if directory has files (excluding gitignored paths)
    local file_count=$(eval "find \"$module_path\" -maxdepth 1 -type f $exclusion_filters 2>/dev/null" | wc -l)
    if [ $file_count -eq 0 ]; then
        echo "⚠️  Skipping '$module_path' - no files found (after .gitignore filtering)"
        return 0
    fi

    # Use unified template for all modules
    local template_path="$HOME/.claude/workflows/cli-templates/prompts/memory/claude-module-unified.txt"

    # Prepare logging info
    local module_name=$(basename "$module_path")

    echo "⚡ Updating: $module_path"
    echo "   Tool: $tool | Model: $model | Files: $file_count"
    echo "   Template: $(basename "$template_path")"

    # Generate prompt with template injection
    local template_content=""
    if [ -f "$template_path" ]; then
        template_content=$(cat "$template_path")
    else
        echo "   ⚠️  Template not found: $template_path, using fallback"
        template_content="Update CLAUDE.md documentation for this module: document structure, key components, dependencies, and integration points."
    fi

    local base_prompt="
    ⚠️ CRITICAL RULES - MUST FOLLOW:
    1. Target file: ONLY create/update the file named 'CLAUDE.md' in current directory
    2. File name: MUST be exactly 'CLAUDE.md' (not ToolSidebar.CLAUDE.md or any variant)
    3. NEVER modify source code files
    4. Focus exclusively on updating documentation
    5. Follow the template guidelines exactly

    $template_content

    CONTEXT: @**/*"

    # Execute update
    local start_time=$(date +%s)
    echo "   🔄 Starting update..."

    if cd "$module_path" 2>/dev/null; then
        local tool_result=0
        local final_prompt="$base_prompt

        Module Information:
        - Name: $module_name
        - Path: $module_path
        - Tool: $tool"

        # Execute with selected tool
        # NOTE: Model parameter (-m) is placed AFTER the prompt
        case "$tool" in
            qwen)
                if [ "$model" = "coder-model" ]; then
                    # coder-model is default, -m is optional
                    qwen -p "$final_prompt" --yolo 2>&1
                else
                    qwen -p "$final_prompt" -m "$model" --yolo 2>&1
                fi
                tool_result=$?
                ;;
            codex)
                codex --full-auto exec "$final_prompt" -m "$model" --skip-git-repo-check -s danger-full-access 2>&1
                tool_result=$?
                ;;
            gemini)
                gemini -p "$final_prompt" -m "$model" --yolo 2>&1
                tool_result=$?
                ;;
            *)
                echo "   ⚠️  Unknown tool: $tool, defaulting to gemini"
                gemini -p "$final_prompt" -m "$model" --yolo 2>&1
                tool_result=$?
                ;;
        esac

        if [ $tool_result -eq 0 ]; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            echo "   ✅ Completed in ${duration}s"
            cd - > /dev/null
            return 0
        else
            echo "   ❌ Update failed for $module_path"
            cd - > /dev/null
            return 1
        fi
    else
        echo "   ❌ Cannot access directory: $module_path"
        return 1
    fi
}

# Execute function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    update_module_claude "$@"
fi