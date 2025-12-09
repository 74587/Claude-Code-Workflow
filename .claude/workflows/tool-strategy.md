# Tool Strategy

## ⚡ Exa Triggering Mechanisms

**Auto-Trigger**:
- User mentions "exa-code" or code-related queries → `mcp__exa__get_code_context_exa`
- Need current web information → `mcp__exa__web_search_exa`

**Manual Trigger**:
- Complex API research → Exa Code Context
- Real-time information needs → Exa Web Search

## ⚡ CCW edit_file Tool (AI-Powered Editing)

**When to Use**: Edit tool fails 1+ times on same file

### update Mode (Default)

**Best for**: Code block replacements, function rewrites, multi-line changes

```bash
ccw tool exec edit_file '{
  "path": "file.py",
  "oldText": "def old():\n    pass",
  "newText": "def new():\n    return True"
}'
```

### line Mode (Precise Line Operations)

**Best for**: Config files, line insertions/deletions, precise line number control

```bash
# Insert after specific line
ccw tool exec edit_file '{
  "path": "config.txt",
  "mode": "line",
  "operation": "insert_after",
  "line": 10,
  "text": "new config line"
}'

# Delete line range
ccw tool exec edit_file '{
  "path": "log.txt",
  "mode": "line",
  "operation": "delete",
  "line": 5,
  "end_line": 8
}'

# Replace specific line
ccw tool exec edit_file '{
  "path": "script.sh",
  "mode": "line",
  "operation": "replace",
  "line": 3,
  "text": "#!/bin/bash"
}'
```

**Operations**:
- `insert_before`: Insert text before specified line
- `insert_after`: Insert text after specified line
- `replace`: Replace line or line range
- `delete`: Delete line or line range

### Mode Selection Guide

| Scenario | Mode | Reason |
|----------|------|--------|
| Code refactoring | update | Content-driven replacement |
| Function rewrite | update | Simple oldText/newText |
| Config line change | line | Precise line number control |
| Insert at specific position | line | Exact line number needed |
| Delete line range | line | Line-based operation |

### Fallback Strategy

1. **Edit fails 1+ times** → Use `ccw tool exec edit_file` (update mode)
2. **update mode fails** → Try line mode with precise line numbers
3. **All fails** → Use Write to recreate file

**Default mode**: update (exact matching with line ending adaptation)
