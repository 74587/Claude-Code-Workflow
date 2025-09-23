#!/bin/bash
# Planning Role Template Accessor - Role template content access utility
# Usage: ./planning-role-load.sh list|load <role-name>

set -e

# Configuration
CLAUDE_DIR="$HOME/.claude"
PLANNING_ROLES_DIR="$CLAUDE_DIR/workflows/cli-templates/planning-roles"

# Parse command line arguments
COMMAND="$1"
ROLE_NAME="$2"

# Function to list available planning roles
list_roles() {
    echo "Available planning roles:"
    echo "========================="
    for role_file in "$PLANNING_ROLES_DIR"/*.md; do
        if [[ -f "$role_file" ]]; then
            local name=$(basename "$role_file" .md)
            if [[ "$name" != "README" ]]; then
                local desc=$(grep "description:" "$role_file" | cut -d':' -f2- | sed 's/^ *//')
                printf "%-20s %s\n" "$name" "$desc"
            fi
        fi
    done
    echo ""
}

# Function to load planning role template
load_role() {
    local role_name="$1"
    local role_file="$PLANNING_ROLES_DIR/$role_name.md"

    if [[ -f "$role_file" ]]; then
        cat "$role_file"
        return 0
    else
        echo "Error: Planning role file not found: $role_file" >&2
        echo "Available roles:" >&2
        for role in "$PLANNING_ROLES_DIR"/*.md; do
            if [[ -f "$role" ]]; then
                echo "  - $(basename "$role" .md)" >&2
            fi
        done
        return 1
    fi
}

# Main execution
case "$COMMAND" in
    "list")
        list_roles
        ;;
    "load")
        if [[ -z "$ROLE_NAME" ]]; then
            echo "Error: Role name is required for load command" >&2
            echo "Usage: $0 load <role-name>" >&2
            exit 1
        fi
        load_role "$ROLE_NAME"
        ;;
    *)
        echo "Error: Unknown command: $COMMAND" >&2
        echo "Usage: $0 {list|load} [role-name]" >&2
        echo "Commands:" >&2
        echo "  list              - List available planning roles" >&2
        echo "  load <name>       - Load planning role template content" >&2
        exit 1
        ;;
esac