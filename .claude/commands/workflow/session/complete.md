---
name: complete
description: Mark active workflow session as complete, archive with lessons learned, update manifest, remove active flag
examples:
  - /workflow:session:complete
  - /workflow:session:complete --detailed
---

# Complete Workflow Session (/workflow:session:complete)

## Overview
Mark the currently active workflow session as complete, analyze it for lessons learned, move it to the archive directory, and remove the active flag marker.

## Usage
```bash
/workflow:session:complete           # Complete current active session
/workflow:session:complete --detailed # Show detailed completion summary
```

## Implementation Flow

### Phase 1: Prepare for Archival (Minimal Manual Operations)

**Purpose**: Find active session, move to archive location, pass control to agent. Minimal operations.

#### Step 1.1: Find Active Session and Get Name
```bash
# Find active marker
bash(find .workflow/ -name ".active-*" -type f | head -1)

# Extract session name from marker path
bash(basename .workflow/.active-WFS-session-name | sed 's/^\.active-//')
```
**Output**: Session name `WFS-session-name`

#### Step 1.2: Move Session to Archive
```bash
# Create archive directory if needed
bash(mkdir -p .workflow/.archives/)

# Move session to archive location
bash(mv .workflow/WFS-session-name .workflow/.archives/WFS-session-name)
```
**Result**: Session now at `.workflow/.archives/WFS-session-name/`

### Phase 2: Agent-Orchestrated Completion (All Data Processing)

**Purpose**: Agent analyzes archived session, generates metadata, updates manifest, and removes active marker.

#### Agent Invocation

Invoke `universal-executor` agent to complete the archival process.

**Agent Task**:
```
Task(
  subagent_type="universal-executor",
  description="Complete session archival",
  prompt=`
Complete workflow session archival. Session already moved to archive location.

## Context
- Session: .workflow/.archives/WFS-session-name/
- Active marker: .workflow/.active-WFS-session-name

## Tasks

1. **Extract session data** from workflow-session.json (session_id, description/topic, started_at/timestamp, completed_at, status)
   - If status != "completed", update it with timestamp

