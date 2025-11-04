---
name: workflow-skill-memory
description: Generate SKILL package from archived workflow sessions for progressive context loading
argument-hint: "[--regenerate] [--incremental] [--filter <topic>]"
allowed-tools: SlashCommand(*), TodoWrite(*), Bash(*), Read(*), Write(*)
---

# Workflow SKILL Memory Generator

## Orchestrator Role

**Pure Orchestrator**: Extract and aggregate workflow session history to generate SKILL package for progressive context loading.

**Auto-Continue Workflow**: This command runs **fully autonomously** once triggered. Each phase completes and automatically triggers the next phase without user interaction.

**Execution Paths**:
- **Full Path**: All 4 phases (no existing SKILL OR `--regenerate` specified)
- **Incremental Path**: Phase 1 → Phase 2 → Phase 4 (existing SKILL found AND `--incremental` flag)
- **Phase 4 Always Executes**: SKILL.md index is never skipped, always generated or updated

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Task JSON**: This command does not create task JSON files
3. **Parse Every Output**: Extract required data from each command output (session count, file paths)
4. **Auto-Continue**: After completing each phase, update TodoWrite and immediately execute next phase
5. **Track Progress**: Update TodoWrite after EVERY phase completion before starting next phase
6. **Direct Generation**: Phase 4 directly generates SKILL.md using Write tool
7. **No Manual Steps**: User should never be prompted for decisions between phases

---

## 4-Phase Execution

### Phase 1: Read Archived Sessions

**Goal**: Read manifest.json and list all archived workflow sessions

**Step 1.1: Check Archive Directory**
```bash
bash(test -d .workflow/.archives && echo "exists" || echo "not_exists")
```

**Step 1.2: Read Manifest**
```bash
bash(test -f .workflow/.archives/manifest.json && cat .workflow/.archives/manifest.json || echo "{}")
```

**Output**:
- `archive_exists`: `exists` or `not_exists`
- `manifest_content`: JSON content or empty object
- `session_count`: Number of archived sessions

**Step 1.3: Parse Session List**

Extract from manifest:
- Session IDs
- Descriptions
- Archived dates
- Tags
- Metrics (task_count, success_rate, duration_hours)

**Step 1.4: Apply Filters (if --filter specified)**

If user provided `--filter <topic>`:
- Filter sessions by description/tags matching topic
- Update session list to only include filtered sessions

**Step 1.5: Determine Execution Path**

**Decision Logic**:
```javascript
if (session_count === 0) {
  // No archived sessions
  ERROR = "No archived workflow sessions found"
  SKIP_ALL = true
} else if (existing_SKILL && incremental_flag) {
  // Incremental update: skip full aggregation
  SKIP_AGGREGATION = true
  message = "Incremental update mode, reusing existing aggregations."
} else if (regenerate_flag) {
  // Force regeneration: delete existing SKILL
  bash(rm -rf .claude/skills/workflow-progress 2>/dev/null || true)
  SKIP_AGGREGATION = false
  message = "Regenerating SKILL package from scratch."
} else {
  // No existing SKILL or full generation
  SKIP_AGGREGATION = false
  message = "Generating new SKILL package."
}
```

**Summary Variables**:
- `SESSION_COUNT`: Total archived sessions (or filtered count)
- `SESSION_LIST`: Array of session objects [{id, description, archived_at, tags, metrics}]
- `FILTER_TOPIC`: Filter keyword (if specified)
- `INCREMENTAL`: `true` if --incremental flag
- `REGENERATE`: `true` if --regenerate flag
- `SKIP_AGGREGATION`: `true` if incremental update
- `SKIP_ALL`: `true` if no sessions found

**Completion & TodoWrite**:
- If `SKIP_ALL = true`: Mark all phases completed (error), report error
- If `SKIP_AGGREGATION = true`: Mark phase 1 completed, phase 2&3 completed (skipped), phase 4 in_progress
- If `SKIP_AGGREGATION = false`: Mark phase 1 completed, phase 2 in_progress

**Next Action**:
- If error: Display error message → Exit
- If skipping aggregation: Display skip message → Jump to Phase 4
- Otherwise: Display session list → Continue to Phase 2

---

### Phase 2: Extract Session Data

**Skip Condition**: This phase is **skipped if SKIP_AGGREGATION = true** (incremental mode with existing aggregations)

**Goal**: Traverse archived sessions and extract key data

**For Each Session**:

**Step 2.1: Read Session Metadata**
```bash
bash(cat .workflow/.archives/WFS-{session_id}/workflow-session.json)
```

