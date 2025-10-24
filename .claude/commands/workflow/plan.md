---
name: plan
description: Orchestrate 5-phase planning workflow with quality gate, executing commands and passing context between phases
argument-hint: "[--agent] [--cli-execute] \"text description\"|file.md"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Plan Command (/workflow:plan)

## Coordinator Role

**This command is a pure orchestrator**: Execute 5 slash commands in sequence (including a quality gate), parse their outputs, pass context between them, and ensure complete execution through **automatic continuation**.

**Execution Model - Auto-Continue Workflow with Quality Gate**:

This workflow runs **fully autonomously** once triggered. Phase 3 (conflict resolution) and Phase 4 (task generation) are delegated to specialized agents.


1. **User triggers**: `/workflow:plan "task"`
2. **Phase 1 executes** → Session discovery → Auto-continues
3. **Phase 2 executes** → Context gathering → Auto-continues
4. **Phase 3 executes** (optional, if conflict_risk ≥ medium) → Conflict resolution → Auto-continues
5. **Phase 4 executes** (task-generate-agent if --agent) → Task generation → Reports final summary

**Auto-Continue Mechanism**:
- TodoList tracks current phase status
- After each phase completion, automatically executes next pending phase
- All phases run autonomously without user interaction (clarification handled in brainstorm phase)
- Progress updates shown at each phase for visibility

**Execution Modes**:
- **Manual Mode** (default): Use `/workflow:tools:task-generate`
- **Agent Mode** (`--agent`): Use `/workflow:tools:task-generate-agent`
- **CLI Execute Mode** (`--cli-execute`): Generate tasks with Codex execution commands

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each command/agent output for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion
6. **Agent Delegation**: Phase 3 uses cli-execution-agent for autonomous intelligent analysis

## 5-Phase Execution

### Phase 1: Session Discovery
**Command**: `SlashCommand(command="/workflow:session:start --auto \"[structured-task-description]\"")`

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

**Parse Output**:
- Extract: `SESSION_ID: WFS-[id]` (store as `sessionId`)

**Validation**:
- Session ID successfully extracted
- Session directory `.workflow/[sessionId]/` exists

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Return to user showing Phase 1 results, then auto-continue to Phase 2

---

### Phase 2: Context Gathering
**Command**: `SlashCommand(command="/workflow:tools:context-gather --session [sessionId] \"[structured-task-description]\"")`

**Use Same Structured Description**: Pass the same structured format from Phase 1

**Input**: `sessionId` from Phase 1

