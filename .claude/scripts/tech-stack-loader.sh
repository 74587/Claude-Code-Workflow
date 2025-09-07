#!/bin/bash
# tech-stack-loader.sh - DMSFlow Tech Stack Guidelines Loader
# Returns tech stack specific coding guidelines and best practices for Claude processing

set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../tech-stack-templates"

# Parse arguments
COMMAND="$1"
TECH_STACK="$2"

# Handle version check
if [ "$COMMAND" = "--version" ] || [ "$COMMAND" = "-v" ]; then
    echo "DMSFlow tech-stack-loader v2.0"
    echo "Semantic-based development guidelines system"
    exit 0
fi

# List all available guidelines
if [ "$COMMAND" = "--list" ]; then
    echo "Available Development Guidelines:"
    echo "================================="
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

# Load specific guidelines
if [ "$COMMAND" = "--load" ] && [ -n "$TECH_STACK" ]; then
    TEMPLATE_PATH="${TEMPLATE_DIR}/${TECH_STACK}.md"
    
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
        >&2 echo "Error: Development guidelines '$TECH_STACK' not found"
        >&2 echo "Use --list to see available guidelines"
        exit 1
    fi
    exit 0
fi

# Handle legacy usage (direct tech stack name)
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
        >&2 echo "Error: Development guidelines '$COMMAND' not found"
        >&2 echo "Use --list to see available guidelines"
        exit 1
    fi
fi

# Show help
echo "Usage:"
echo "  tech-stack-loader.sh --list              List all available guidelines with descriptions"
echo "  tech-stack-loader.sh --load <name>       Load specific development guidelines"
echo "  tech-stack-loader.sh <name>              Load specific guidelines (legacy format)"
echo "  tech-stack-loader.sh --help              Show this help message"
echo "  tech-stack-loader.sh --version           Show version information"
echo ""
echo "Examples:"
echo "  tech-stack-loader.sh --list"
echo "  tech-stack-loader.sh --load javascript-dev"
echo "  tech-stack-loader.sh python-dev"