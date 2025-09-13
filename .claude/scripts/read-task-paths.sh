#!/bin/bash
# Read paths field from task JSON and convert to Gemini @ format
# Usage: read-task-paths.sh [task-json-file]

TASK_FILE="$1"

if [ -z "$TASK_FILE" ]; then
    echo "Usage: read-task-paths.sh [task-json-file]" >&2
    exit 1
fi

if [ ! -f "$TASK_FILE" ]; then
    echo "Error: Task file '$TASK_FILE' not found" >&2
    exit 1
fi

# Extract paths field from JSON
paths=$(grep -o '"paths":[[:space:]]*"[^"]*"' "$TASK_FILE" | sed 's/"paths":[[:space:]]*"\([^"]*\)"/\1/')

if [ -z "$paths" ]; then
    # No paths field found, return empty @ format
    echo "@{}"
    exit 0
fi

# Convert semicolon-separated paths to comma-separated @ format
formatted_paths=$(echo "$paths" | sed 's/;/,/g')

# For directories, append /**/* to get all files
# For files (containing .), keep as-is
IFS=',' read -ra path_array <<< "$formatted_paths"
result_paths=()

for path in "${path_array[@]}"; do
    # Trim whitespace
    path=$(echo "$path" | xargs)
    
    if [ -n "$path" ]; then
        # Check if path is a directory (no extension) or file (has extension)
        if [[ "$path" == *.* ]]; then
            # File path - keep as is
            result_paths+=("$path")
        else
            # Directory path - add wildcard expansion
            result_paths+=("$path/**/*")
        fi
    fi
done

# Output Gemini @ format
printf "@{"
printf "%s" "${result_paths[0]}"
for i in "${result_paths[@]:1}"; do
    printf ",%s" "$i"
done
printf "}"