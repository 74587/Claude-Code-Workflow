# Tool Strategy

## ⚡ Exa Triggering Mechanisms

**Auto-Trigger**:
- User mentions "exa-code" or code-related queries → `mcp__exa__get_code_context_exa`
- Need current web information → `mcp__exa__web_search_exa`

**Manual Trigger**:
- Complex API research → Exa Code Context
- Real-time information needs → Exa Web Search

## ⚡ CCW MCP Tools


### edit_file

**When to Use**: Edit tool fails 1+ times on same file

```
mcp__ccw-tools__edit_file(path="file.py", oldText="old", newText="new")
mcp__ccw-tools__edit_file(path="file.py", oldText="old", newText="new", dryRun=true)
mcp__ccw-tools__edit_file(path="file.py", oldText="old", newText="new", replaceAll=true)
mcp__ccw-tools__edit_file(path="file.py", mode="line", operation="insert_after", line=10, text="new line")
```

**Options**: `dryRun` (preview diff), `replaceAll`, `mode` (update|line), `operation`, `line`, `text`

### write_file

**When to Use**: Create new files or overwrite existing content

```
mcp__ccw-tools__write_file(path="file.txt", content="Hello")
mcp__ccw-tools__write_file(path="file.txt", content="code with `backticks` and ${vars}", backup=true)
```

**Options**: `backup`, `createDirectories`, `encoding`

### read_file

**When to Use**: Read multiple files, directory traversal, content search

```
mcp__ccw-tools__read_file(paths="file.ts")                         # Single file
mcp__ccw-tools__read_file(paths=["a.ts", "b.ts"])                  # Multiple files
mcp__ccw-tools__read_file(paths="src/", pattern="*.ts")            # Directory + glob
mcp__ccw-tools__read_file(paths="src/", contentPattern="TODO")     # Regex search
```

**Options**: `pattern`, `contentPattern`, `maxDepth` (3), `includeContent` (true), `maxFiles` (50)

### codex_lens

**When to Use**: Code indexing, semantic search, cache management

```
mcp__ccw-tools__codex_lens(action="init", path=".")
mcp__ccw-tools__codex_lens(action="search", query="function main", path=".")
mcp__ccw-tools__codex_lens(action="search_files", query="pattern", limit=20)
mcp__ccw-tools__codex_lens(action="symbol", file="src/main.py")
mcp__ccw-tools__codex_lens(action="status")
mcp__ccw-tools__codex_lens(action="config_show")
mcp__ccw-tools__codex_lens(action="config_set", key="index_dir", value="/path")
mcp__ccw-tools__codex_lens(action="config_migrate", newPath="/new/path")
mcp__ccw-tools__codex_lens(action="clean", path=".")
mcp__ccw-tools__codex_lens(action="clean", all=true)
```

**Actions**: `init`, `search`, `search_files`, `symbol`, `status`, `config_show`, `config_set`, `config_migrate`, `clean`

### smart_search

**When to Use**: Quick search without indexing, natural language queries

```
mcp__ccw-tools__smart_search(query="function main", path=".")
mcp__ccw-tools__smart_search(query="def init", mode="exact")
mcp__ccw-tools__smart_search(query="authentication logic", mode="semantic")
```

**Modes**: `auto` (default), `exact`, `fuzzy`, `semantic`, `graph`

### Fallback Strategy

1. **Edit fails 1+ times** → `mcp__ccw-tools__edit_file`
2. **Still fails** → `mcp__ccw-tools__write_file`