2. **Count files**: tasks (.task/*.json) and summaries (.summaries/*.md)

3. **Generate lessons**: Use gemini with ~/.claude/workflows/cli-templates/prompts/archive/analysis-simple.txt (fallback: analyze files directly)
   - Return: {successes, challenges, watch_patterns}

4. **Build archive entry**:
   - Calculate: duration_hours, success_rate, tags (3-5 keywords)
   - Construct complete JSON with session_id, description, archived_at, archive_path, metrics, tags, lessons

5. **Update manifest**: Initialize .workflow/.archives/manifest.json if needed, append entry

6. **Remove active marker**

7. **Return result**: {"status": "success", "session_id": "...", "archived_at": "...", "metrics": {...}, "lessons_summary": {...}}

## Error Handling
- On failure: return {"status": "error", "task": "...", "message": "..."}
- Do NOT remove marker if failed
  `
)
```

**Expected Output**:
- Agent returns JSON result confirming successful archival
- Display completion summary to user based on agent response

## Workflow Execution Strategy

### Two-Phase Approach (Optimized)

**Phase 1: Minimal Manual Setup** (2 simple operations)
- Find active session and extract name
- Move session to archive location
- **No data extraction** - agent handles all data processing
- **No counting** - agent does this from archive location
- **Total**: 2 bash commands (find + move)

**Phase 2: Agent-Driven Completion** (1 agent invocation)
- Extract all session data from archived location
- Count tasks and summaries
- Generate lessons learned analysis
- Build complete archive metadata
- Update manifest
- Remove active marker
- Return success/error result

## Quick Commands

```bash
# Phase 1: Find and move
bash(find .workflow/ -name ".active-*" -type f | head -1)
bash(basename .workflow/.active-WFS-session-name | sed 's/^\.active-//')
bash(mkdir -p .workflow/.archives/)
bash(mv .workflow/WFS-session-name .workflow/.archives/WFS-session-name)

# Phase 2: Agent completes archival
Task(subagent_type="universal-executor", description="Complete session archival", prompt=`...`)
```

### Phase 3: Update Project Feature Registry

**Purpose**: Record completed session as a project feature in `.workflow/project.json`.

**Execution**: After agent successfully completes archival, extract feature information and update project registry.

#### Step 3.1: Check Project State Exists
```bash
bash(test -f .workflow/project.json && echo "EXISTS" || echo "SKIP")
```

**If SKIP**: Output warning and skip Phase 3
```
WARNING: No project.json found. Run /workflow:session:start to initialize.
```

#### Step 3.2: Extract Feature Information (Simple Text Processing)

```bash
# Read archived IMPL_PLAN.md
bash(cat .workflow/.archives/WFS-session-name/IMPL_PLAN.md | head -20)
```

**Data Processing** (No agent needed):
1. Extract feature title: First `#` heading line
2. Extract description: First paragraph after heading (max 200 chars)
3. Get session_id from archive path
4. Get completion timestamp

**Extraction Logic**:
```javascript
// Read IMPL_PLAN.md
const planContent = Read(`${archivePath}/IMPL_PLAN.md`);

// Extract title (first # heading)
const titleMatch = planContent.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : sessionId.replace('WFS-', '');

// Extract description (first paragraph, max 200 chars)
const descMatch = planContent.match(/^#[^\n]+\n\n([^\n]+)/m);
const description = descMatch ? descMatch[1].substring(0, 200).trim() : '';

// Create feature ID (lowercase slug)
const featureId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
```

#### Step 3.3: Update project.json

```bash
# Read current project state
bash(cat .workflow/project.json)
```

**JSON Update Logic**:
```javascript
// Read existing project.json (created by /workflow:init)
// Note: overview field is managed by /workflow:init, not modified here
const projectMeta = JSON.parse(Read('.workflow/project.json'));
const currentTimestamp = new Date().toISOString();
const currentDate = currentTimestamp.split('T')[0]; // YYYY-MM-DD

// Extract tags from IMPL_PLAN.md (simple keyword extraction)
const tags = extractTags(planContent); // e.g., ["auth", "security"]

// Build feature object with complete metadata
const newFeature = {
  id: featureId,
  title: title,
  description: description,
  status: "completed",
  tags: tags,
  timeline: {
    created_at: currentTimestamp,
    implemented_at: currentDate,
    updated_at: currentTimestamp
  },
  traceability: {
    session_id: sessionId,
    archive_path: archivePath, // e.g., ".workflow/.archives/WFS-auth-system"
    commit_hash: getLatestCommitHash() || "" // Optional: git rev-parse HEAD
  },
  docs: [],      // Placeholder for future doc links
  relations: []  // Placeholder for feature dependencies
};

// Add new feature to array
projectMeta.features.push(newFeature);

// Update statistics
projectMeta.statistics.total_features = projectMeta.features.length;
projectMeta.statistics.total_sessions += 1;
projectMeta.statistics.last_updated = currentTimestamp;

// Write back
Write('.workflow/project.json', JSON.stringify(projectMeta, null, 2));
```

**Helper Functions**:
```javascript
// Extract tags from IMPL_PLAN.md content
function extractTags(planContent) {
  const tags = [];

  // Look for common keywords
  const keywords = {
    'auth': /authentication|login|oauth|jwt/i,
    'security': /security|encrypt|hash|token/i,
    'api': /api|endpoint|rest|graphql/i,
    'ui': /component|page|interface|frontend/i,
    'database': /database|schema|migration|sql/i,
    'test': /test|testing|spec|coverage/i
  };

  for (const [tag, pattern] of Object.entries(keywords)) {
    if (pattern.test(planContent)) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 5); // Max 5 tags
}

// Get latest git commit hash (optional)
function getLatestCommitHash() {
  try {
    const result = Bash({
      command: "git rev-parse --short HEAD 2>/dev/null",
      description: "Get latest commit hash"
    });
    return result.trim();
  } catch {
    return "";
  }
}
```

#### Step 3.4: Output Confirmation

```
✓ Feature "${title}" added to project registry
  ID: ${featureId}
  Session: ${sessionId}
  Location: .workflow/project.json
```

**Error Handling**:
- If project.json malformed: Output error, skip update
- If IMPL_PLAN.md missing: Use session_id as title
- If extraction fails: Use minimal defaults

**Phase 3 Total Commands**: 2 bash reads + JSON manipulation

## Archive Query Commands

After archival, you can query the manifest:

```bash
# List all archived sessions
jq '.archives[].session_id' .workflow/.archives/manifest.json

# Find sessions by keyword
jq '.archives[] | select(.description | test("auth"; "i"))' .workflow/.archives/manifest.json

# Get specific session details
jq '.archives[] | select(.session_id == "WFS-user-auth")' .workflow/.archives/manifest.json

# List all watch patterns across sessions
jq '.archives[].lessons.watch_patterns[]' .workflow/.archives/manifest.json
```

