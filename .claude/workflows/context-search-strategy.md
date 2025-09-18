---
name: context-search-strategy
description: Strategic guidelines for context search commands
type: search-guideline
---

# Context Search Strategy

## ⚡ Core Search Tools

**rg (ripgrep)**: Fast content search with regex support
**find**: File/directory location by name patterns
**grep**: Built-in pattern matching in files

### Decision Principles
- **Use rg for content** - Fastest for searching within files
- **Use find for files** - Locate files/directories by name
- **Use grep sparingly** - Only when rg unavailable

### Quick Command Reference
```bash
# Content Search (rg preferred)
rg "pattern" --type js          # Search in JS files
rg -i "case-insensitive"        # Ignore case
rg -n "show-line-numbers"       # Show line numbers
rg -A 3 -B 3 "context-lines"    # Show 3 lines before/after

# File Search (find)
find . -name "*.ts" -type f     # Find TypeScript files
find . -path "*/node_modules" -prune -o -name "*.js" -print

# Built-in alternatives
grep -r "pattern" .             # Recursive search (slower)
grep -n -i "pattern" file.txt   # Line numbers, case-insensitive
```

### Workflow Integration Examples
```bash
# Search for task definitions
rg "IMPL-\d+" .workflow/ --type json        # Find task IDs
find .workflow/ -name "*.json" -path "*/.task/*"  # Locate task files

# Analyze workflow structure
rg "status.*pending" .workflow/.task/      # Find pending tasks
rg "depends_on" .workflow/.task/ -A 2      # Show dependencies

# Find workflow sessions
find .workflow/ -name ".active-*"          # Active sessions
rg "WFS-" .workflow/ --type json           # Session references

# Content analysis for planning
rg "flow_control" .workflow/ -B 2 -A 5     # Flow control patterns
find . -name "IMPL_PLAN.md" -exec grep -l "requirements" {} \;
```

### Performance Tips
- **rg > grep** for content search
- **Use --type filters** to limit file types
- **Exclude common dirs**: `--glob '!node_modules'`
- **Use -F for literal** strings (no regex)