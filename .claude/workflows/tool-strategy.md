# Tool Strategy

## ⚡ Exa Triggering Mechanisms

**Auto-Trigger**:
- User mentions "exa-code" or code-related queries → `mcp__exa__get_code_context_exa`
- Need current web information → `mcp__exa__web_search_exa`

**Manual Trigger**:
- Complex API research → Exa Code Context
- Real-time information needs → Exa Web Search

## ⚡ CCW Tool Execution

### General Usage (JSON Parameters)

```bash
ccw tool exec <tool_name> '{"param": "value"}'
```

**Examples**:
```bash
ccw tool exec get_modules_by_depth '{}'
ccw tool exec classify_folders '{"path": "./src"}'
```

**Available Tools**: `ccw tool list`

### edit_file Tool

**When to Use**: Edit tool fails 1+ times on same file

```bash
# Basic edit
ccw tool exec edit_file --path "file.py" --old "old code" --new "new code"

# Preview without modifying (dry run)
ccw tool exec edit_file --path "file.py" --old "old" --new "new" --dry-run

# Replace all occurrences
ccw tool exec edit_file --path "file.py" --old "old" --new "new" --replace-all

# Line mode - insert after line
ccw tool exec edit_file --path "file.py" --mode line --operation insert_after --line 10 --text "new line"

# Line mode - insert before line
ccw tool exec edit_file --path "file.py" --mode line --operation insert_before --line 5 --text "new line"

# Line mode - replace line
ccw tool exec edit_file --path "file.py" --mode line --operation replace --line 3 --text "replacement"

# Line mode - delete line
ccw tool exec edit_file --path "file.py" --mode line --operation delete --line 3
```

**Parameters**: `--path`*, `--old`, `--new`, `--dry-run`, `--replace-all`, `--mode` (update|line), `--operation`, `--line`, `--text`

### write_file Tool

**When to Use**: Create new files or overwrite existing content

```bash
# Basic write
ccw tool exec write_file --path "file.txt" --content "Hello"

# With backup
ccw tool exec write_file --path "file.txt" --content "new content" --backup

# Create directories if needed
ccw tool exec write_file --path "new/path/file.txt" --content "content" --create-directories
```

**Parameters**: `--path`*, `--content`*, `--create-directories`, `--backup`, `--encoding`

### Fallback Strategy

1. **Edit fails 1+ times** → `ccw tool exec edit_file`
2. **Still fails** → `ccw tool exec write_file`

## ⚡ sed Line Operations (Line Mode Alternative)

**When to Use**: Precise line number control (insert, delete, replace specific lines)

### Common Operations

```bash
# Insert after line 10
sed -i '10a\new line content' file.txt

# Insert before line 5
sed -i '5i\new line content' file.txt

# Delete line 3
sed -i '3d' file.txt

# Delete lines 5-8
sed -i '5,8d' file.txt

# Replace line 3 content
sed -i '3c\replacement line' file.txt

# Replace lines 3-5 content
sed -i '3,5c\single replacement line' file.txt
```

### Operation Reference

| Operation | Command | Example |
|-----------|---------|---------|
| Insert after | `Na\text` | `sed -i '10a\new' file` |
| Insert before | `Ni\text` | `sed -i '5i\new' file` |
| Delete line | `Nd` | `sed -i '3d' file` |
| Delete range | `N,Md` | `sed -i '5,8d' file` |
| Replace line | `Nc\text` | `sed -i '3c\new' file` |

**Note**: Use `sed -i` for in-place file modification (works in Git Bash on Windows)
