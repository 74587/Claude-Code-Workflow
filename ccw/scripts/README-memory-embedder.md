# Memory Embedder

Bridge CCW to CodexLens semantic search by generating and searching embeddings for memory chunks.

## Features

- **Generate embeddings** for memory chunks using CodexLens's jina-embeddings-v2-base-code (768 dim)
- **Semantic search** across all memory types (core_memory, workflow, cli_history)
- **Status tracking** to monitor embedding progress
- **Batch processing** for efficient embedding generation
- **Restore commands** included in search results

## Requirements

```bash
pip install numpy codexlens[semantic]
```

## Usage

### 1. Check Status

```bash
python scripts/memory_embedder.py status <db_path>
```

Example output:
```json
{
  "total_chunks": 150,
  "embedded_chunks": 100,
  "pending_chunks": 50,
  "by_type": {
    "core_memory": {"total": 80, "embedded": 60, "pending": 20},
    "workflow": {"total": 50, "embedded": 30, "pending": 20},
    "cli_history": {"total": 20, "embedded": 10, "pending": 10}
  }
}
```

### 2. Generate Embeddings

Embed all unembedded chunks:
```bash
python scripts/memory_embedder.py embed <db_path>
```

Embed specific source:
```bash
python scripts/memory_embedder.py embed <db_path> --source-id CMEM-20250101-120000
```

Re-embed all chunks (force):
```bash
python scripts/memory_embedder.py embed <db_path> --force
```

Adjust batch size (default 8):
```bash
python scripts/memory_embedder.py embed <db_path> --batch-size 16
```

Example output:
```json
{
  "success": true,
  "chunks_processed": 50,
  "chunks_failed": 0,
  "elapsed_time": 12.34
}
```

### 3. Semantic Search

Basic search:
```bash
python scripts/memory_embedder.py search <db_path> "authentication flow"
```

Advanced search:
```bash
python scripts/memory_embedder.py search <db_path> "rate limiting" \
  --top-k 5 \
  --min-score 0.5 \
  --type workflow
```

Example output:
```json
{
  "success": true,
  "matches": [
    {
      "source_id": "WFS-20250101-auth",
      "source_type": "workflow",
      "chunk_index": 2,
      "content": "Implemented JWT-based authentication...",
      "score": 0.8542,
      "restore_command": "ccw session resume WFS-20250101-auth"
    }
  ]
}
```

## Database Path

The database is located in CCW's storage directory:

- **Windows**: `%USERPROFILE%\.ccw\projects\<project-id>\core-memory\core_memory.db`
- **Linux/Mac**: `~/.ccw/projects/<project-id>/core-memory/core_memory.db`

Find your project's database:
```bash
ccw memory list  # Shows project path
# Then look in: ~/.ccw/projects/<hashed-path>/core-memory/core_memory.db
```

## Integration with CCW

This script is designed to be called from CCW's TypeScript code:

```typescript
import { execSync } from 'child_process';

// Embed chunks
const result = execSync(
  `python scripts/memory_embedder.py embed ${dbPath}`,
  { encoding: 'utf-8' }
);
const { success, chunks_processed } = JSON.parse(result);

// Search
const searchResult = execSync(
  `python scripts/memory_embedder.py search ${dbPath} "${query}" --top-k 10`,
  { encoding: 'utf-8' }
);
const { matches } = JSON.parse(searchResult);
```

## Performance

- **Embedding speed**: ~8 chunks/second (batch size 8)
- **Search speed**: ~0.1-0.5 seconds for 1000 chunks
- **Model loading**: ~0.8 seconds (cached after first use)

## Source Types

- `core_memory`: Strategic architectural context
- `workflow`: Session-based development history
- `cli_history`: Command execution logs

## Restore Commands

Search results include restore commands:

- **core_memory/cli_history**: `ccw memory export <source_id>`
- **workflow**: `ccw session resume <source_id>`
