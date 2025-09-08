#!/bin/bash
# Gemini Chat Template Accessor - Template content access utility
# Usage: ./chat-template-load.sh list|load <template-name>

set -e

# Configuration
CLAUDE_DIR="$HOME/.claude"
TEMPLATES_DIR="$CLAUDE_DIR/prompt-templates"

# Parse command line arguments
COMMAND="$1"
TEMPLATE_NAME="$2"

# Function to list available templates
list_templates() {
    echo "Available templates:"
    echo "===================="
    for template_file in "$TEMPLATES_DIR"/*.md; do
        if [[ -f "$template_file" ]]; then
            local name=$(basename "$template_file" .md)
            if [[ "$name" != "README" ]]; then
                local desc=$(grep "description:" "$template_file" | cut -d':' -f2- | sed 's/^ *//')
                printf "%-20s %s\n" "$name" "$desc"
            fi
        fi
    done
    echo ""
}

# Function to load template
load_template() {
    local template_name="$1"
    local template_file="$TEMPLATES_DIR/$template_name.md"
    
    if [[ -f "$template_file" ]]; then
        cat "$template_file"
        return 0
    else
        echo "Error: Template file not found: $template_file" >&2
        return 1
    fi
}

# Main execution
case "$COMMAND" in
    "list")
        list_templates
        ;;
    "load")
        if [[ -z "$TEMPLATE_NAME" ]]; then
            echo "Error: Template name is required for load command" >&2
            echo "Usage: $0 load <template-name>" >&2
            exit 1
        fi
        load_template "$TEMPLATE_NAME"
        ;;
    *)
        echo "Error: Unknown command: $COMMAND" >&2
        echo "Usage: $0 {list|load} [template-name]" >&2
        echo "Commands:" >&2
        echo "  list              - List available templates" >&2
        echo "  load <name>       - Load template content" >&2
        exit 1
        ;;
esac