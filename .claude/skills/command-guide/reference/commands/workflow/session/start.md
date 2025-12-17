---
name: start
description: Discover existing sessions or start new workflow session with intelligent session management and conflict detection
argument-hint: [--type <workflow|review|tdd|test|docs>] [--auto|--new] [optional: task description for new session]
examples:
  - /workflow:session:start
  - /workflow:session:start --auto "implement OAuth2 authentication"
  - /workflow:session:start --type review "Code review for auth module"
  - /workflow:session:start --type tdd --auto "implement user authentication"
  - /workflow:session:start --type test --new "test payment flow"
---

# Start Workflow Session (/workflow:session:start)

## Overview
Manages workflow sessions with three operation modes: discovery (manual), auto (intelligent), and force-new.

**Dual Responsibility**:
1. **Project-level initialization** (first-time only): Creates `.workflow/project.json` for feature registry
2. **Session-level initialization** (always): Creates session directory structure

## Session Types

The `--type` parameter classifies sessions for CCW dashboard organization:

| Type | Description | Default For |
|------|-------------|-------------|
| `workflow` | Standard implementation (default) | `/workflow:plan` |
| `review` | Code review sessions | `/workflow:review-module-cycle` |
| `tdd` | TDD-based development | `/workflow:tdd-plan` |
| `test` | Test generation/fix sessions | `/workflow:test-fix-gen` |
| `docs` | Documentation sessions | `/memory:docs` |
| `lite-plan` | Lightweight planning workflow | `/workflow:lite-plan` |
| `lite-fix` | Lightweight bug fix workflow | `/workflow:lite-fix` |

**Special Behavior for `lite-plan` and `lite-fix`**:
- These types automatically infer the storage location (`.workflow/.lite-plan/` or `.workflow/.lite-fix/`)
- No need to specify `--location` parameter when using these types
- Alternative: Use `--location lite-plan` or `--location lite-fix` directly

**Validation**: If `--type` is provided with invalid value, return error:
```
ERROR: Invalid session type. Valid types: workflow, review, tdd, test, docs, lite-plan, lite-fix
```

## Step 0: Initialize Project State (First-time Only)

**Executed before all modes** - Ensures project-level state file exists by calling `/workflow:init`.

### Check and Initialize
```bash
# Check if project state exists
bash(test -f .workflow/project.json && echo "EXISTS" || echo "NOT_FOUND")
```

**If NOT_FOUND**, delegate to `/workflow:init`:
```javascript
// Call workflow:init for intelligent project analysis
SlashCommand({command: "/workflow:init"});

// Wait for init completion
// project.json will be created with comprehensive project overview
```

**Output**:
- If EXISTS: `PROJECT_STATE: initialized`
- If NOT_FOUND: Calls `/workflow:init` → creates `.workflow/project.json` with full project analysis

**Note**: `/workflow:init` uses cli-explore-agent to build comprehensive project understanding (technology stack, architecture, key components). This step runs once per project. Subsequent executions skip initialization.

## Mode 1: Discovery Mode (Default)

### Usage
```bash
/workflow:session:start
```

### Step 1: List Active Sessions
```bash
ccw session list --location active
```

### Step 2: Display Session Metadata
```bash
ccw session WFS-promptmaster-platform read workflow-session.json
```

### Step 4: User Decision
Present session information and wait for user to select or create session.

**Output**: `SESSION_ID: WFS-[user-selected-id]`

## Mode 2: Auto Mode (Intelligent)

### Usage
```bash
/workflow:session:start --auto "task description"
```

### Step 1: Check Active Sessions Count
```bash
ccw session list --location active
# Check result.total in response
```

### Step 2a: No Active Sessions → Create New
```bash
# Generate session slug from description
# Pattern: WFS-{lowercase-slug-from-description}

# Create session with ccw (creates directories + metadata atomically)
ccw session init WFS-implement-oauth2-auth --type workflow
```

