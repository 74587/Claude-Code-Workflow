---
name: plan
description: Orchestrate 4-phase planning workflow by executing commands and passing context between phases
argument-hint: "[--agent] \"text description\"|file.md"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Plan Command (/workflow:plan)

## Coordinator Role

**This command is a pure orchestrator**: Execute 4 slash commands in sequence, parse their outputs, pass context between them, and ensure complete execution through **automatic continuation**.

**Execution Model - Auto-Continue Workflow**:

This workflow runs **fully autonomously** once triggered. Each phase completes, reports its output to you, then **immediately and automatically** proceeds to the next phase without requiring any user intervention.

1. **User triggers**: `/workflow:plan "task"`
2. **Phase 1 executes** → Reports output to user → Auto-continues
3. **Phase 2 executes** → Reports output to user → Auto-continues
4. **Phase 3 executes** → Reports output to user → Auto-continues
5. **Phase 4 executes** → Reports final summary

**Auto-Continue Mechanism**:
- TodoList tracks current phase status
- After each phase completion, automatically executes next pending phase
- **No user action required** - workflow runs end-to-end autonomously
- Progress updates shown at each phase for visibility

**Execution Modes**:
- **Manual Mode** (default): Use `/workflow:tools:task-generate`
- **Agent Mode** (`--agent`): Use `/workflow:tools:task-generate-agent`

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each command's output for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion

## 4-Phase Execution

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
- Typical pattern: `.workflow/[sessionId]/.context/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Return to user showing Phase 2 results, then auto-continue to Phase 3

---

### Phase 3: Intelligent Analysis
**Command**: `SlashCommand(command="/workflow:tools:concept-enhanced --session [sessionId] --context [contextPath]")`

**Input**: `sessionId` from Phase 1, `contextPath` from Phase 2

**Parse Output**:
- Verify ANALYSIS_RESULTS.md created

**Validation**:
- File `.workflow/[sessionId]/ANALYSIS_RESULTS.md` exists
- Contains task recommendations section

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**After Phase 3**: Return to user showing Phase 3 results, then auto-continue to Phase 4

---

### Phase 4: Task Generation

**Relationship with Brainstorm Phase**:
- If brainstorm synthesis exists (synthesis-specification.md), Phase 3 analysis incorporates it as input
- **synthesis-specification.md defines "WHAT"**: Requirements, design specs, high-level features
- **IMPL_PLAN.md defines "HOW"**: Executable task breakdown, dependencies, implementation sequence
- Task generation translates high-level specifications into concrete, actionable work items

**Command**:
- Manual: `SlashCommand(command="/workflow:tools:task-generate --session [sessionId]")`
- Agent: `SlashCommand(command="/workflow:tools:task-generate-agent --session [sessionId]")`

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
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "in_progress", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "pending", "activeForm": "Executing context gathering"},
  {"content": "Execute intelligent analysis", "status": "pending", "activeForm": "Executing intelligent analysis"},
  {"content": "Execute task generation", "status": "pending", "activeForm": "Executing task generation"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "in_progress", "activeForm": "Executing context gathering"},
  {"content": "Execute intelligent analysis", "status": "pending", "activeForm": "Executing intelligent analysis"},
  {"content": "Execute task generation", "status": "pending", "activeForm": "Executing task generation"}
]})

// Continue pattern for Phase 2, 3, 4...
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
    ↓ Output: contextPath (context-package.json)
    ↓
Phase 3: concept-enhanced --session sessionId --context contextPath
    ↓ Input: sessionId + contextPath + session memory
    ↓ Output: ANALYSIS_RESULTS.md
    ↓
Phase 4: task-generate[--agent] --session sessionId
    ↓ Input: sessionId + ANALYSIS_RESULTS.md + session memory
    ↓ Output: IMPL_PLAN.md, task JSONs, TODO_LIST.md
    ↓
Return summary to user
```

**Session Memory Flow**: Each phase receives session ID, which provides access to:
- Previous task summaries
- Existing context and analysis
- Brainstorming artifacts
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
✅ Initialize TodoWrite before any command
✅ Execute Phase 1 immediately with structured description
✅ Parse session ID from Phase 1 output, store in memory
✅ Pass session ID and structured description to Phase 2 command
✅ Parse context path from Phase 2 output, store in memory
✅ Pass session ID and context path to Phase 3 command
✅ Verify ANALYSIS_RESULTS.md after Phase 3
✅ Select correct Phase 4 command based on --agent flag
✅ Pass session ID to Phase 4 command
✅ Verify all Phase 4 outputs
✅ Update TodoWrite after each phase
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
