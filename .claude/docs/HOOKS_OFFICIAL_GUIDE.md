# Claude Code Hooks - Official Guide

> Complete official documentation from https://code.claude.com/docs/en/hooks-guide

## Automate workflows with hooks

Run shell commands automatically when Claude Code edits files, finishes tasks, or needs input. Format code, send notifications, validate commands, and enforce project rules.

### Hook lifecycle

Hooks fire at specific points during a Claude Code session. The official hook events are:

| Event                | When it fires                                        |
| :------------------- | :--------------------------------------------------- |
| `SessionStart`       | When a session begins or resumes                     |
| `UserPromptSubmit`   | When you submit a prompt, before Claude processes it |
| `PreToolUse`         | Before a tool call executes. Can block it            |
| `PermissionRequest`  | When a permission dialog appears                     |
| `PostToolUse`        | After a tool call succeeds                           |
| `PostToolUseFailure` | After a tool call fails                              |
| `Notification`       | When Claude Code sends a notification                |
| `SubagentStart`      | When a subagent is spawned                           |
| `SubagentStop`       | When a subagent finishes                             |
| `Stop`               | When Claude finishes responding                      |
| `PreCompact`         | Before context compaction                            |
| `SessionEnd`         | When a session terminates                            |

### Hook handler types

There are three types of hook handlers:

1. **Command hooks** (`type: "command"`): Run a shell command
2. **Prompt hooks** (`type: "prompt"`): Use Claude model for single-turn evaluation
3. **Agent hooks** (`type: "agent"`): Spawn subagent with tool access

### Configuration structure

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName|AnotherTool",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/script.sh",
            "timeout": 600,
            "async": false
          }
        ]
      }
    ]
  }
}
```

### Hook input (stdin)

Common fields for all events:
- `session_id`: Current session ID
- `transcript_path`: Path to conversation JSON
- `cwd`: Current working directory
- `permission_mode`: Current permission mode
- `hook_event_name`: Name of the event that fired

Event-specific fields depend on the event type.

### Hook output (exit codes and stdout)

- **Exit 0**: Success. Parse stdout for JSON decision
- **Exit 2**: Blocking error. stderr text becomes Claude's feedback
- **Any other code**: Non-blocking error

### Tool matchers

Available for: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`

Tool names:
- Built-in: `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`
- MCP tools: `mcp__<server>__<tool>` (e.g., `mcp__github__search_repositories`)

### Event matchers

Different events match on different fields:
- `SessionStart`: `startup`, `resume`, `clear`, `compact`
- `SessionEnd`: `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`
- `Notification`: `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`
- `SubagentStart`/`SubagentStop`: agent type (e.g., `Bash`, `Explore`, `Plan`)
- `PreCompact`: `manual`, `auto`

### Hook configuration locations

| Location | Scope |
|----------|-------|
| `~/.claude/settings.json` | All your projects |
| `.claude/settings.json` | Single project |
| `.claude/settings.local.json` | Single project (gitignored) |
| Plugin `hooks/hooks.json` | When plugin enabled |
| Skill/Agent frontmatter | While component active |

### Best practices

✅ **DO:**
- Use command hooks for deterministic actions
- Use prompt hooks for judgment-based decisions
- Use agent hooks when verification requires file inspection
- Quote all shell variables: `"$VAR"`
- Use absolute paths with `$CLAUDE_PROJECT_DIR`
- Set appropriate timeouts
- Use async hooks for long-running operations
- Keep hooks fast (< 10 seconds by default)

❌ **DON'T:**
- Trust input data blindly
- Use relative paths
- Put sensitive data in hook output
- Create infinite loops in Stop hooks
- Run blocking operations without async

---

See https://code.claude.com/docs/en/hooks-guide for complete guide
See https://code.claude.com/docs/en/hooks for reference documentation
