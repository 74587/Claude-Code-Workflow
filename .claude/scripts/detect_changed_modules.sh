#!/bin/bash
# Detect modules affected by git changes or recent modifications
# Usage: detect_changed_modules.sh [format]
#   format: list|grouped|paths (default: paths)

detect_changed_modules() {
    local format="${1:-paths}"
    local changed_files=""
    local affected_dirs=""
    
    # Step 1: Try to get git changes (staged + unstaged)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        changed_files=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null)
        
        # If no changes in working directory, check last commit
        if [ -z "$changed_files" ]; then
            changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)
        fi
    fi
    
    # Step 2: If no git changes, find recently modified source files (last 24 hours)
    if [ -z "$changed_files" ]; then
        changed_files=$(find . -type f \( \
            -name "*.md" -o \
            -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o \
            -name "*.py" -o -name "*.go" -o -name "*.rs" -o \
            -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.h" -o \
            -name "*.sh" -o -name "*.ps1" -o \
            -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
        \) -not -path '*/.*' -mtime -1 2>/dev/null)
    fi
    
    # Step 3: Extract unique parent directories
    if [ -n "$changed_files" ]; then
        affected_dirs=$(echo "$changed_files" | \
            sed 's|/[^/]*$||' | \
            grep -v '^\.$' | \
            sort -u)
        
        # Add current directory if files are in root
        if echo "$changed_files" | grep -q '^[^/]*$'; then
            affected_dirs=$(echo -e ".\n$affected_dirs" | sort -u)
        fi
    fi
    
    # Step 4: Output in requested format
    case "$format" in
        "list")
            if [ -n "$affected_dirs" ]; then
                echo "$affected_dirs" | while read dir; do
                    if [ -d "$dir" ]; then
                        local file_count=$(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l)
                        local depth=$(echo "$dir" | tr -cd '/' | wc -c)
                        if [ "$dir" = "." ]; then depth=0; fi
                        
                        local types=$(find "$dir" -maxdepth 1 -type f -name "*.*" 2>/dev/null | \
                                    grep -E '\.[^/]*$' | sed 's/.*\.//' | sort -u | tr '\n' ',' | sed 's/,$//')
                        echo "depth:$depth|path:$dir|files:$file_count|types:[$types]|status:changed"
                    fi
                done
            fi
            ;;
            
        "grouped")
            if [ -n "$affected_dirs" ]; then
                echo "📊 Affected modules by changes:"
                # Group by depth
                echo "$affected_dirs" | while read dir; do
                    if [ -d "$dir" ]; then
                        local depth=$(echo "$dir" | tr -cd '/' | wc -c)
                        if [ "$dir" = "." ]; then depth=0; fi
                        echo "$depth:$dir"
                    fi
                done | sort -n | awk -F: '
                    {
                        if ($1 != prev_depth) {
                            if (prev_depth != "") print ""
                            print "  📁 Depth " $1 ":"
                            prev_depth = $1
                        }
                        print "    - " $2 " (changed)"
                    }'
            else
                echo "📊 No recent changes detected"
            fi
            ;;
            
        "paths"|*)
            echo "$affected_dirs"
            ;;
    esac
}

# Execute function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    detect_changed_modules "$@"
fi