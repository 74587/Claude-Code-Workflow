---
name: auto-parallel
description: Parallel brainstorming automation with dynamic role selection and concurrent execution
argument-hint: "topic or challenge description" [--count N]
allowed-tools: SlashCommand(*), Task(*), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Workflow Brainstorm Parallel Auto Command

## Coordinator Role

**This command is a pure orchestrator**: Execute 3 phases in sequence (interactive framework → parallel role analysis → synthesis), delegate to specialized commands/agents, and ensure complete execution through **automatic continuation**.

**Execution Model - Auto-Continue Workflow**:

This workflow runs **fully autonomously** once triggered. Phase 1 (artifacts) handles user interaction, Phase 2 (role agents) runs in parallel.

1. **User triggers**: `/workflow:brainstorm:auto-parallel "topic" [--count N]`
2. **Phase 1 executes** → artifacts command (interactive framework) → Auto-continues
3. **Phase 2 executes** → Parallel role agents (N agents run concurrently) → Auto-continues
4. **Phase 3 executes** → Synthesis command → Reports final summary

**Auto-Continue Mechanism**:
- TodoList tracks current phase status
- After Phase 1 (artifacts) completion, automatically load roles and launch Phase 2 agents
- After Phase 2 (all agents) completion, automatically execute Phase 3 synthesis
- Progress updates shown at each phase for visibility

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not analyze topic before Phase 1 - artifacts handles all analysis
3. **Parse Every Output**: Extract selected_roles from workflow-session.json after Phase 1
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion
6. **TodoWrite Extension**: artifacts command EXTENDS parent TodoList (NOT replaces)

## Usage

```bash
/workflow:brainstorm:auto-parallel "<topic>" [--count N]
```

**Recommended Structured Format**:
```bash
/workflow:brainstorm:auto-parallel "GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]" [--count N]
```

**Parameters**:
- `topic` (required): Topic or challenge description (structured format recommended)
- `--count N` (optional): Number of roles to select (default: 3, max: 9)

## 3-Phase Execution

### Phase 1: Interactive Framework Generation

**Command**: `SlashCommand(command="/workflow:brainstorm:artifacts \"{topic}\" --count {N}")`

**What It Does**:
- Topic analysis: Extract challenges, generate task-specific questions
- Role selection: Recommend count+2 roles, user selects via AskUserQuestion
- Role questions: Generate 3-4 questions per role, collect user decisions
- Conflict resolution: Detect and resolve cross-role conflicts
- Guidance generation: Transform Q&A to declarative guidance-specification.md

**Parse Output**:
- **⚠️ Memory Check**: If `selected_roles[]` already in conversation memory from previous load, skip file read
- Extract: `selected_roles[]` from workflow-session.json (if not in memory)
- Extract: `session_id` from workflow-session.json (if not in memory)
- Verify: guidance-specification.md exists

**Validation**:
- guidance-specification.md created with confirmed decisions
- workflow-session.json contains selected_roles[] (metadata only, no content duplication)
- Session directory `.workflow/WFS-{topic}/.brainstorming/` exists

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Auto-continue to Phase 2 (role agent assignment)

**⚠️ TodoWrite Coordination**: artifacts EXTENDS parent TodoList by:
- Marking parent task "Execute artifacts..." as in_progress
- APPENDING artifacts sub-tasks (Phase 1-5) after parent task
- PRESERVING all other auto-parallel tasks (role agents, synthesis)
- When artifacts Phase 5 completes, marking parent task as completed

---

### Phase 2: Parallel Role Analysis Execution