**Parse Output**:
- Extract: context-package.json path (store as `contextPath`)
- Typical pattern: `.workflow/[sessionId]/.process/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Return to user showing Phase 2 results, then auto-continue to Phase 3

---

### Phase 3: Conflict Resolution (Optional - auto-triggered by conflict risk)

**Trigger**: Only execute when context-package.json indicates conflict_risk is "medium" or "high"

**Command**: `SlashCommand(command="/workflow:tools:conflict-resolution --session [sessionId] --context [contextPath]")`

**Input**:
- sessionId from Phase 1
- contextPath from Phase 2
- conflict_risk from context-package.json

**Parse Output**:
- Extract: Execution status (success/skipped/failed)
- Verify: CONFLICT_RESOLUTION.md file path (if executed)

**Validation**:
- File `.workflow/[sessionId]/.process/CONFLICT_RESOLUTION.md` exists (if executed)

**Skip Behavior**:
- If conflict_risk is "none" or "low", skip directly to Phase 3.5
- Display: "No significant conflicts detected, proceeding to clarification"

**TodoWrite**: Mark phase 3 completed (if executed) or skipped, phase 3.5 in_progress

**After Phase 3**: Return to user showing conflict resolution results (if executed) and selected strategies, then auto-continue to Phase 3.5

**Memory State Check**:
- Evaluate current context window usage and memory state
- If memory usage is high (>110K tokens or approaching context limits):
  - **Command**: `SlashCommand(command="/compact")`
  - This optimizes memory before proceeding to Phase 3.5
- Memory compaction is particularly important after analysis phase which may generate extensive documentation
- Ensures optimal performance and prevents context overflow

---

### Phase 3.5: Pre-Task Generation Validation (Optional Quality Gate)

**Purpose**: Optional quality gate before task generation - primarily handled by brainstorm synthesis phase

**Note**: Concept enhancement and clarification are now handled in `/workflow:brainstorm:synthesis` Phase 2.5 during brainstorming. This phase is reserved for future validation extensions.

**Current Behavior**: Auto-skip to Phase 4 (Task Generation)

**Future Enhancement**: Could add additional validation steps like:
- Cross-reference checks between conflict resolution and brainstorm analyses
- Final sanity checks before task generation
- User confirmation prompt for proceeding

**TodoWrite**: Mark phase 3.5 completed (auto-skip), phase 4 in_progress

**After Phase 3.5**: Auto-continue to Phase 4 immediately

---

### Phase 4: Task Generation

**Relationship with Brainstorm Phase**:
- If brainstorm role analyses exist ([role]/analysis.md files), Phase 3 analysis incorporates them as input
- **⚠️ User's original intent is ALWAYS primary**: New or refined user goals override brainstorm recommendations
- **Role analysis.md files define "WHAT"**: Requirements, design specs, role-specific insights
- **IMPL_PLAN.md defines "HOW"**: Executable task breakdown, dependencies, implementation sequence
- Task generation translates high-level role analyses into concrete, actionable work items
- **Intent priority**: Current user prompt > role analysis.md files > guidance-specification.md

**Command Selection**:
- Manual: `SlashCommand(command="/workflow:tools:task-generate --session [sessionId]")`
- Agent: `SlashCommand(command="/workflow:tools:task-generate-agent --session [sessionId]")`
- CLI Execute: Add `--cli-execute` flag to either command

**Flag Combination**:
- `--cli-execute` alone: Manual task generation with CLI execution
- `--agent --cli-execute`: Agent task generation with CLI execution

**Command Examples**:
```bash
# Manual with CLI execution
/workflow:tools:task-generate --session WFS-auth --cli-execute

# Agent with CLI execution
/workflow:tools:task-generate-agent --session WFS-auth --cli-execute
```

**Input**: `sessionId` from Phase 1

**Validation**:
- `.workflow/[sessionId]/IMPL_PLAN.md` exists
- `.workflow/[sessionId]/.task/IMPL-*.json` exists (at least one)
- `.workflow/[sessionId]/TODO_LIST.md` exists

**TodoWrite**: Mark phase 4 completed

**Return to User**:
```
Planning complete for session: [sessionId]
Tasks generated: [count]
Plan: .workflow/[sessionId]/IMPL_PLAN.md

✅ Recommended Next Steps:
1. /workflow:action-plan-verify --session [sessionId]  # Verify plan quality before execution
2. /workflow:status  # Review task breakdown
3. /workflow:execute  # Start implementation (after verification)

⚠️ Quality Gate: Consider running /workflow:action-plan-verify to catch issues early
```

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
// Note: Phase 3 todo only added dynamically after Phase 2 if conflict_risk ≥ medium
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "in_progress", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "pending", "activeForm": "Executing context gathering"},
  // Phase 3 todo added dynamically after Phase 2 if conflict_risk ≥ medium
  {"content": "Execute task generation", "status": "pending", "activeForm": "Executing task generation"}
]})

// After Phase 2 (if conflict_risk ≥ medium, insert Phase 3 todo)
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute conflict resolution", "status": "in_progress", "activeForm": "Executing conflict resolution"},
  {"content": "Execute task generation", "status": "pending", "activeForm": "Executing task generation"}
]})

// After Phase 2 (if conflict_risk is none/low, skip Phase 3, go directly to Phase 4)
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute task generation", "status": "in_progress", "activeForm": "Executing task generation"}
]})

// After Phase 3 (if executed), continue to Phase 4
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute conflict resolution", "status": "completed", "activeForm": "Executing conflict resolution"},
  {"content": "Execute task generation", "status": "in_progress", "activeForm": "Executing task generation"}
]})
```

## Input Processing

**Convert User Input to Structured Format**:

1. **Simple Text** → Structure it:
   ```
   User: "Build authentication system"

   Structured:
   GOAL: Build authentication system
   SCOPE: Core authentication features
   CONTEXT: New implementation
   ```

2. **Detailed Text** → Extract components:
   ```
   User: "Add JWT authentication with email/password login and token refresh"

   Structured:
   GOAL: Implement JWT-based authentication
   SCOPE: Email/password login, token generation, token refresh endpoints
   CONTEXT: JWT token-based security, refresh token rotation
   ```

