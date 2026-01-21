# Memory Embedder - Quick Reference

## Installation

```bash
pip install numpy codex-lens[semantic]
```

## Commands

### Status
```bash
python scripts/memory_embedder.py status <db_path>
```

### Embed All
```bash
python scripts/memory_embedder.py embed <db_path>
```

### Embed Specific Source
```bash
python scripts/memory_embedder.py embed <db_path> --source-id CMEM-20250101-120000
```

### Re-embed (Force)
```bash
python scripts/memory_embedder.py embed <db_path> --force
```

### Search
```bash
python scripts/memory_embedder.py search <db_path> "authentication flow"
```

### Advanced Search
```bash
python scripts/memory_embedder.py search <db_path> "rate limiting" \
  --top-k 5 \
  --min-score 0.5 \
  --type workflow
```

## Database Path

Find your database:
```bash
# Linux/Mac
~/.ccw/projects/<project-id>/core-memory/core_memory.db

# Windows
%USERPROFILE%\.ccw\projects\<project-id>\core-memory\core_memory.db
```

## TypeScript Integration

```typescript
import { execSync } from 'child_process';

// Status
const status = JSON.parse(
  execSync(`python scripts/memory_embedder.py status "${dbPath}"`, {
    encoding: 'utf-8'
  })
);

// Embed
const result = JSON.parse(
  execSync(`python scripts/memory_embedder.py embed "${dbPath}"`, {
    encoding: 'utf-8'
  })
);

// Search
const matches = JSON.parse(
  execSync(
    `python scripts/memory_embedder.py search "${dbPath}" "query"`,
    { encoding: 'utf-8' }
  )
);
```

## Output Examples

### Status
```json
{
  "total_chunks": 150,
  "embedded_chunks": 100,
  "pending_chunks": 50,
  "by_type": {
    "core_memory": {"total": 80, "embedded": 60, "pending": 20}
  }
}
```

### Embed
```json
{
  "success": true,
  "chunks_processed": 50,
  "chunks_failed": 0,
  "elapsed_time": 12.34
}
```

### Search
```json
{
  "success": true,
  "matches": [
    {
      "source_id": "WFS-20250101-auth",
      "source_type": "workflow",
      "chunk_index": 2,
      "content": "Implemented JWT authentication...",
      "score": 0.8542,
      "restore_command": "ccw session resume WFS-20250101-auth"
    }
  ]
}
```

## Source Types

- `core_memory` - Strategic architectural context
- `workflow` - Session-based development history
- `cli_history` - Command execution logs

## Performance

- Embedding: ~8 chunks/second
- Search: ~0.1-0.5s for 1000 chunks
- Model load: ~0.8s (cached)
- Batch size: 8 (default, configurable)