**For Each Selected Role**:
```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute {role-name} analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: {role-name}
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/{role}/
TOPIC: {user-provided-topic}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/guidance-specification.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load {role-name} planning template
   - Command: Read(~/.claude/workflows/cli-templates/planning-roles/{role}.md)
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and original user intent
   - Command: Read(.workflow/WFS-{session}/workflow-session.json)
   - Output: session_context (contains original user prompt as PRIMARY reference)

## Analysis Requirements
**Primary Reference**: Original user prompt from workflow-session.json is authoritative
**Framework Source**: Address all discussion points in guidance-specification.md from {role-name} perspective
**Role Focus**: {role-name} domain expertise aligned with user intent
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive {role-name} analysis addressing all framework discussion points
   - **File Naming**: MUST start with `analysis` prefix (e.g., `analysis.md`, `analysis-1.md`, `analysis-2.md`)
   - **FORBIDDEN**: Never use `recommendations.md` or any filename not starting with `analysis`
   - **Auto-split if large**: If content >800 lines, split to `analysis-1.md`, `analysis-2.md` (max 3 files: analysis.md, analysis-1.md, analysis-2.md)
   - **Content**: Includes both analysis AND recommendations sections within analysis files
2. **Framework Reference**: Include @../guidance-specification.md reference in analysis
3. **User Intent Alignment**: Validate analysis aligns with original user objectives from session_context

## Completion Criteria
- Address each discussion point from guidance-specification.md with {role-name} expertise
- Provide actionable recommendations from {role-name} perspective within analysis files
- All output files MUST start with `analysis` prefix (no recommendations.md or other naming)
- Reference framework document using @ notation for integration
- Update workflow-session.json with completion status
"
```

**Parallel Execution**:
- Launch N agents simultaneously (one message with multiple Task calls)
- Each agent operates independently reading same guidance-specification.md
- All agents update progress concurrently

**Input**:
- `selected_roles[]` from Phase 1
- `session_id` from Phase 1
- guidance-specification.md path

**Validation**:
- Each role creates `.workflow/WFS-{topic}/.brainstorming/{role}/analysis.md` (primary file)
- If content is large (>800 lines), may split to `analysis-1.md`, `analysis-2.md` (max 3 files total)
- **File naming pattern**: ALL files MUST start with `analysis` prefix (use `analysis*.md` for globbing)
- **FORBIDDEN naming**: No `recommendations.md`, `recommendations-*.md`, or any non-`analysis` prefixed files
- All N role analyses completed

**TodoWrite**: Mark all N role agent tasks completed, phase 3 in_progress

**After Phase 2**: Auto-continue to Phase 3 (synthesis)

---

### Phase 3: Synthesis Generation

**Command**: `SlashCommand(command="/workflow:brainstorm:synthesis --session {sessionId}")`

**What It Does**:
- Load original user intent from workflow-session.json
- Read all role analysis.md files
- Integrate role insights into synthesis-specification.md
- Validate alignment with user's original objectives

**Input**: `sessionId` from Phase 1

**Validation**:
- `.workflow/WFS-{topic}/.brainstorming/synthesis-specification.md` exists
- Synthesis references all role analyses

**TodoWrite**: Mark phase 3 completed

