#!/bin/bash
# plan-executor.sh - DMSFlow Planning Template Loader  
# Returns role-specific planning templates for Claude processing

set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../planning-templates"

# Parse arguments
COMMAND="$1"
ROLE="$2"

# Handle version check
if [ "$COMMAND" = "--version" ] || [ "$COMMAND" = "-v" ]; then
    echo "DMSFlow plan-executor v2.0"
    echo "Semantic-based planning role system"
    exit 0
fi

# List all available planning roles
if [ "$COMMAND" = "--list" ]; then
    echo "Available Planning Roles:"
    echo "========================"
    for file in "$TEMPLATE_DIR"/*.md; do
        if [ -f "$file" ]; then
            # Extract name and description from YAML frontmatter
            name=$(grep "^name:" "$file" | head -1 | cut -d: -f2 | sed 's/^ *//' | sed 's/ *$//')
            desc=$(grep "^description:" "$file" | head -1 | cut -d: -f2- | sed 's/^ *//' | sed 's/ *$//')
            
            if [ -n "$name" ] && [ -n "$desc" ]; then
                printf "%-20s - %s\n" "$name" "$desc"
            fi
        fi
    done
    exit 0
fi

# Load specific planning role
if [ "$COMMAND" = "--load" ] && [ -n "$ROLE" ]; then
    TEMPLATE_PATH="${TEMPLATE_DIR}/${ROLE}.md"
    
    if [ -f "$TEMPLATE_PATH" ]; then
        # Output content, skipping YAML frontmatter
        awk '
        BEGIN { in_yaml = 0; yaml_ended = 0 }
        /^---$/ { 
            if (!yaml_ended) {
                if (in_yaml) yaml_ended = 1
                else in_yaml = 1
                next
            }
        }
        yaml_ended { print }
        ' "$TEMPLATE_PATH"
    else
        >&2 echo "Error: Planning role '$ROLE' not found"
        >&2 echo "Use --list to see available planning roles"
        exit 1
    fi
    exit 0
fi

# Handle legacy usage (direct role name)
if [ -n "$COMMAND" ] && [ "$COMMAND" != "--help" ] && [ "$COMMAND" != "--list" ] && [ "$COMMAND" != "--load" ]; then
    TEMPLATE_PATH="${TEMPLATE_DIR}/${COMMAND}.md"
    
    if [ -f "$TEMPLATE_PATH" ]; then
        # Output content, skipping YAML frontmatter
        awk '
        BEGIN { in_yaml = 0; yaml_ended = 0 }
        /^---$/ { 
            if (!yaml_ended) {
                if (in_yaml) yaml_ended = 1
                else in_yaml = 1
                next
            }
        }
        yaml_ended { print }
        ' "$TEMPLATE_PATH"
        exit 0
    else
        >&2 echo "Error: Planning role '$COMMAND' not found"
        >&2 echo "Use --list to see available planning roles"
        exit 1
    fi
fi

# Show help
echo "Usage:"
echo "  plan-executor.sh --list              List all available planning roles with descriptions"
echo "  plan-executor.sh --load <role>       Load specific planning role template"  
echo "  plan-executor.sh <role>              Load specific role template (legacy format)"
echo "  plan-executor.sh --help              Show this help message"
echo "  plan-executor.sh --version           Show version information"
echo ""
echo "Examples:"
echo "  plan-executor.sh --list"
echo "  plan-executor.sh --load system-architect"
echo "  plan-executor.sh feature-planner"