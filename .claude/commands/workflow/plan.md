---
name: plan
description: Orchestrate 4-phase planning workflow by executing commands and passing context between phases
usage: /workflow:plan [--agent] <input>
argument-hint: "[--agent] \"text description\"|file.md|ISS-001"
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan --agent "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Plan Command (/workflow:plan)

## Coordinator Role

**This command is a pure orchestrator**: Execute 4 slash commands in sequence, parse their outputs, pass context between them, and ensure complete execution.

**Execution Flow**:
1. Initialize TodoWrite → Execute Phase 1 → Parse output → Update TodoWrite
2. Execute Phase 2 with Phase 1 data → Parse output → Update TodoWrite
3. Execute Phase 3 with Phase 2 data → Parse output → Update TodoWrite
4. Execute Phase 4 with Phase 3 validation → Update TodoWrite → Return summary

**Execution Modes**:
- **Manual Mode** (default): Use `/workflow:tools:task-generate`
- **Agent Mode** (`--agent`): Use `/workflow:tools:task-generate-agent`

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each command's output for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return to user until Phase 4 completes
6. **Track Progress**: Update TodoWrite after every phase completion

## 4-Phase Execution

### Phase 1: Session Discovery
**Command**: `SlashCommand(command="/workflow:session:start --auto \"[task-description]\"")`

**Parse Output**:
- Extract: `SESSION_ID: WFS-[id]` (store as `sessionId`)

**Validation**:
- Session ID successfully extracted
- Session directory `.workflow/[sessionId]/` exists

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

### Phase 2: Context Gathering
**Command**: `SlashCommand(command="/workflow:tools:context-gather --session [sessionId] \"[task-description]\"")`

**Input**: `sessionId` from Phase 1

**Parse Output**:
- Extract: context-package.json path (store as `contextPath`)
- Typical pattern: `.workflow/[sessionId]/.context/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

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

---

### Phase 4: Task Generation
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

Next: /workflow:execute or /workflow:status
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

## Data Flow

```
User Input (task description)
    ↓
Phase 1: session:start --auto "description"
    ↓ Output: sessionId
    ↓ Session Memory: Previous tasks, context, artifacts
    ↓
Phase 2: context-gather --session sessionId "description"
    ↓ Input: sessionId + session memory
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

## Error Handling

- **Parsing Failure**: If output parsing fails, retry command once, then report error
- **Validation Failure**: If validation fails, report which file/data is missing
- **Command Failure**: Keep phase `in_progress`, report error to user, do not proceed

## Coordinator Checklist

✅ Initialize TodoWrite before any command
✅ Execute Phase 1 immediately (no preliminary steps)
✅ Parse session ID from Phase 1 output
✅ Pass session ID to Phase 2 command
✅ Parse context path from Phase 2 output
✅ Pass session ID and context path to Phase 3 command
✅ Verify ANALYSIS_RESULTS.md after Phase 3
✅ Select correct Phase 4 command based on --agent flag
✅ Pass session ID to Phase 4 command
✅ Verify all Phase 4 outputs
✅ Update TodoWrite after each phase
✅ Return summary only after Phase 4 completes