3. **File Reference** (e.g., `requirements.md`) → Read and structure:
   - Read file content
   - Extract goal, scope, requirements
   - Format into structured description

## Data Flow

```
User Input (task description)
    ↓
[Convert to Structured Format]
    ↓ Structured Description:
    ↓   GOAL: [objective]
    ↓   SCOPE: [boundaries]
    ↓   CONTEXT: [background]
    ↓
Phase 1: session:start --auto "structured-description"
    ↓ Output: sessionId
    ↓ Session Memory: Previous tasks, context, artifacts
    ↓
Phase 2: context-gather --session sessionId "structured-description"
    ↓ Input: sessionId + session memory + structured description
    ↓ Output: contextPath (context-package.json) + conflict_risk
    ↓
Phase 3: conflict-resolution [AUTO-TRIGGERED if conflict_risk ≥ medium]
    ↓ Input: sessionId + contextPath + conflict_risk
    ↓ CLI-powered conflict detection and resolution strategy generation
    ↓ Output: CONFLICT_RESOLUTION.md (if conflict_risk ≥ medium)
    ↓ Skip if conflict_risk is none/low → proceed directly to Phase 4
    ↓
Phase 4: task-generate[--agent] --session sessionId
    ↓ Input: sessionId + conflict resolution decisions (if exists) + session memory
    ↓ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
Return summary to user
```

**Session Memory Flow**: Each phase receives session ID, which provides access to:
- Previous task summaries
- Existing context and analysis
- Brainstorming artifacts
- Conflict resolution decisions (if Phase 3 executed)
- Session-specific configuration

**Structured Description Benefits**:
- **Clarity**: Clear separation of goal, scope, and context
- **Consistency**: Same format across all phases
- **Traceability**: Easy to track what was requested
- **Precision**: Better context gathering and analysis

## Error Handling

- **Parsing Failure**: If output parsing fails, retry command once, then report error
- **Validation Failure**: If validation fails, report which file/data is missing
- **Command Failure**: Keep phase `in_progress`, report error to user, do not proceed to next phase

## Coordinator Checklist

✅ **Pre-Phase**: Convert user input to structured format (GOAL/SCOPE/CONTEXT)
✅ Initialize TodoWrite before any command (Phase 3 added dynamically after Phase 2)
✅ Execute Phase 1 immediately with structured description
✅ Parse session ID from Phase 1 output, store in memory
✅ Pass session ID and structured description to Phase 2 command
✅ Parse context path from Phase 2 output, store in memory
✅ **Extract conflict_risk from context-package.json**: Determine Phase 3 execution
✅ **If conflict_risk ≥ medium**: Launch Phase 3 conflict-resolution with sessionId and contextPath
✅ Wait for Phase 3 completion (if executed), verify CONFLICT_RESOLUTION.md created
✅ **If conflict_risk is none/low**: Skip Phase 3, proceed directly to Phase 4
✅ **Build Phase 4 command** based on flags:
  - Base command: `/workflow:tools:task-generate` (or `-agent` if `--agent` flag)
  - Add `--session [sessionId]`
  - Add `--cli-execute` if flag present
✅ Pass session ID to Phase 4 command
✅ Verify all Phase 4 outputs
✅ Update TodoWrite after each phase (dynamically adjust for Phase 3 presence)
✅ After each phase, automatically continue to next phase based on TodoList status

## Structure Template Reference

**Minimal Structure**:
```
GOAL: [What to achieve]
SCOPE: [What's included]
CONTEXT: [Relevant info]
```

**Detailed Structure** (optional, when more context available):
```
GOAL: [Primary objective]
SCOPE: [Included features/components]
CONTEXT: [Existing system, constraints, dependencies]
REQUIREMENTS: [Specific technical requirements]
CONSTRAINTS: [Limitations or boundaries]
```

**Usage in Commands**:
```bash
# Phase 1
/workflow:session:start --auto "GOAL: Build authentication\nSCOPE: JWT, login, registration\nCONTEXT: REST API"

# Phase 2
/workflow:tools:context-gather --session WFS-123 "GOAL: Build authentication\nSCOPE: JWT, login, registration\nCONTEXT: REST API"
```