**Output**: `SESSION_ID: WFS-implement-oauth2-auth`

### Step 2b: Single Active Session → Check Relevance
```bash
# Get session list with metadata
ccw session list --location active

# Read session metadata for relevance check
ccw session WFS-promptmaster-platform read workflow-session.json

# If task contains project keywords → Reuse session
# If task unrelated → Create new session (use Step 2a)
```

**Output (reuse)**: `SESSION_ID: WFS-promptmaster-platform`
**Output (new)**: `SESSION_ID: WFS-[new-slug]`

### Step 2c: Multiple Active Sessions → Use First
```bash
# Get first active session from list
ccw session list --location active
# Use first session_id from result.active array

# Output warning and session ID
# WARNING: Multiple active sessions detected
# SESSION_ID: WFS-first-session
```

## Mode 3: Force New Mode

### Usage
```bash
/workflow:session:start --new "task description"
```

### Step 1: Generate Unique Session Slug
```bash
# Convert description to slug: lowercase, alphanumeric + hyphen, max 50 chars
# Check if exists via ccw session list, add counter if collision
ccw session list --location active
```

### Step 2: Create Session Structure
```bash
# Basic init - creates directories + default metadata
ccw session init WFS-fix-login-bug --type workflow

# Advanced init - with custom metadata
ccw session init WFS-oauth-implementation --type workflow --content '{"description":"OAuth2 authentication system","priority":"high","complexity":"medium"}'
```

**Default Metadata** (auto-generated):
```json
{
  "session_id": "WFS-fix-login-bug",
  "type": "workflow",
  "status": "planning",
  "created_at": "2025-12-17T..."
}
```

**Custom Metadata** (merged with defaults):
```json
{
  "session_id": "WFS-oauth-implementation",
  "type": "workflow",
  "status": "planning",
  "created_at": "2025-12-17T...",
  "description": "OAuth2 authentication system",
  "priority": "high",
  "complexity": "medium"
}
```

**Field Usage**:
- `description`: Displayed in dashboard (replaces session_id as title)
- `status`: Can override default "planning" (e.g., "active", "implementing")
- Custom fields: Any additional fields are saved and accessible programmatically

**Output**: `SESSION_ID: WFS-fix-login-bug`

## Execution Guideline

- **Non-interrupting**: When called from other commands, this command completes and returns control to the caller without interrupting subsequent tasks.

## Output Format Specification

### Success
```
SESSION_ID: WFS-session-slug
```

### Error
```
ERROR: --auto mode requires task description
ERROR: Failed to create session directory
```

### Analysis (Auto Mode)
```
ANALYSIS: Task relevance = high
DECISION: Reusing existing session
SESSION_ID: WFS-promptmaster-platform
```


## Session ID Format
- Pattern: `WFS-[lowercase-slug]`
- Characters: `a-z`, `0-9`, `-` only
- Max length: 50 characters
- Uniqueness: Add numeric suffix if collision (`WFS-auth-2`, `WFS-auth-3`)

## session_manager Tool Alternative

The above bash commands can be replaced with `ccw tool exec session_manager`:

### List Sessions
```bash
# List active sessions with metadata
ccw tool exec session_manager '{"operation":"list","location":"active","include_metadata":true}'

# Response: {"success":true,"result":{"active":[{"session_id":"WFS-xxx","metadata":{...}}],"total":1}}
```

### Create Session (replaces mkdir + echo)
```bash
# Single command creates directories + metadata
ccw tool exec session_manager '{
  "operation": "init",
  "session_id": "WFS-my-session",
  "metadata": {
    "project": "my project description",
    "status": "planning",
    "type": "workflow",
    "created_at": "2025-12-10T08:00:00Z"
  }
}'
```

### Read Session Metadata
```bash
ccw tool exec session_manager '{"operation":"read","session_id":"WFS-xxx","content_type":"session"}'
```
