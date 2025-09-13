#!/bin/bash

# read-paths.sh - Simple path reader for gemini format
# Usage: read-paths.sh <paths_file>

PATHS_FILE="$1"

# Check file exists
if [ ! -f "$PATHS_FILE" ]; then
    echo "❌ File not found: $PATHS_FILE" >&2
    exit 1
fi

# Read valid paths
valid_paths=()
while IFS= read -r line; do
    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Clean and add path
    path=$(echo "$line" | xargs)
    [ -n "$path" ] && valid_paths+=("$path")
done < "$PATHS_FILE"

# Check if we have paths
if [ ${#valid_paths[@]} -eq 0 ]; then
    echo "❌ No valid paths found in $PATHS_FILE" >&2
    exit 1
fi

# Output gemini format @{path1,path2,...}
printf "@{"
printf "%s" "${valid_paths[0]}"
printf ",%s" "${valid_paths[@]:1}"
printf "}"