**Return to User**:
```
Brainstorming complete for session: {sessionId}
Roles analyzed: {count}
Synthesis: .workflow/WFS-{topic}/.brainstorming/synthesis-specification.md

✅ Next Steps:
1. /workflow:concept-clarify --session {sessionId}  # Optional refinement
2. /workflow:plan --session {sessionId}  # Generate implementation plan
```

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Parse --count parameter from user input", "status": "in_progress", "activeForm": "Parsing count parameter"},
  {"content": "Execute artifacts command for interactive framework generation", "status": "pending", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Load selected_roles from workflow-session.json", "status": "pending", "activeForm": "Loading selected roles"},
  // Role agent tasks added dynamically after Phase 1 based on selected_roles count
  {"content": "Execute synthesis command for final integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]})

// After Phase 1 (artifacts completes, roles loaded)
// Note: artifacts EXTENDS this list by appending its Phase 1-5 sub-tasks
TodoWrite({todos: [
  {"content": "Parse --count parameter from user input", "status": "completed", "activeForm": "Parsing count parameter"},
  {"content": "Execute artifacts command for interactive framework generation", "status": "completed", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Load selected_roles from workflow-session.json", "status": "in_progress", "activeForm": "Loading selected roles"},
  {"content": "Execute system-architect analysis [conceptual-planning-agent]", "status": "pending", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute ui-designer analysis [conceptual-planning-agent]", "status": "pending", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute product-manager analysis [conceptual-planning-agent]", "status": "pending", "activeForm": "Executing product-manager analysis"},
  // ... (N role tasks based on --count parameter)
  {"content": "Execute synthesis command for final integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]})

// After Phase 2 (all agents launched in parallel)
TodoWrite({todos: [
  // ... previous completed tasks
  {"content": "Load selected_roles from workflow-session.json", "status": "completed", "activeForm": "Loading selected roles"},
  {"content": "Execute system-architect analysis [conceptual-planning-agent]", "status": "in_progress", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute ui-designer analysis [conceptual-planning-agent]", "status": "in_progress", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute product-manager analysis [conceptual-planning-agent]", "status": "in_progress", "activeForm": "Executing product-manager analysis"},
  // ... (all N agents in_progress simultaneously)
  {"content": "Execute synthesis command for final integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]})

// After Phase 2 (all agents complete)
TodoWrite({todos: [
  // ... previous completed tasks
  {"content": "Execute system-architect analysis [conceptual-planning-agent]", "status": "completed", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute ui-designer analysis [conceptual-planning-agent]", "status": "completed", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute product-manager analysis [conceptual-planning-agent]", "status": "completed", "activeForm": "Executing product-manager analysis"},
  {"content": "Execute synthesis command for final integration", "status": "in_progress", "activeForm": "Executing synthesis integration"}
]})
```

## Input Processing

**Count Parameter Parsing**:
```javascript
// Extract --count from user input
IF user_input CONTAINS "--count":
    EXTRACT count_value FROM "--count N" pattern
    IF count_value > 9:
        count_value = 9  // Cap at maximum 9 roles
ELSE:
    count_value = 3  // Default to 3 roles

// Pass to artifacts command
EXECUTE: /workflow:brainstorm:artifacts "{topic}" --count {count_value}
```

**Topic Structuring**:
1. **Already Structured** → Pass directly to artifacts
   ```
   User: "GOAL: Build platform SCOPE: 100 users CONTEXT: Real-time"
   → Pass as-is to artifacts
   ```

2. **Simple Text** → Pass directly (artifacts handles structuring)
   ```
   User: "Build collaboration platform"
   → artifacts will analyze and structure
   ```

## Session Management

**⚡ FIRST ACTION**: Check for `.workflow/.active-*` markers before Phase 1

**Multiple Sessions Support**:
- Different Claude instances can have different active brainstorming sessions
- If multiple active sessions found, prompt user to select
- If single active session found, use it
- If no active session exists, create `WFS-[topic-slug]`

**Session Continuity**:
- MUST use selected active session for all phases
- Each role's context stored in session directory
- Session isolation: Each session maintains independent state

## Output Structure

**Phase 1 Output**:
- `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md` (framework content)
- `.workflow/WFS-{topic}/workflow-session.json` (metadata: selected_roles[], topic, timestamps)

**Phase 2 Output**:
- `.workflow/WFS-{topic}/.brainstorming/{role}/analysis.md` (one per role)

**Phase 3 Output**:
- `.workflow/WFS-{topic}/.brainstorming/synthesis-specification.md` (integrated analysis)

**⚠️ Storage Separation**: Guidance content in .md files, metadata in .json (no duplication)

## Available Roles

- data-architect (数据架构师)
- product-manager (产品经理)
- product-owner (产品负责人)
- scrum-master (敏捷教练)
- subject-matter-expert (领域专家)
- system-architect (系统架构师)
- test-strategist (测试策略师)
- ui-designer (UI 设计师)
- ux-expert (UX 专家)

**Role Selection**: Handled by artifacts command (intelligent recommendation + user selection)

## Error Handling

- **Role selection failure**: artifacts defaults to product-manager with explanation
- **Agent execution failure**: Agent-specific retry with minimal dependencies
- **Template loading issues**: Agent handles graceful degradation
- **Synthesis conflicts**: Synthesis highlights disagreements without resolution

## Reference Information

**File Structure**:
```
.workflow/WFS-[topic]/
├── .active-brainstorming
├── workflow-session.json              # Session metadata ONLY
└── .brainstorming/
    ├── guidance-specification.md      # Framework (Phase 1)
    ├── {role-1}/
    │   └── analysis.md                # Role analysis (Phase 2)
    ├── {role-2}/
    │   └── analysis.md
    ├── {role-N}/
    │   └── analysis.md
    └── synthesis-specification.md     # Integration (Phase 3)
```

**Template Source**: `~/.claude/workflows/cli-templates/planning-roles/`

