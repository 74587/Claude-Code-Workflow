---
name: list
description: List all available design runs with metadata (session, created time, prototype count)
argument-hint: [--session <id>]
allowed-tools: Bash(*), Read(*)
---

# List Design Runs (/workflow:ui-design:list)

## Overview
List all available UI design runs across sessions or within a specific session. Displays design IDs with metadata for easy reference.

**Output**: Formatted list with design-id, session, created time, and prototype count

## Implementation

### Step 1: Determine Search Scope
```bash
# Priority: --session > all sessions
search_path=$(if [ -n "$SESSION_ID" ]; then
  echo ".workflow/WFS-$SESSION_ID"
else
  echo ".workflow"
fi)
```

### Step 2: Find and Display Design Runs
```bash
echo "Available design runs:"
echo ""

# Find all design-run directories
found_count=0
while IFS= read -r line; do
  timestamp=$(echo "$line" | cut -d' ' -f1)
  path=$(echo "$line" | cut -d' ' -f2-)

  # Extract design_id from path
  design_id=$(basename "$path")

  # Extract session from path
  session_id=$(echo "$path" | grep -oP 'WFS-\K[^/]+' || echo "standalone")

  # Format created date
  created_at=$(date -d "@${timestamp%.*}" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "unknown")

  # Count prototypes
  prototype_count=$(find "$path/prototypes" -name "*.html" 2>/dev/null | wc -l)

  # Display formatted output
  echo "  - $design_id"
  echo "      Session: $session_id"
  echo "      Created: $created_at"
  echo "      Prototypes: $prototype_count"
  echo ""

  found_count=$((found_count + 1))
done < <(find "$search_path" -name "design-run-*" -type d -printf "%T@ %p\n" 2>/dev/null | sort -nr)

# Summary
if [ $found_count -eq 0 ]; then
  echo "  No design runs found."
  echo ""
  if [ -n "$SESSION_ID" ]; then
    echo "💡 HINT: Try running '/workflow:ui-design:explore-auto' to create a design run"
  else
    echo "💡 HINT: Try running '/workflow:ui-design:explore-auto --session <id>' to create a design run"
  fi
else
  echo "Total: $found_count design run(s)"
  echo ""
  echo "💡 USE: /workflow:ui-design:generate --design-id \"<id>\""
  echo "      OR: /workflow:ui-design:generate --session \"<session>\""
fi
```

### Step 3: Execute List Command
```bash
Bash(
  description: "List all UI design runs with metadata",
  command: "
    search_path=\"${search_path}\"
    SESSION_ID=\"${SESSION_ID:-}\"

    echo 'Available design runs:'
    echo ''

    found_count=0
    while IFS= read -r line; do
      timestamp=\$(echo \"\$line\" | cut -d' ' -f1)
      path=\$(echo \"\$line\" | cut -d' ' -f2-)

      design_id=\$(basename \"\$path\")
      session_id=\$(echo \"\$path\" | grep -oP 'WFS-\\K[^/]+' || echo 'standalone')
      created_at=\$(date -d \"@\${timestamp%.*}\" '+%Y-%m-%d %H:%M' 2>/dev/null || echo 'unknown')
      prototype_count=\$(find \"\$path/prototypes\" -name '*.html' 2>/dev/null | wc -l)

      echo \"  - \$design_id\"
      echo \"      Session: \$session_id\"
      echo \"      Created: \$created_at\"
      echo \"      Prototypes: \$prototype_count\"
      echo ''

      found_count=\$((found_count + 1))
    done < <(find \"\$search_path\" -name 'design-run-*' -type d -printf '%T@ %p\\n' 2>/dev/null | sort -nr)

    if [ \$found_count -eq 0 ]; then
      echo '  No design runs found.'
      echo ''
      if [ -n \"\$SESSION_ID\" ]; then
        echo '💡 HINT: Try running \\'/workflow:ui-design:explore-auto\\' to create a design run'
      else
        echo '💡 HINT: Try running \\'/workflow:ui-design:explore-auto --session <id>\\' to create a design run'
      fi
    else
      echo \"Total: \$found_count design run(s)\"
      echo ''
      echo '💡 USE: /workflow:ui-design:generate --design-id \"<id>\"'
      echo '      OR: /workflow:ui-design:generate --session \"<session>\"'
    fi
  "
)
```

## Example Output

### With Session Filter
```
$ /workflow:ui-design:list --session ui-redesign

Available design runs:

  - design-run-20250109-143052
      Session: ui-redesign
      Created: 2025-01-09 14:30
      Prototypes: 12

  - design-run-20250109-101534
      Session: ui-redesign
      Created: 2025-01-09 10:15
      Prototypes: 6

Total: 2 design run(s)

💡 USE: /workflow:ui-design:generate --design-id "<id>"
      OR: /workflow:ui-design:generate --session "<session>"
```

### All Sessions
```
$ /workflow:ui-design:list

Available design runs:

  - design-run-20250109-143052
      Session: ui-redesign
      Created: 2025-01-09 14:30
      Prototypes: 12

  - design-run-20250108-092314
      Session: landing-page
      Created: 2025-01-08 09:23
      Prototypes: 3

  - design-run-20250107-155623
      Session: standalone
      Created: 2025-01-07 15:56
      Prototypes: 8

Total: 3 design run(s)

💡 USE: /workflow:ui-design:generate --design-id "<id>"
      OR: /workflow:ui-design:generate --session "<session>"
```
