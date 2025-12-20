## MCP Tools Usage

### smart_search - Code Search (REQUIRED)

**When**: Find code, understand codebase structure, locate implementations

**Workflow** (search first, init if needed):
```javascript
// Step 1: Try search directly (works if index exists or uses ripgrep fallback)
smart_search(query="authentication logic")

// Step 2: Only if search warns "No CodexLens index found", then init
smart_search(action="init", path=".")   // Creates FTS index only

// Note: For semantic/vector search, use "ccw view" dashboard to create vector index
```

**Modes**: `auto` (intelligent routing), `hybrid` (semantic, needs vector index), `exact` (FTS), `ripgrep` (no index)

---

### read_file - Read File Contents

**When**: Read files found by smart_search

**How**:
```javascript
read_file(path="/path/to/file.ts")                   // Single file
read_file(path="/src/**/*.config.ts")                // Pattern matching
```

---

### edit_file - Modify Files

**When**: Built-in Edit tool fails or need advanced features

**How**:
```javascript
edit_file(path="/file.ts", old_string="...", new_string="...", mode="update")
edit_file(path="/file.ts", line=10, content="...", mode="insert_after")
```

**Modes**: `update` (replace text), `insert_after`, `insert_before`, `delete_line`

---

### write_file - Create/Overwrite Files

**When**: Create new files or completely replace content

**How**:
```javascript
write_file(path="/new-file.ts", content="...")
```

---

### Exa - External Search

**When**: Find documentation/examples outside codebase

**How**:
```javascript
mcp__exa__search(query="React hooks 2025 documentation")
mcp__exa__search(query="FastAPI auth example", numResults=10)
mcp__exa__search(query="latest API docs", livecrawl="always")
```

**Parameters**:
- `query` (required): Search query string
- `numResults` (optional): Number of results to return (default: 5)
- `livecrawl` (optional): `"always"` or `"fallback"` for live crawling
