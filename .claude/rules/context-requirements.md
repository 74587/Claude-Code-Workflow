# Context Requirements

Before implementation, always:

- Identify 3+ existing similar patterns before implementation
- Map dependencies and integration points
- Understand testing framework and coding conventions

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