**Step 2.2: Check for Key Files**
```bash
# Context package path (reference only, don't read content)
bash(test -f .workflow/.archives/WFS-{session_id}/.process/context-package.json && echo "exists" || echo "missing")

# IMPL_PLAN
bash(test -f .workflow/.archives/WFS-{session_id}/IMPL_PLAN.md && cat .workflow/.archives/WFS-{session_id}/IMPL_PLAN.md || echo "")

# TODO_LIST
bash(test -f .workflow/.archives/WFS-{session_id}/TODO_LIST.md && cat .workflow/.archives/WFS-{session_id}/TODO_LIST.md || echo "")

# Count tasks and summaries
bash(find .workflow/.archives/WFS-{session_id}/.task -name "*.json" 2>/dev/null | wc -l || echo 0)
bash(find .workflow/.archives/WFS-{session_id}/.summaries -name "*.md" 2>/dev/null | wc -l || echo 0)
```

**Step 2.3: Extract from Manifest Entry**

For each session, extract from manifest.json:
- `lessons.successes` - Success patterns
- `lessons.challenges` - Challenges encountered
- `lessons.watch_patterns` - Things to watch for
- `tags` - Functional domain tags
- `metrics` - Task count, success rate, duration

**Aggregated Data Structure**:
```javascript
{
  "sessions": [
    {
      "session_id": "WFS-user-auth",
      "description": "User authentication implementation",
      "archived_at": "2025-11-03T12:00:00Z",
      "tags": ["auth", "security", "jwt"],
      "metrics": {
        "task_count": 5,
        "completed_tasks": 5,
        "success_rate": 100,
        "duration_hours": 4.5
      },
      "context_package_path": ".workflow/.archives/WFS-user-auth/.process/context-package.json",
      "impl_plan_summary": "First 200 chars of IMPL_PLAN.md...",
      "lessons": {
        "successes": ["JWT implementation worked well", "..."],
        "challenges": ["Token refresh edge cases", "..."],
        "watch_patterns": ["Concurrent token validation", "..."]
      }
    }
  ],
  "aggregated_lessons": {
    "successes_by_category": {
      "auth": ["JWT implementation", "..."],
      "testing": ["Coverage reached 90%", "..."]
    },
    "challenges_by_severity": {
      "high": ["Performance bottleneck in token validation", "..."],
      "medium": ["Edge case handling", "..."]
    },
    "watch_patterns": ["Token concurrency", "State management", "..."]
  },
  "conflict_patterns": {
    "architecture": [
      {
        "pattern": "Multiple authentication strategies conflict",
        "sessions": ["WFS-user-auth", "WFS-oauth"],
        "resolution": "Unified auth interface"
      }
    ],
    "dependencies": [
      {
        "pattern": "Version mismatch in JWT libraries",
        "sessions": ["WFS-user-auth"],
        "resolution": "Lock to compatible version"
      }
    ]
  }
}
```

**Completion Criteria**:
- All sessions traversed
- Data structure populated
- Aggregations computed (lessons by category, conflicts by type)

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**Next Action**: Display extraction summary (sessions processed, lessons extracted) → Auto-continue to Phase 3

---

### Phase 3: Classify and Organize Data

**Skip Condition**: This phase is **skipped if SKIP_AGGREGATION = true** (incremental mode)

**Goal**: Organize extracted data by functional domains, timeline, and patterns

**Step 3.1: Group Sessions by Tags**

Organize sessions into functional domains:
```javascript
{
  "auth": [session_objects],
  "payment": [session_objects],
  "ui": [session_objects],
  "testing": [session_objects],
  "other": [session_objects]
}
```

**Step 3.2: Sort by Timeline**

Create chronological timeline:
- Sort sessions by `archived_at` (newest first)
- Group by month/quarter for large histories

**Step 3.3: Identify Recurring Patterns**

**Lessons Analysis**:
- Successes that appear in multiple sessions → "Best Practices"
- Challenges that repeat → "Known Issues"
- Watch patterns with high frequency → "High Priority Warnings"

**Conflict Analysis**:
- Group conflicts by type (architecture, dependencies, testing)
- Mark conflicts that occurred in multiple sessions
- Link resolutions to specific sessions

**Step 3.4: Build Progressive Loading Structure**

