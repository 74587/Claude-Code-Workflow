#!/bin/bash
# Get modules organized by directory depth (deepest first)
# Usage: get_modules_by_depth.sh [format]
#   format: list|grouped|json (default: list)

# Parse .gitignore patterns and build exclusion filters
build_exclusion_filters() {
    local filters=""
    
    # Always exclude these system/cache directories
    local system_excludes=(
        ".git" ".history" ".vscode" "__pycache__" ".pytest_cache"
        "node_modules" "dist" "build" ".egg-info" ".env"
    )
    
    for exclude in "${system_excludes[@]}"; do
        filters+=" -not -path '*/$exclude' -not -path '*/$exclude/*'"
    done
    
    # Parse .gitignore if it exists
    if [ -f ".gitignore" ]; then
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            
            # Remove trailing slash and whitespace
            line=$(echo "$line" | sed 's|/$||' | xargs)
            
            # Add to filters
            filters+=" -not -path '*/$line' -not -path '*/$line/*'"
        done < .gitignore
    fi
    
    echo "$filters"
}

get_modules_by_depth() {
    local format="${1:-list}"
    local exclusion_filters=$(build_exclusion_filters)
    local max_depth=$(eval "find . -type d $exclusion_filters 2>/dev/null" | awk -F/ '{print NF-1}' | sort -n | tail -1)
    
    case "$format" in
        "grouped")
            echo "📊 Modules by depth (deepest first):"
            for depth in $(seq $max_depth -1 0); do
                local dirs=$(eval "find . -mindepth $depth -maxdepth $depth -type d $exclusion_filters 2>/dev/null" | \
                           while read dir; do
                               if [ $(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l) -gt 0 ]; then
                                   local claude_indicator=""
                                   [ -f "$dir/CLAUDE.md" ] && claude_indicator=" [✓]"
                                   echo "$dir$claude_indicator"
                               fi
                           done)
                if [ -n "$dirs" ]; then
                    echo "  📁 Depth $depth:"
                    echo "$dirs" | sed 's/^/    - /'
                fi
            done
            ;;
            
        "json")
            echo "{"
            echo "  \"max_depth\": $max_depth,"
            echo "  \"modules\": {"
            for depth in $(seq $max_depth -1 0); do
                local dirs=$(eval "find . -mindepth $depth -maxdepth $depth -type d $exclusion_filters 2>/dev/null" | \
                           while read dir; do
                               if [ $(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l) -gt 0 ]; then
                                   local has_claude="false"
                                   [ -f "$dir/CLAUDE.md" ] && has_claude="true"
                                   echo "{\"path\":\"$dir\",\"has_claude\":$has_claude}"
                               fi
                           done | tr '\n' ',')
                if [ -n "$dirs" ]; then
                    dirs=${dirs%,}  # Remove trailing comma
                    echo "    \"$depth\": [$dirs]"
                    [ $depth -gt 0 ] && echo ","
                fi
            done
            echo "  }"
            echo "}"
            ;;
            
        "list"|*)
            # Simple list format (deepest first)
            for depth in $(seq $max_depth -1 0); do
                eval "find . -mindepth $depth -maxdepth $depth -type d $exclusion_filters 2>/dev/null" | \
                while read dir; do
                    if [ $(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l) -gt 0 ]; then
                        local file_count=$(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l)
                        local types=$(find "$dir" -maxdepth 1 -type f -name "*.*" 2>/dev/null | \
                                    grep -E '\.[^/]*$' | sed 's/.*\.//' | sort -u | tr '\n' ',' | sed 's/,$//')
                        local has_claude="no"
                        [ -f "$dir/CLAUDE.md" ] && has_claude="yes"
                        echo "depth:$depth|path:$dir|files:$file_count|types:[$types]|has_claude:$has_claude"
                    fi
                done
            done
            ;;
    esac
}

# Execute function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_modules_by_depth "$@"
fi