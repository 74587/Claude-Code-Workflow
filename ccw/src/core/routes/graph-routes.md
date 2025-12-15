# Graph Routes API Documentation

## Overview
The Graph Routes module provides REST API endpoints for querying and visualizing code structure data from CodexLens indices. It exposes symbols and their relationships as graph nodes and edges.

## Endpoints

### GET /api/graph/nodes
Query all symbols from the CodexLens SQLite database and return them as graph nodes.

**Query Parameters:**
- `path` (optional): Project path. Defaults to server's initial path.

**Response:**
```json
{
  "nodes": [
    {
      "id": "src/file.ts:functionName:10",
      "name": "functionName",
      "type": "FUNCTION",
      "file": "src/file.ts",
      "line": 10,
      "docstring": "function_type",
      "tokenCount": 45
    }
  ]
}
```

**Node Types:**
- `FUNCTION`: Functions and procedures
- `CLASS`: Classes, interfaces, and type definitions
- `METHOD`: Class methods
- `VARIABLE`: Variables and constants
- `MODULE`: Module-level definitions

---

### GET /api/graph/edges
Query all code relationships from the CodexLens SQLite database and return them as graph edges.

**Query Parameters:**
- `path` (optional): Project path. Defaults to server's initial path.

**Response:**
```json
{
  "edges": [
    {
      "source": "src/file.ts:caller:10",
      "target": "module.callee",
      "type": "CALLS",
      "sourceLine": 10,
      "sourceFile": "src/file.ts"
    }
  ]
}
```

**Edge Types:**
- `CALLS`: Function/method invocations
- `IMPORTS`: Import/require relationships
- `INHERITS`: Class inheritance

---

### GET /api/graph/impact
Get impact analysis for a symbol - determines what code is affected if this symbol changes.

**Query Parameters:**
- `path` (optional): Project path. Defaults to server's initial path.
- `symbol` (required): Symbol ID in format `file:name:line`

**Response:**
```json
{
  "directDependents": [
    "src/other.ts:caller:20",
    "src/another.ts:user:35"
  ],
  "affectedFiles": [
    "src/other.ts",
    "src/another.ts"
  ]
}
```

---

## Implementation Details

### PathMapper
Maps source code paths to CodexLens index database paths following the storage structure:
- Windows: `D:\path\to\project` → `~/.codexlens/indexes/D/path/to/project/_index.db`
- Unix: `/home/user/project` → `~/.codexlens/indexes/home/user/project/_index.db`

### Database Schema
Queries two main tables:
1. **symbols** - Code symbol definitions
   - `id`, `file_id`, `name`, `kind`, `start_line`, `end_line`, `token_count`, `symbol_type`
2. **code_relationships** - Inter-symbol dependencies
   - `id`, `source_symbol_id`, `target_qualified_name`, `relationship_type`, `source_line`, `target_file`

### Error Handling
- Returns empty arrays (`[]`) if index database doesn't exist
- Returns 500 with error message on database query failures
- Returns 400 if required parameters are missing

### Type Mappings

**Symbol Kinds → Node Types:**
```typescript
{
  'function' → 'FUNCTION',
  'class' → 'CLASS',
  'method' → 'METHOD',
  'variable' → 'VARIABLE',
  'module' → 'MODULE',
  'interface' → 'CLASS',
  'type' → 'CLASS'
}
```

**Relationship Types → Edge Types:**
```typescript
{
  'call' → 'CALLS',
  'import' → 'IMPORTS',
  'inherits' → 'INHERITS',
  'uses' → 'CALLS'
}
```

---

## Usage Examples

### Fetch All Nodes
```bash
curl "http://localhost:3000/api/graph/nodes?path=/path/to/project"
```

### Fetch All Edges
```bash
curl "http://localhost:3000/api/graph/edges?path=/path/to/project"
```

### Analyze Impact
```bash
curl "http://localhost:3000/api/graph/impact?path=/path/to/project&symbol=src/file.ts:functionName:10"
```

---

## Integration with CodexLens

This module requires:
1. CodexLens to be installed and initialized (`/api/codexlens/init`)
2. Project to be indexed (creates `_index.db` files)
3. better-sqlite3 package for direct database access

## Dependencies
- `better-sqlite3`: Direct SQLite database access
- `codex-lens`: Python package providing the indexing infrastructure
- `path`, `fs`, `os`: Node.js built-in modules for file system operations
