## File Modification

### Use edit_file (MCP)
- Built-in Edit tool failed 1+ times
- Need dry-run preview before applying changes
- Need line-based operations (insert_after, insert_before)
- Need to replace all occurrences at once
- Built-in Edit returns "old_string not found"
- Whitespace/formatting issues in built-in Edit

**Mode Selection**:
- `mode=update`: Replace text
- `mode=line`: Line-based operations

### Use write_file (MCP)
- Creating brand new files
- MCP edit_file still fails (last resort)
- Need to completely replace file content
- Need backup before overwriting
- User explicitly asks to "recreate file"

## Priority Logic

**File Reading**:
1. Known single file → Built-in Read
2. Multiple files OR pattern matching → read_file (MCP)
3. Unknown location → smart_search then Read
4. Large codebase + repeated access → codex_lens

**File Editing**:
1. Always try built-in Edit first
2. Fails 1+ times → edit_file (MCP)
3. Still fails → write_file (MCP)

**Search**:
1. External knowledge → Exa
2. Exact pattern in small codebase → Built-in Grep
3. Semantic/unknown location → smart_search
4. Large codebase + repeated searches → codex_lens

## Decision Triggers

**Start with simplest tool** (Read, Edit, Grep)
**Escalate to MCP tools** when built-ins fail or inappropriate
**Use semantic search** for exploratory tasks
**Use indexed search** for large, stable codebases
**Use Exa** for external/public knowledge

## ⚡ Core Search Tools

**rg (ripgrep)**: Fast content search with regex support
**find**: File/directory location by name patterns
**grep**: Built-in pattern matching (fallback when rg unavailable)
**get_modules_by_depth**: Program architecture analysis (MANDATORY before planning)


## 🔧 Quick Command Reference

```bash
# Semantic File Discovery (codebase-retrieval via CCW)
ccw cli exec "
PURPOSE: Discover files relevant to task/feature
TASK: • List all files related to [task/feature description]
MODE: analysis
CONTEXT: @**/*
EXPECTED: Relevant file paths with relevance explanation
RULES: Focus on direct relevance to task requirements | analysis=READ-ONLY
" --tool gemini --cd [directory]

# Program Architecture (MANDATORY before planning)
ccw tool exec get_modules_by_depth '{}'

# Content Search (rg preferred)
rg "pattern" --type js -n        # Search JS files with line numbers
rg -i "case-insensitive"         # Ignore case
rg -C 3 "context"                # Show 3 lines before/after

# File Search
find . -name "*.ts" -type f      # Find TypeScript files
find . -path "*/node_modules" -prune -o -name "*.js" -print

# Workflow Examples
rg "IMPL-\d+" .workflow/ --type json                    # Find task IDs
find .workflow/ -name "*.json" -path "*/.task/*"        # Locate task files
rg "status.*pending" .workflow/.task/                   # Find pending tasks
```

## ⚡ Performance Tips

- **rg > grep** for content search
- **Use --type filters** to limit file types
- **Exclude dirs**: `--glob '!node_modules'`
- **Use -F** for literal strings (no regex)
