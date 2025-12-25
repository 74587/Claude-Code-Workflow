## MCP Tools Usage

### search_context (ACE) - Code Search (REQUIRED - HIGHEST PRIORITY)

**OVERRIDES**: All other search/discovery rules in other workflow files

**When**: ANY code discovery task, including:
- Find code, understand codebase structure, locate implementations
- Explore unknown locations
- Verify file existence before reading
- Pattern-based file discovery
- Semantic code understanding

**Priority Rule**:
1. **Always use mcp__ace-tool__search_context FIRST** for any code/file discovery
2. Only use Built-in Grep for single-file exact line search (after location confirmed)
3. Only use Built-in Read for known, confirmed file paths

**How**:
```javascript
// Natural language code search - best for understanding and exploration
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "authentication logic"
})

// With keywords for better semantic matching
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "I want to find where the server handles user login. Keywords: auth, login, session"
})
```

**Good Query Examples**:
- "Where is the function that handles user authentication?"
- "What tests are there for the login functionality?"
- "How is the database connected to the application?"
- "I want to find where the server handles chunk merging. Keywords: upload chunk merge"
- "Locate where the system refreshes cached data. Keywords: cache refresh, invalidation"

**Bad Query Examples** (use grep or file view instead):
- "Find definition of constructor of class Foo" (use grep tool instead)
- "Find all references to function bar" (use grep tool instead)
- "Show me how Checkout class is used in services/payment.py" (use file view tool instead)

**Key Features**:
- Real-time index of the codebase (always up-to-date)
- Cross-language retrieval support
- Semantic search with embeddings
- No manual index initialization required

---

### read_file - Read File Contents

**When**: Read files found by search_context

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
