# Claude Code Hooks - Official Reference

> Complete official reference from https://code.claude.com/docs/en/hooks

## Hooks reference

This is the complete technical reference for Claude Code hooks.

### Hook events reference

#### SessionStart

**When it fires:** When a session begins or resumes

**Matchers:**
- `startup` - New session
- `resume` - `--resume`, `--continue`, or `/resume`
- `clear` - `/clear`
- `compact` - Auto or manual compaction

**Input schema:**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup|resume|clear|compact",
  "model": "claude-sonnet-4-5-20250929"
}
```

**Output control:**
- Exit 0: Text written to stdout is added to Claude's context
- Can use `additionalContext` in JSON output
- Cannot block session start

**Special variables:**
- `CLAUDE_ENV_FILE`: Write `export` statements to persist environment variables

#### UserPromptSubmit

**When it fires:** When user submits a prompt, before Claude processes it

**Input schema:**
```json
{
  "session_id": "abc123",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "User's prompt text here"
}
```

**Output control:**
- Exit 0: Plain text stdout is added as context
- `decision: "block"` prevents prompt processing
- `additionalContext` adds context to Claude

#### PreToolUse

**When it fires:** Before a tool call executes

**Matchers:** Tool names (Bash, Edit, Write, Read, etc.)

**Tool input schemas:**
- `Bash`: `command`, `description`, `timeout`, `run_in_background`
- `Write`: `file_path`, `content`
- `Edit`: `file_path`, `old_string`, `new_string`, `replace_all`
- `Read`: `file_path`, `offset`, `limit`
- `Glob`: `pattern`, `path`
- `Grep`: `pattern`, `path`, `glob`, `output_mode`, `-i`, `multiline`
- `WebFetch`: `url`, `prompt`
- `WebSearch`: `query`, `allowed_domains`, `blocked_domains`
- `Task`: `prompt`, `description`, `subagent_type`, `model`

**Output control:**
- `permissionDecision`: `"allow"`, `"deny"`, `"ask"`
- `permissionDecisionReason`: Explanation
- `updatedInput`: Modify tool input before execution
- `additionalContext`: Add context to Claude

#### PermissionRequest

**When it fires:** When permission dialog appears

**Input schema:** Similar to PreToolUse but fires when permission needed

**Output control:**
- `decision.behavior`: `"allow"` or `"deny"`
- `decision.updatedInput`: Modify input before execution
- `decision.message`: For deny, tells Claude why

#### PostToolUse

**When it fires:** After a tool call succeeds

**Input schema:** Includes both `tool_input` and `tool_response`

**Output control:**
- `decision: "block"` to flag issue to Claude
- `additionalContext`: Add context
- `updatedMCPToolOutput`: For MCP tools, replace output

#### PostToolUseFailure

**When it fires:** After a tool call fails

**Input schema:** Includes `error` and `is_interrupt` fields

**Output control:**
- `additionalContext`: Provide context about the failure

#### Notification

**When it fires:** When Claude Code sends a notification

**Matchers:**
- `permission_prompt` - Permission needed
- `idle_prompt` - Claude idle
- `auth_success` - Auth successful
- `elicitation_dialog` - Dialog shown

**Input schema:**
```json
{
  "hook_event_name": "Notification",
  "message": "Notification text",
  "title": "Title",
  "notification_type": "permission_prompt|idle_prompt|..."
}
```

#### SubagentStart

**When it fires:** When subagent is spawned

**Matchers:** Agent types (Bash, Explore, Plan, or custom)

**Input schema:**
```json
{
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

**Output control:**
- `additionalContext`: Add context to subagent

#### SubagentStop

**When it fires:** When subagent finishes

**Input schema:** Similar to SubagentStart with `stop_hook_active` field

#### Stop

**When it fires:** When Claude finishes responding

**Input schema:**
```json
{
  "hook_event_name": "Stop",
  "stop_hook_active": false|true
}
```

**Output control:**
- `decision: "block"` prevents Claude from stopping
- `reason`: Required when blocking, tells Claude why to continue
- Check `stop_hook_active` to prevent infinite loops

#### PreCompact

**When it fires:** Before context compaction

**Matchers:**
- `manual` - `/compact`
- `auto` - Auto-compact when context full

**Input schema:**
```json
{
  "hook_event_name": "PreCompact",
  "trigger": "manual|auto",
  "custom_instructions": ""
}
```

#### SessionEnd

**When it fires:** When session terminates

**Matchers:**
- `clear` - `/clear`
- `logout` - User logged out
- `prompt_input_exit` - User exited during prompt
- `bypass_permissions_disabled` - Bypass disabled
- `other` - Other reasons

**Input schema:**
```json
{
  "hook_event_name": "SessionEnd",
  "reason": "clear|logout|..."
}
```

### Prompt-based hooks

**Type:** `"prompt"`

**Configuration:**
```json
{
  "type": "prompt",
  "prompt": "Your prompt here. Use $ARGUMENTS for input JSON",
  "model": "haiku",
  "timeout": 30
}
```

**Response schema:**
```json
{
  "ok": true|false,
  "reason": "Explanation if ok is false"
}
```

### Agent-based hooks

**Type:** `"agent"`

**Configuration:**
```json
{
  "type": "agent",
  "prompt": "Your prompt here. Use $ARGUMENTS for input JSON",
  "model": "haiku",
  "timeout": 60
}
```

**Response schema:** Same as prompt hooks

### Async hooks

**For command hooks only:**
```json
{
  "type": "command",
  "command": "...",
  "async": true,
  "timeout": 300
}
```

- Doesn't block Claude's execution
- Cannot return decisions
- Output delivered on next conversation turn
- Max 50 turns per session

---

See https://code.claude.com/docs/en/hooks for full reference
