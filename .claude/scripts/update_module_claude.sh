#!/bin/bash
# Update CLAUDE.md for a specific module with automatic layer detection
# Usage: update_module_claude.sh <module_path> [update_type]
#   module_path: Path to the module directory
#   update_type: full|related (default: full)
#   Script automatically detects layer depth and selects appropriate template

update_module_claude() {
    local module_path="$1"
    local update_type="${2:-full}"
    
    # Validate parameters
    if [ -z "$module_path" ]; then
        echo "❌ Error: Module path is required"
        echo "Usage: update_module_claude.sh <module_path> [update_type]"
        return 1
    fi
    
    if [ ! -d "$module_path" ]; then
        echo "❌ Error: Directory '$module_path' does not exist"
        return 1
    fi
    
    # Check if directory has files
    local file_count=$(find "$module_path" -maxdepth 1 -type f 2>/dev/null | wc -l)
    if [ $file_count -eq 0 ]; then
        echo "⚠️  Skipping '$module_path' - no files found"
        return 0
    fi
    
    # Determine documentation layer based on path patterns
    local layer=""
    local template_path=""
    local analysis_strategy=""
    
    # Clean path for pattern matching
    local clean_path=$(echo "$module_path" | sed 's|^\./||')
    
    # Pattern-based layer detection
    if [ "$module_path" = "." ]; then
        # Root directory
        layer="Layer 1 (Root)"
        template_path="~/.claude/workflows/gemini-templates/prompts/dms/claude-layer1-root.txt"
        analysis_strategy="--all-files"
    elif [[ "$clean_path" =~ ^[^/]+$ ]]; then
        # Top-level directories (e.g., .claude, src, tests)
        layer="Layer 2 (Domain)"
        template_path="~/.claude/workflows/gemini-templates/prompts/dms/claude-layer2-domain.txt"
        analysis_strategy="@{*/CLAUDE.md}"
    elif [[ "$clean_path" =~ ^[^/]+/[^/]+$ ]]; then
        # Second-level directories (e.g., .claude/scripts, src/components)
        layer="Layer 3 (Module)"
        template_path="~/.claude/workflows/gemini-templates/prompts/dms/claude-layer3-module.txt"
        analysis_strategy="@{*/CLAUDE.md}"
    else
        # Deeper directories (e.g., .claude/workflows/gemini-templates/prompts)
        layer="Layer 4 (Sub-Module)"
        template_path="~/.claude/workflows/gemini-templates/prompts/dms/claude-layer4-submodule.txt"
        analysis_strategy="--all-files"
    fi
    
    # Prepare logging info
    local module_name=$(basename "$module_path")
    
    echo "⚡ Updating: $module_path"
    echo "   Layer: $layer | Type: $update_type | Files: $file_count"
    echo "   Template: $(basename "$template_path") | Strategy: $analysis_strategy"
    
    # Generate prompt with template injection
    local template_content=""
    if [ -f "$template_path" ]; then
        template_content=$(cat "$template_path")
    else
        echo "   ⚠️  Template not found: $template_path, using fallback"
        template_content="Update CLAUDE.md documentation for this module following hierarchy standards."
    fi
    
    local update_context=""
    if [ "$update_type" = "full" ]; then
        update_context="
        Update Mode: Complete refresh
        - Perform comprehensive analysis of all content
        - Document patterns, architecture, and purpose
        - Consider existing documentation hierarchy
        - Follow template guidelines strictly"
    else
        update_context="
        Update Mode: Context-aware update
        - Focus on recent changes and affected areas
        - Maintain consistency with existing documentation
        - Update only relevant sections
        - Follow template guidelines for updated content"
    fi
    
    local base_prompt="
    ⚠️ CRITICAL RULES - MUST FOLLOW:
    1. ONLY modify CLAUDE.md files at any hierarchy level
    2. NEVER modify source code files
    3. Focus exclusively on updating documentation
    4. Follow the template guidelines exactly
    
    $template_content
    
    $update_context"
    
    # Execute update
    local start_time=$(date +%s)
    echo "   🔄 Starting update..."
    
    if cd "$module_path" 2>/dev/null; then
        # Execute gemini command with layer-specific analysis strategy
        local gemini_result=0
        if [ "$analysis_strategy" = "--all-files" ]; then
            gemini --all-files --yolo -p "$base_prompt

        Module Information:
        - Name: $module_name
        - Path: $module_path
        - Layer: $layer
        - Analysis Strategy: $analysis_strategy" 2>&1
            gemini_result=$?
        else
            gemini --yolo -p "$analysis_strategy $base_prompt

        Module Information:
        - Name: $module_name
        - Path: $module_path
        - Layer: $layer
        - Analysis Strategy: $analysis_strategy" 2>&1
            gemini_result=$?
        fi
        
        if [ $gemini_result -eq 0 ]; then
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