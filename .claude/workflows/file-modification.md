# File Modification

Before modifying files, always:
- Try built-in Edit tool first
- Escalate to MCP tools when built-ins fail
- Use write_file only as last resort

## MCP Tools Usage

### edit_file - Modify Files

**When**: Built-in Edit fails, need dry-run preview, or need line-based operations

**How**:
```javascript
edit_file(path="/file.ts", oldText="old", newText="new")              // Replace text
edit_file(path="/file.ts", oldText="old", newText="new", dryRun=true) // Preview diff
edit_file(path="/file.ts", oldText="old", newText="new", replaceAll=true) // Replace all
edit_file(path="/file.ts", mode="line", operation="insert_after", line=10, text="new line")
edit_file(path="/file.ts", mode="line", operation="delete", line=5, end_line=8)
```

**Modes**: `update` (replace text, default), `line` (line-based operations)

**Operations** (line mode): `insert_before`, `insert_after`, `replace`, `delete`

---

### write_file - Create/Overwrite Files

**When**: Create new files, completely replace content, or edit_file still fails

**How**:
```javascript
write_file(path="/new-file.ts", content="file content here")
write_file(path="/existing.ts", content="...", backup=true)  // Create backup first
```

---

## Priority Logic

**File Reading**:
1. Known single file → Built-in Read
2. Multiple files OR pattern matching → smart_search (MCP)
3. Unknown location → smart_search then Read
4. Large codebase + repeated access → smart_search (indexed)

**File Editing**:
1. Always try built-in Edit first
2. Fails 1+ times → edit_file (MCP)
3. Still fails → write_file (MCP)

**Search**:
1. External knowledge → Exa (MCP)
2. Exact pattern in small codebase → Built-in Grep
3. Semantic/unknown location → smart_search (MCP)
4. Large codebase + repeated searches → smart_search (indexed)

## Decision Triggers

**Start with simplest tool** (Read, Edit, Grep)
**Escalate to MCP tools** when built-ins fail or inappropriate
**Use semantic search** for exploratory tasks
**Use indexed search** for large, stable codebases
**Use Exa** for external/public knowledge
