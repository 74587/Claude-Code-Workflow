# Hooks Integration for Progressive Disclosure

This document describes how to integrate session hooks with CCW's progressive disclosure system.

## Overview

CCW now supports automatic context injection via hooks. When a session starts, the system can automatically provide a progressive disclosure index showing related sessions from the same cluster.

## Features

- **Automatic Context Injection**: Session start hooks inject cluster context
- **Progressive Disclosure**: Shows related sessions, their summaries, and recovery commands
- **Silent Failure**: Hook failures don't block session start (< 5 seconds timeout)
- **Multiple Hook Types**: Supports `session-start`, `context`, and custom hooks

## Hook Configuration

### Location

Place hook configurations in `.claude/settings.json`:

```json
{
  "hooks": {
    "session-start": [
      {
        "name": "Progressive Disclosure",
        "description": "Injects progressive disclosure index at session start",
        "enabled": true,
        "handler": "internal:context",
        "timeout": 5000,
        "failMode": "silent"
      }
    ]
  }
}
```

### Hook Types

#### `session-start`
Triggered when a new session begins. Ideal for injecting context.

#### `context`
Triggered on explicit context requests. Same handler as `session-start`.

#### `session-end`
Triggered when a session ends. Useful for updating cluster metadata.

#### `file-modified`
Triggered when files are modified. Can be used for auto-commits or notifications.

### Hook Properties

- **`name`**: Human-readable hook name
- **`description`**: What the hook does
- **`enabled`**: Boolean to enable/disable the hook
- **`handler`**: `internal:context` for built-in context generation, or use `command` field
- **`command`**: Shell command to execute (alternative to `handler`)
- **`timeout`**: Maximum execution time in milliseconds (default: 5000)
- **`failMode`**: How to handle failures
  - `silent`: Ignore errors, don't log
  - `log`: Log errors but continue
  - `fail`: Abort on error
- **`async`**: Run in background without blocking (default: false)

### Available Variables

In `command` fields, use these variables:

- `$SESSION_ID`: Current session ID
- `$FILE_PATH`: File path (for file-modified hooks)
- `$PROJECT_PATH`: Current project path
- `$CLUSTER_ID`: Active cluster ID (if available)

## API Endpoint

### Trigger Hook

```bash
POST http://localhost:3456/api/hook
Content-Type: application/json

{
  "type": "session-start",
  "sessionId": "WFS-20241218-001",
  "projectPath": "/path/to/project"
}
```

### Response Format

```json
{
  "success": true,
  "type": "context",
  "format": "markdown",
  "content": "<ccw-session-context>...</ccw-session-context>",
  "sessionId": "WFS-20241218-001"
}
```

### Query Parameters

- `?path=/project/path`: Override project path
- `?format=markdown|json`: Response format (default: markdown)

## Progressive Disclosure Output Format

The hook returns a structured Markdown document:

```markdown
<ccw-session-context>
## 📋 Related Sessions Index

### 🔗 Active Cluster: {cluster_name} ({member_count} sessions)
**Intent**: {cluster_intent}

| # | Session | Type | Summary | Tokens |
|---|---------|------|---------|--------|
| 1 | WFS-001 | Workflow | Implement auth | ~1200 |
| 2 | CLI-002 | CLI | Fix login bug | ~800 |

**Resume Commands**:
```bash
# Load specific session
ccw core-memory load {session_id}

# Load entire cluster context
ccw core-memory load-cluster {cluster_id}
```

### 📊 Timeline
```
2024-12-15 ─●─ WFS-001 (Implement auth)
        │
2024-12-16 ─●─ CLI-002 (Fix login bug) ← Current
```

---
**Tip**: Use `ccw core-memory search <keyword>` to find more sessions
</ccw-session-context>
```

## Examples

### Example 1: Basic Session Start Hook

```json
{
  "hooks": {
    "session-start": [
      {
        "name": "Progressive Disclosure",
        "enabled": true,
        "handler": "internal:context",
        "timeout": 5000,
        "failMode": "silent"
      }
    ]
  }
}
```

### Example 2: Custom Command Hook

```json
{
  "hooks": {
    "session-end": [
      {
        "name": "Update Cluster",
        "enabled": true,
        "command": "ccw core-memory update-cluster --session $SESSION_ID",
        "timeout": 30000,
        "async": true,
        "failMode": "log"
      }
    ]
  }
}
```

### Example 3: File Modification Hook

```json
{
  "hooks": {
    "file-modified": [
      {
        "name": "Auto Commit",
        "enabled": false,
        "command": "git add $FILE_PATH && git commit -m '[Auto] Save: $FILE_PATH'",
        "timeout": 10000,
        "async": true,
        "failMode": "log"
      }
    ]
  }
}
```

## Implementation Details

### Handler: `internal:context`

The built-in context handler:

1. Determines the current session ID
2. Queries `SessionClusteringService` for related clusters
3. Retrieves cluster members and their metadata
4. Generates a progressive disclosure index
5. Returns formatted Markdown within `<ccw-session-context>` tags

### Timeout Behavior

- Hooks have a maximum execution time (default: 5 seconds)
- If timeout is exceeded, the hook is terminated
- Behavior depends on `failMode`:
  - `silent`: Continues without notification
  - `log`: Logs timeout error
  - `fail`: Aborts session start (not recommended)

### Error Handling

All errors are caught and handled according to `failMode`. The system ensures that hook failures never block the main workflow.

## Testing

### Test Hook Trigger

```bash
# Using curl
curl -X POST http://localhost:3456/api/hook \
  -H "Content-Type: application/json" \
  -d '{"type":"session-start","sessionId":"test-001"}'

# Using ccw (if CLI command exists)
ccw core-memory context --format markdown
```

### Expected Output

If a cluster exists:
- Table of related sessions
- Resume commands
- Timeline visualization

If no cluster exists:
- Message indicating no cluster found
- Commands to search or trigger clustering

## Troubleshooting

### Hook Not Triggering

1. Check that hooks are enabled in `.claude/settings.json`
2. Verify the hook type matches the event
3. Ensure the server is running on the correct port

### Timeout Issues

1. Increase `timeout` value for slow operations
2. Use `async: true` for long-running commands
3. Check logs for performance issues

### Empty Context

1. Ensure clustering has been run: `ccw core-memory cluster --auto`
2. Verify session metadata exists
3. Check that the session has been added to a cluster

## Performance Considerations

- Progressive disclosure index generation is fast (< 1 second typical)
- Uses cached metadata to avoid full session parsing
- Timeout enforced to prevent blocking
- Failures return empty content instead of errors

## Future Enhancements

- **Dynamic Clustering**: Real-time cluster updates during session
- **Multi-Cluster Support**: Show sessions from multiple related clusters
- **Relevance Scoring**: Sort sessions by relevance to current task
- **Token Budget**: Calculate total token usage for context loading
- **Hook Chains**: Execute multiple hooks in sequence
- **Conditional Hooks**: Execute hooks based on project state

## References

- **Session Clustering**: See `session-clustering-service.ts`
- **Core Memory Store**: See `core-memory-store.ts`
- **Hook Routes**: See `routes/hooks-routes.ts`
- **Example Configuration**: See `hooks-config-example.json`
