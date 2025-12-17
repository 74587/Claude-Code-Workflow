# Context Requirements

Before implementation, always:
- Identify 3+ existing similar patterns
- Map dependencies and integration points
- Understand testing framework and coding conventions

## Context Gathering

**MANDATORY**: Use `codex_lens` (MCP tool) for all code search and analysis.

### codex_lens (REQUIRED)

**MCP Actions**: `init`, `search`, `search_files` (Advanced ops via CLI: `codexlens --help`)

**Initialize**:
```
codex_lens(action="init", path=".")
```
- Auto-generates embeddings if `fastembed` installed
- Skip with `--no-embeddings` flag

**Search** (Auto hybrid mode):
```
codex_lens(action="search", query="authentication")
```
**Search Files**:
```
codex_lens(action="search_files", query="payment")
```

### read_file (MCP)
- Read files found by codex_lens
- Directory traversal with patterns
- Batch operations

### smart_search
- Fallback when codex_lens unavailable
- Small projects (<100 files)

### Exa
- External APIs, libraries, frameworks
- Recent documentation beyond knowledge cutoff
- Public implementation examples