Organize data for 4 levels:
- **Level 0**: Top 5 recent sessions + Top 3 conflict patterns
- **Level 1**: Top 10 sessions + Lessons by category
- **Level 2**: All sessions + Full conflict analysis + IMPL_PLAN summaries
- **Level 3**: All sessions + Full IMPL_PLAN + TODO_LIST + Context package references

**Completion Criteria**:
- Sessions grouped by domain
- Timeline structure created
- Recurring patterns identified
- Progressive loading structure built

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**Next Action**: Display organization summary → Auto-continue to Phase 4

---

### Phase 4: Generate SKILL Package

**Note**: This phase is **NEVER skipped** - it always executes to generate or update the SKILL package.

**Step 4.1: Create SKILL Directory**
```bash
bash(mkdir -p .claude/skills/workflow-progress)
```

**Step 4.2: Generate sessions-timeline.md**

Create timeline document:
```markdown
# Workflow Sessions Timeline

## Recent Sessions (Last 5)

### WFS-user-auth (2025-11-03)
**Description**: User authentication implementation
**Tags**: auth, security, jwt
**Metrics**: 5 tasks, 100% success, 4.5 hours
**Context Package**: [.workflow/.archives/WFS-user-auth/.process/context-package.json](.workflow/.archives/WFS-user-auth/.process/context-package.json)

**Key Outcomes**:
- ✅ JWT implementation with refresh tokens
- ✅ Secure password hashing
- ⚠️ Watch: Token concurrency edge cases

...

## By Functional Domain

### Authentication (3 sessions)
- WFS-user-auth (2025-11-03)
- WFS-oauth (2025-10-15)
- WFS-jwt-refresh (2025-09-20)

### Payment (2 sessions)
- WFS-stripe-integration (2025-10-28)
- WFS-payment-webhooks (2025-09-10)

...
```

**Step 4.3: Generate lessons-learned.md**

Create lessons document:
```markdown
# Workflow Lessons Learned

## Best Practices (Successes)

### Authentication
- JWT implementation with refresh tokens works reliably
- Use bcrypt for password hashing (sessions: WFS-user-auth, WFS-oauth)

### Testing
- TDD approach reduced bugs by 60% (sessions: WFS-user-auth, WFS-payment)
- Mocking external APIs saves development time

...

## Known Challenges

### High Priority
- **Token refresh edge cases**: Concurrent requests can invalidate tokens prematurely
  - Affected sessions: WFS-user-auth, WFS-jwt-refresh
  - Resolution: Implement token refresh queue

### Medium Priority
- **Performance bottlenecks**: Large payload serialization
  - Affected sessions: WFS-payment-webhooks
  - Resolution: Implement streaming responses

...

## Watch Patterns

### Critical
1. **Token concurrency**: Always test concurrent token operations
2. **State management**: Redux state can become stale in async workflows
3. **Database migrations**: Always backup before schema changes

...
```

**Step 4.4: Generate conflict-patterns.md**

Create conflict patterns document:
```markdown
# Workflow Conflict Patterns

## Architecture Conflicts

### Multiple Authentication Strategies
**Pattern**: Different parts of system use incompatible auth methods
**Sessions**: WFS-user-auth, WFS-oauth
**Resolution**: Unified auth interface with strategy pattern

**Code Impact**:
- Modified: src/auth/interface.ts, src/auth/jwt.ts, src/auth/oauth.ts
- Tests: src/auth/__tests__/

...

## Dependency Conflicts

### JWT Library Version Mismatch
**Pattern**: jsonwebtoken v8 vs v9 incompatibility
**Sessions**: WFS-user-auth
**Resolution**: Lock to jsonwebtoken@^9.0.0, update all imports

...

## Testing Conflicts

### Mock Data Inconsistencies
**Pattern**: Different test suites use different user fixtures
**Sessions**: WFS-user-auth, WFS-payment
**Resolution**: Centralized test fixtures in tests/fixtures/

...
```

**Step 4.5: Generate SKILL.md**

