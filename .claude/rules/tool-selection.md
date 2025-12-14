# Tool Selection Rules

## Context Gathering

### Use Exa
- Researching external APIs, libraries, frameworks
- Need recent documentation beyond knowledge cutoff
- Looking for implementation examples in public repos
- User mentions specific library/framework names
- Questions about "best practices" or "how does X work"

### Use read_file (MCP)
- Reading multiple related files at once
- Directory traversal with pattern matching
- Searching file content with regex
- Need to limit depth/file count for large directories
- Batch operations on multiple files
- Pattern-based filtering (glob + content regex)

### Use codex_lens
- Large codebase (>500 files) requiring repeated searches
- Need semantic understanding of code relationships
- Working across multiple sessions
- Symbol-level navigation needed
- Finding all implementations of interface/class
- Tracking function calls across codebase

### Use smart_search
- Unknown file locations
- Concept/semantic search ("authentication logic", "payment processing")
- Medium-sized codebase (100-500 files)
- One-time or infrequent searches
- Natural language queries about code structure

**Mode Selection**:
- `auto`: Let tool decide (default)
- `exact`: Known exact pattern
- `fuzzy`: Typo-tolerant search
- `semantic`: Concept-based search
- `graph`: Dependency analysis

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
