# Phase 1: Session Discovery

Discover existing sessions or start new workflow session with intelligent session management and conflict detection.

## Objective

- Ensure project-level state exists (first-time initialization)
- Create or discover workflow session for the planning workflow
- Generate unique session ID (WFS-xxx format)
- Initialize session directory structure

## Step 0: Initialize Project State (First-time Only)

**Executed before all modes** - Ensures project-level state files exist by calling `/workflow:init`.

### Check and Initialize
```bash
# Check if project state exists (both files required)
bash(test -f .workflow/project-tech.json && echo "TECH_EXISTS" || echo "TECH_NOT_FOUND")
bash(test -f .workflow/project-guidelines.json && echo "GUIDELINES_EXISTS" || echo "GUIDELINES_NOT_FOUND")
```

**If either NOT_FOUND**, delegate to `/workflow:init`:
```javascript
// Call workflow:init for intelligent project analysis
Skill(skill="workflow:init");

// Wait for init completion
// project-tech.json and project-guidelines.json will be created
```

**Output**:
- If BOTH_EXIST: `PROJECT_STATE: initialized`
- If NOT_FOUND: Calls `/workflow:init` → creates:
  - `.workflow/project-tech.json` with full technical analysis
  - `.workflow/project-guidelines.json` with empty scaffold

**Note**: `/workflow:init` uses cli-explore-agent to build comprehensive project understanding (technology stack, architecture, key components). This step runs once per project. Subsequent executions skip initialization.

## Execution

### Step 1.1: Execute Session Start

```javascript
Skill(skill="workflow:session:start", args="--auto \"[structured-task-description]\"")
```

**Task Description Structure**:
```
GOAL: [Clear, concise objective]
SCOPE: [What's included/excluded]
CONTEXT: [Relevant background or constraints]
```

**Example**:
```
GOAL: Build JWT-based authentication system
SCOPE: User registration, login, token validation
CONTEXT: Existing user database schema, REST API endpoints
```

### Step 1.2: Parse Output

- Extract: `SESSION_ID: WFS-[id]` (store as `sessionId`)

### Step 1.3: Validate

- Session ID successfully extracted
- Session directory `.workflow/active/[sessionId]/` exists

**Note**: Session directory contains `workflow-session.json` (metadata). Do NOT look for `manifest.json` here - it only exists in `.workflow/archives/` for archived sessions.

### Step 1.4: Initialize Planning Notes

Create `planning-notes.md` with N+1 context support:

```javascript
const planningNotesPath = `.workflow/active/${sessionId}/planning-notes.md`
const userGoal = structuredDescription.goal
const userConstraints = structuredDescription.context || "None specified"

Write(planningNotesPath, `# Planning Notes

**Session**: ${sessionId}
**Created**: ${new Date().toISOString()}

## User Intent (Phase 1)

- **GOAL**: ${userGoal}
- **KEY_CONSTRAINTS**: ${userConstraints}

---

## Context Findings (Phase 2)
(To be filled by context-gather)

## Conflict Decisions (Phase 3)
(To be filled if conflicts detected)

## Consolidated Constraints (Phase 4 Input)
1. ${userConstraints}

---

## Task Generation (Phase 4)
(To be filled by action-planning-agent)

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|

### Deferred
- [ ] (For N+1)
`)
```

## Session Types

The `--type` parameter classifies sessions for CCW dashboard organization:

| Type | Description | Default For |
|------|-------------|-------------|
| `workflow` | Standard implementation (default) | `/workflow:plan` |
| `review` | Code review sessions | `/workflow:review-module-cycle` |
| `tdd` | TDD-based development | `/workflow:tdd-plan` |
| `test` | Test generation/fix sessions | `/workflow:test-fix-gen` |
| `docs` | Documentation sessions | `/memory:docs` |

**Validation**: If `--type` is provided with invalid value, return error:
```
ERROR: Invalid session type. Valid types: workflow, review, tdd, test, docs
```

## Mode 1: Discovery Mode (Default)

### Usage
```bash
/workflow:session:start
```

### Step 1: List Active Sessions
```bash
bash(ls -1 .workflow/active/ 2>/dev/null | head -5)
```

### Step 2: Display Session Metadata
```bash
bash(cat .workflow/active/WFS-promptmaster-platform/workflow-session.json)
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
bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | wc -l)
```

### Step 2a: No Active Sessions → Create New
```bash
# Generate session slug
bash(echo "implement OAuth2 auth" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | cut -c1-50)

# Create directory structure
bash(mkdir -p .workflow/active/WFS-implement-oauth2-auth/.process)
bash(mkdir -p .workflow/active/WFS-implement-oauth2-auth/.task)
bash(mkdir -p .workflow/active/WFS-implement-oauth2-auth/.summaries)

# Create metadata (include type field, default to "workflow" if not specified)
bash(echo '{"session_id":"WFS-implement-oauth2-auth","project":"implement OAuth2 auth","status":"planning","type":"workflow","created_at":"2024-12-04T08:00:00Z"}' > .workflow/active/WFS-implement-oauth2-auth/workflow-session.json)
```

**Output**: `SESSION_ID: WFS-implement-oauth2-auth`

### Step 2b: Single Active Session → Check Relevance
```bash
# Extract session ID
bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | head -1 | xargs basename)

# Read project name from metadata
bash(cat .workflow/active/WFS-promptmaster-platform/workflow-session.json | grep -o '"project":"[^"]*"' | cut -d'"' -f4)

# Check keyword match (manual comparison)
# If task contains project keywords → Reuse session
# If task unrelated → Create new session (use Step 2a)
```

**Output (reuse)**: `SESSION_ID: WFS-promptmaster-platform`
**Output (new)**: `SESSION_ID: WFS-[new-slug]`

### Step 2c: Multiple Active Sessions → Use First
```bash
# Get first active session
bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | head -1 | xargs basename)

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
# Convert to slug
bash(echo "fix login bug" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | cut -c1-50)

# Check if exists, add counter if needed
bash(ls .workflow/active/WFS-fix-login-bug 2>/dev/null && echo "WFS-fix-login-bug-2" || echo "WFS-fix-login-bug")
```

### Step 2: Create Session Structure
```bash
bash(mkdir -p .workflow/active/WFS-fix-login-bug/.process)
bash(mkdir -p .workflow/active/WFS-fix-login-bug/.task)
bash(mkdir -p .workflow/active/WFS-fix-login-bug/.summaries)
```

### Step 3: Create Metadata
```bash
# Include type field from --type parameter (default: "workflow")
bash(echo '{"session_id":"WFS-fix-login-bug","project":"fix login bug","status":"planning","type":"workflow","created_at":"2024-12-04T08:00:00Z"}' > .workflow/active/WFS-fix-login-bug/workflow-session.json)
```

**Output**: `SESSION_ID: WFS-fix-login-bug`

## Execution Guideline

- **Non-interrupting**: When called from other commands, this command completes and returns control to the caller without interrupting subsequent tasks.

## Session ID Format

- Pattern: `WFS-[lowercase-slug]`
- Characters: `a-z`, `0-9`, `-` only
- Max length: 50 characters
- Uniqueness: Add numeric suffix if collision (`WFS-auth-2`, `WFS-auth-3`)

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

## Output

- **Variable**: `sessionId` (e.g., `WFS-implement-oauth2-auth`)
- **File**: `.workflow/active/{sessionId}/planning-notes.md`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator showing Phase 1 results, then auto-continue to [Phase 2: Context Gathering](02-context-gathering.md).