Create main SKILL index:
```yaml
---
name: workflow-progress
description: Progressive workflow development history (located at {project_root}). Load this SKILL when continuing development, analyzing past implementations, or learning from workflow history, especially when no relevant context exists in memory.
version: 1.0.0
---
# Workflow Progress SKILL Package

## Documentation: `../../../.workflow/.archives/`

**Total Sessions**: {session_count}
**Functional Domains**: {domain_list}
**Date Range**: {earliest_date} - {latest_date}

## Progressive Loading

### Level 0: Quick Overview (~2K tokens)
- [Sessions Timeline](sessions-timeline.md#recent-sessions-last-5) - Recent 5 sessions
- [Top Conflict Patterns](conflict-patterns.md#top-patterns) - Top 3 recurring conflicts
- Quick reference for last completed work

**Use Case**: Quick context refresh before starting new task

### Level 1: Core History (~8K tokens)
- [Sessions Timeline](sessions-timeline.md) - Recent 10 sessions with details
- [Lessons Learned](lessons-learned.md#best-practices) - Success patterns by category
- [Conflict Patterns](conflict-patterns.md) - Known conflict types and resolutions
- Context package references (metadata only)

**Use Case**: Understanding recent development patterns and avoiding known pitfalls

### Level 2: Complete History (~25K tokens)
- All archived sessions with metadata
- Full lessons learned (successes, challenges, watch patterns)
- Complete conflict analysis with resolutions
- IMPL_PLAN summaries from all sessions
- Context package paths for on-demand loading

**Use Case**: Comprehensive review before major refactoring or architecture changes

### Level 3: Deep Dive (~40K tokens)
- Full IMPL_PLAN.md and TODO_LIST.md from all sessions
- Detailed task completion summaries
- Cross-session dependency analysis
- Direct context package file references

**Use Case**: Investigating specific implementation details or debugging historical decisions

---

## Quick Access

### Recent Sessions
{list of 5 most recent sessions with one-line descriptions}

### By Domain
- **Authentication**: {count} sessions
- **Payment**: {count} sessions
- **UI/UX**: {count} sessions
- **Testing**: {count} sessions
- **Other**: {count} sessions

### Top Watch Patterns
1. {most frequent watch pattern}
2. {second most frequent}
3. {third most frequent}

---

## Session Index

### Authentication Sessions
- [WFS-user-auth](../../../.workflow/.archives/WFS-user-auth/) - JWT authentication (2025-11-03)
  - Context: [context-package.json](../../../.workflow/.archives/WFS-user-auth/.process/context-package.json)
  - Plan: [IMPL_PLAN.md](../../../.workflow/.archives/WFS-user-auth/IMPL_PLAN.md)
  - Tags: auth, security, jwt

...

---

## Usage Examples

### Loading Quick Context
```markdown
Load Level 0 from workflow-progress SKILL for overview of recent work
```

### Investigating Auth History
```markdown
Load Level 2 from workflow-progress SKILL, filter by "auth" tag
```

### Full Historical Analysis
```markdown
Load Level 3 from workflow-progress SKILL for complete development history
```
```

**Step 4.6: Write All Files**

Use Write tool to create:
1. `.claude/skills/workflow-progress/SKILL.md`
2. `.claude/skills/workflow-progress/sessions-timeline.md`
3. `.claude/skills/workflow-progress/lessons-learned.md`
4. `.claude/skills/workflow-progress/conflict-patterns.md`

**Completion Criteria**:
- SKILL.md file created
- All support documents created
- Progressive loading structure verified
- File references use relative paths

**TodoWrite**: Mark phase 4 completed

**Final Action**: Report completion summary to user

**Return to User**:
```
✅ Workflow SKILL Package Generation Complete

Sessions Processed: {session_count}
Functional Domains: {domain_count}
SKILL Location: .claude/skills/workflow-progress/SKILL.md

Generated:
- sessions-timeline.md - {session_count} sessions organized chronologically
- lessons-learned.md - {success_count} successes, {challenge_count} challenges
- conflict-patterns.md - {conflict_count} conflict patterns documented
- SKILL.md with progressive loading (4 levels)

Usage:
- Level 0: Quick refresh (~2K tokens)
- Level 1: Recent history (~8K tokens)
- Level 2: Complete analysis (~25K tokens)
- Level 3: Deep dive (~40K tokens)

Trigger: Skill() will auto-load when continuing workflow development
```

---

## Implementation Details

### Critical Rules

1. **No User Prompts Between Phases**: Never ask user questions or wait for input between phases
2. **Immediate Phase Transition**: After TodoWrite update, immediately execute next phase command
3. **Status-Driven Execution**: Check TodoList status after each phase:
   - If next task is "pending" → Mark it "in_progress" and execute
   - If all tasks are "completed" → Report final summary
4. **Phase Completion Pattern**:
   ```
   Phase N completes → Update TodoWrite (N=completed, N+1=in_progress) → Execute Phase N+1
   ```

### TodoWrite Patterns

#### Initialization (Before Phase 1)

**FIRST ACTION**: Create TodoList with all 4 phases
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "in_progress", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "pending", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "pending", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
```

**SECOND ACTION**: Execute Phase 1 immediately

#### Full Path (SKIP_AGGREGATION = false)

**After Phase 1**:
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "in_progress", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "pending", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 2
```

**After Phase 2**:
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "completed", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "in_progress", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 3
```

**After Phase 3**:
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "completed", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "completed", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "in_progress", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 4
```

**After Phase 4**:
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "completed", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "completed", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "completed", "activeForm": "Generating SKILL files"}
]})
// Report completion summary to user
```

#### Incremental Path (SKIP_AGGREGATION = true)

**After Phase 1** (detects incremental mode, skips Phase 2 & 3):
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "completed", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "completed", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "in_progress", "activeForm": "Generating SKILL files"}
]})
// Display skip message: "Incremental update mode, reusing existing aggregations."
// Jump directly to Phase 4
```

**After Phase 4**:
```javascript
TodoWrite({todos: [
  {"content": "Read archived sessions from manifest", "status": "completed", "activeForm": "Reading archived sessions"},
  {"content": "Extract session data and lessons", "status": "completed", "activeForm": "Extracting session data"},
  {"content": "Classify and organize data by domains", "status": "completed", "activeForm": "Classifying data"},
  {"content": "Generate SKILL package files", "status": "completed", "activeForm": "Generating SKILL files"}
]})
// Report completion summary to user
```

### Error Handling

- If no archived sessions found, mark all tasks completed and report error
- If any phase fails, mark it as "in_progress" (not completed)
- Report error details to user
- Do NOT auto-continue to next phase on failure

---

## Parameters

```bash
/memory:workflow-skill-memory [--regenerate] [--incremental] [--filter <topic>]
```

- **--regenerate**: Force regenerate all SKILL files from scratch
  - When enabled: Deletes existing `.claude/skills/workflow-progress/` before regeneration
  - Ensures fresh SKILL package from archived sessions
- **--incremental**: Incremental update mode (skip Phase 2 & 3 if existing SKILL found)
  - When enabled: Reuses existing aggregations, only updates SKILL files
  - Faster execution for adding new sessions
- **--filter <topic>**: Filter sessions by topic/tag
  - Example: `--filter auth` only processes auth-related sessions
  - Uses description and tags for matching

---

## Examples

### Example 1: Generate SKILL Package (Default)

```bash
/memory:workflow-skill-memory
```

**Workflow**:
1. Phase 1: Reads manifest.json, gets all archived sessions
2. Phase 2: Extracts lessons, conflicts, and summaries from all sessions
3. Phase 3: Organizes data by domain and timeline
4. Phase 4: Generates SKILL.md at `.claude/skills/workflow-progress/SKILL.md`

### Example 2: Regenerate SKILL Package

```bash
/memory:workflow-skill-memory --regenerate
```

**Workflow**:
1. Phase 1: Deletes existing SKILL package, reads manifest
2. Phase 2-4: Full regeneration from archived sessions

### Example 3: Incremental Update (Fast)

```bash
/memory:workflow-skill-memory --incremental
```

**Workflow**:
1. Phase 1: Reads manifest, detects incremental mode
2. Display: "Incremental update mode, reusing existing aggregations."
3. Phase 4: Updates SKILL.md only (~5-10x faster)

### Example 4: Filter by Topic

```bash
/memory:workflow-skill-memory --filter auth
```

**Workflow**:
1. Phase 1: Reads manifest, filters sessions with "auth" in description/tags
2. Phase 2-4: Processes only auth-related sessions

---

## Benefits

- ✅ **Progressive Context Loading**: 4 levels (2K → 8K → 25K → 40K tokens)
- ✅ **Historical Wisdom**: Lessons learned and conflict patterns accumulated
- ✅ **Auto-Generated**: Called automatically by `/workflow:session:complete`
- ✅ **Incremental Updates**: Fast updates when adding new sessions
- ✅ **Intelligent Filtering**: Focus on specific functional domains
- ✅ **Reference-Based**: Context packages referenced by path, not duplicated
- ✅ **Lightweight**: Only aggregates lessons/conflicts, keeps original files

## Architecture

```
workflow-skill-memory (orchestrator)
  ├─ Phase 1: Read manifest and sessions (bash commands)
  ├─ Phase 2: Extract data (bash + Read, skippable)
  ├─ Phase 3: Organize data (in-memory, skippable)
  └─ Phase 4: Write SKILL files (Write tool, always runs)

No task JSON created by this command
Smart skip logic: 5-10x faster in incremental mode
```
