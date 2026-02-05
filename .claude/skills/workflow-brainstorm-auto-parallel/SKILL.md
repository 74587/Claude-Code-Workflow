---
name: workflow-brainstorm-auto-parallel
description: Parallel brainstorming automation with dynamic role selection and concurrent execution across multiple perspectives. Triggers on "workflow:brainstorm:auto-parallel".
allowed-tools: Task, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Brainstorm Auto-Parallel

Parallel brainstorming automation orchestrating interactive framework generation, concurrent multi-role analysis, and synthesis integration to produce comprehensive guidance specifications.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Auto-Parallel Orchestrator (SKILL.md)                          │
│  → Pure coordinator: Execute phases, parse outputs, manage tasks│
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Phase 0 │ │ Phase 1 │ │ Phase 2 │ │ Phase 3 │
│  Parse  │ │Framework│ │Parallel │ │Synthesis│
│  Params │ │Generate │ │  Roles  │ │Integrate│
└─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓           ↓
  count,    guidance-   N role      synthesis-
style-skill specification analyses  specification
```

## Key Design Principles

1. **Pure Orchestrator**: Execute phases in sequence (Phase 1, 3 sequential; Phase 2 parallel)
2. **Auto-Continue**: All phases run autonomously without user intervention between phases
3. **Task Attachment Model**: Sub-tasks are attached/collapsed dynamically in TodoWrite
4. **Progressive Phase Loading**: Phase docs are read on-demand when phase executes
5. **Parallel Execution**: Phase 2 launches N role agents concurrently

## Auto Mode

When `--yes` or `-y`: Auto-select recommended roles, skip all clarification questions, use default answers.

## Execution Flow

```
Parameter Parsing:
   ├─ Extract --count N (default: 3, max: 9)
   ├─ Extract --style-skill package-name (optional, for ui-designer)
   └─ Validate style SKILL package exists

Phase 1: Interactive Framework Generation
   └─ Ref: phases/01-interactive-framework.md
      ├─ Tasks attached: Phase 0-5 (Context → Topic → Roles → Questions → Conflicts → Spec)
      ├─ Output: guidance-specification.md + workflow-session.json
      └─ Parse: selected_roles[], session_id

Phase 2: Parallel Role Analysis
   └─ Ref: phases/02-parallel-role-analysis.md
      ├─ Tasks attached: N role agents (concurrent execution)
      ├─ For each role: Execute conceptual-planning-agent
      ├─ Optional: ui-designer appends --style-skill if provided
      └─ Output: [role]/analysis*.md (one per role)

Phase 3: Synthesis Integration
   └─ Ref: phases/03-synthesis-integration.md
      ├─ Tasks attached: Load → Analyze → Integrate → Generate
      ├─ Input: All role analyses + guidance-specification.md
      └─ Output: synthesis-specification.md

Return:
   └─ Summary with session info and next steps
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-interactive-framework.md](phases/01-interactive-framework.md) | Interactive clarification generating confirmed guidance specification through role-based analysis |
| 2 | [phases/02-parallel-role-analysis.md](phases/02-parallel-role-analysis.md) | Unified role-specific analysis generation with interactive context gathering and concurrent execution |
| 3 | [phases/03-synthesis-integration.md](phases/03-synthesis-integration.md) | Cross-role synthesis integration with intelligent Q&A and targeted updates |

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is parameter parsing
2. **No Preliminary Analysis**: Do not analyze topic before Phase 1 - artifacts handles all analysis
3. **Parse Every Output**: Extract selected_roles from workflow-session.json after Phase 1
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite dynamically with task attachment/collapse pattern
6. **Task Attachment Model**: Phase executes **attach** sub-tasks to current workflow. Orchestrator **executes** these attached tasks, then **collapses** them after completion
7. **⚠️ CRITICAL: DO NOT STOP**: Continuous multi-phase workflow. After executing all attached tasks, immediately collapse them and execute next phase
8. **Parallel Execution**: Phase 2 attaches multiple agent tasks simultaneously for concurrent execution
9. **Progressive Phase Loading**: Read phase docs ONLY when that phase is about to execute

## Usage

```
Trigger: "workflow:brainstorm:auto-parallel"
Input: "<topic>" [--count N] [--style-skill package-name]
```

**Recommended Structured Format**:
```
Input: "GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]" [--count N] [--style-skill package-name]
```

**Parameters**:
- `topic` (required): Topic or challenge description (structured format recommended)
- `--count N` (optional): Number of roles to select (default: 3, max: 9)
- `--style-skill package-name` (optional): Style SKILL package to load for ui-designer (located at `.claude/skills/style-{package-name}/`)

## Data Flow

### Phase 0 → Phase 1

**Input**:
- `topic`: User-provided topic or challenge description
- `count`: Number of roles to select (parsed from --count parameter)
- `style_skill_package`: Style SKILL package name (parsed from --style-skill parameter)

**Output**: None (in-memory variables)

### Phase 1 → Phase 2

**Input**: `topic`, `count`, `style_skill_package`

**Output**:
- `session_id`: Workflow session identifier (WFS-{topic-slug})
- `selected_roles[]`: Array of selected role names
- `guidance-specification.md`: Framework content
- `workflow-session.json`: Session metadata

**Parsing**:
```javascript
// Read workflow-session.json after Phase 1
const session_data = Read(".workflow/active/WFS-{topic}/workflow-session.json");
const selected_roles = session_data.selected_roles;
const session_id = session_data.session_id;
const style_skill_package = session_data.style_skill_package || null;
```

### Phase 2 → Phase 3

**Input**: `session_id`, `selected_roles[]`, `style_skill_package`

**Output**:
- `[role]/analysis*.md`: One analysis per selected role
- `.superdesign/design_iterations/`: UI design artifacts (if --style-skill provided)

**Validation**:
```javascript
// Verify all role analyses created
for (const role of selected_roles) {
  const analysis_path = `${brainstorm_dir}/${role}/analysis.md`;
  if (!exists(analysis_path)) {
    ERROR: `Missing analysis for ${role}`;
  }
}
```

### Phase 3 → Completion

**Input**: `session_id`, all role analyses, guidance-specification.md

**Output**:
- `synthesis-specification.md`: Integrated cross-role analysis

**Validation**:
```javascript
const synthesis_path = `${brainstorm_dir}/synthesis-specification.md`;
if (!exists(synthesis_path)) {
  ERROR: "Synthesis generation failed";
}
```

## TodoWrite Pattern

**Core Concept**: Dynamic task attachment and collapse for parallel brainstorming workflow with interactive framework generation and concurrent role analysis.

### Key Principles

1. **Task Attachment** (when Phase executed):
   - Phase's internal tasks are **attached** to orchestrator's TodoWrite
   - Phase 1: artifacts attaches 5 internal tasks (Phase 0-5)
   - Phase 2: Multiple role-analysis calls attach N role analysis tasks simultaneously
   - Phase 3: synthesis attaches internal tasks
   - First attached task marked as `in_progress`, others as `pending`
   - Orchestrator **executes** these attached tasks (sequentially for Phase 1, 3; in parallel for Phase 2)

2. **Task Collapse** (after sub-tasks complete):
   - Remove detailed sub-tasks from TodoWrite
   - **Collapse** to high-level phase summary
   - Example: Phase 1 sub-tasks collapse to "Phase 1: Interactive Framework Generation: completed"
   - Phase 2: Multiple role tasks collapse to "Phase 2: Parallel Role Analysis: completed"
   - Phase 3: Synthesis tasks collapse to "Phase 3: Synthesis Integration: completed"
   - Maintains clean orchestrator-level view

3. **Continuous Execution**:
   - After collapse, automatically proceed to next pending phase
   - No user intervention required between phases
   - TodoWrite dynamically reflects current execution state

**Lifecycle Summary**: Initial pending tasks → Phase 1 executed (artifacts tasks ATTACHED) → Artifacts sub-tasks executed → Phase 1 completed (tasks COLLAPSED) → Phase 2 executed (N role tasks ATTACHED in parallel) → Role analyses executed concurrently → Phase 2 completed (tasks COLLAPSED) → Phase 3 executed (synthesis tasks ATTACHED) → Synthesis sub-tasks executed → Phase 3 completed (tasks COLLAPSED) → Workflow complete.

### Brainstorming Workflow Specific Features

- **Phase 1**: Interactive framework generation with user Q&A (Phase attachment)
- **Phase 2**: Parallel role analysis execution with N concurrent agents (Task agent attachments)
- **Phase 3**: Cross-role synthesis integration (Phase attachment)
- **Dynamic Role Count**: `--count N` parameter determines number of Phase 2 parallel tasks (default: 3, max: 9)
- **Mixed Execution**: Sequential (Phase 1, 3) and Parallel (Phase 2) task execution

### Initial TodoWrite (Workflow Start)

```json
[
  {"content": "Phase 0: Parameter Parsing", "status": "in_progress", "activeForm": "Parsing parameters"},
  {"content": "Phase 1: Interactive Framework Generation", "status": "pending", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Phase 2: Parallel Role Analysis", "status": "pending", "activeForm": "Executing parallel role analysis"},
  {"content": "Phase 3: Synthesis Integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]
```

### Phase 1 Task Attachment (Artifacts Execution)

```json
[
  {"content": "Phase 0: Parameter Parsing", "status": "completed", "activeForm": "Parsing parameters"},
  {"content": "Phase 1: Interactive Framework Generation", "status": "in_progress", "activeForm": "Executing artifacts interactive framework"},
  {"content": "  → Phase 0: Context collection", "status": "in_progress", "activeForm": "Collecting context"},
  {"content": "  → Phase 1: Topic analysis", "status": "pending", "activeForm": "Analyzing topic"},
  {"content": "  → Phase 2: Role selection", "status": "pending", "activeForm": "Selecting roles"},
  {"content": "  → Phase 3: Role questions", "status": "pending", "activeForm": "Collecting role questions"},
  {"content": "  → Phase 4: Conflict resolution", "status": "pending", "activeForm": "Resolving conflicts"},
  {"content": "  → Phase 5: Generate specification", "status": "pending", "activeForm": "Generating specification"},
  {"content": "Phase 2: Parallel Role Analysis", "status": "pending", "activeForm": "Executing parallel role analysis"},
  {"content": "Phase 3: Synthesis Integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]
```

### Phase 1 Task Collapse (Artifacts Completed)

```json
[
  {"content": "Phase 0: Parameter Parsing", "status": "completed", "activeForm": "Parsing parameters"},
  {"content": "Phase 1: Interactive Framework Generation", "status": "completed", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Phase 2: Parallel Role Analysis", "status": "pending", "activeForm": "Executing parallel role analysis"},
  {"content": "Phase 3: Synthesis Integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]
```

### Phase 2 Task Attachment (Parallel Role Execution)

```json
[
  {"content": "Phase 0: Parameter Parsing", "status": "completed", "activeForm": "Parsing parameters"},
  {"content": "Phase 1: Interactive Framework Generation", "status": "completed", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Phase 2: Parallel Role Analysis", "status": "in_progress", "activeForm": "Executing parallel role analysis"},
  {"content": "  → Execute system-architect analysis", "status": "in_progress", "activeForm": "Executing system-architect analysis"},
  {"content": "  → Execute ui-designer analysis", "status": "in_progress", "activeForm": "Executing ui-designer analysis"},
  {"content": "  → Execute product-manager analysis", "status": "in_progress", "activeForm": "Executing product-manager analysis"},
  {"content": "Phase 3: Synthesis Integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]
```

### Phase 2 Task Collapse (All Roles Completed)

```json
[
  {"content": "Phase 0: Parameter Parsing", "status": "completed", "activeForm": "Parsing parameters"},
  {"content": "Phase 1: Interactive Framework Generation", "status": "completed", "activeForm": "Executing artifacts interactive framework"},
  {"content": "Phase 2: Parallel Role Analysis", "status": "completed", "activeForm": "Executing parallel role analysis"},
  {"content": "Phase 3: Synthesis Integration", "status": "pending", "activeForm": "Executing synthesis integration"}
]
```

## Session Management

**⚡ FIRST ACTION**: Check `.workflow/active/` for existing sessions before Phase 1

**Multiple Sessions Support**:
- Different Claude instances can have different brainstorming sessions
- If multiple sessions found, prompt user to select
- If single session found, use it
- If no session exists, create `WFS-[topic-slug]`

**Session Continuity**:
- MUST use selected session for all phases
- Each role's context stored in session directory
- Session isolation: Each session maintains independent state

## Output Structure

**Phase 1 Output**:
- `.workflow/active/WFS-{topic}/.brainstorming/guidance-specification.md` (framework content)
- `.workflow/active/WFS-{topic}/workflow-session.json` (metadata: selected_roles[], topic, timestamps, style_skill_package)

**Phase 2 Output**:
- `.workflow/active/WFS-{topic}/.brainstorming/{role}/analysis.md` (one per role)
- `.superdesign/design_iterations/` (ui-designer artifacts, if --style-skill provided)

**Phase 3 Output**:
- `.workflow/active/WFS-{topic}/.brainstorming/synthesis-specification.md` (integrated analysis)

**⚠️ Storage Separation**: Guidance content in .md files, metadata in .json (no duplication)
**⚠️ Style References**: When --style-skill provided, workflow-session.json stores style_skill_package name, ui-designer loads from `.claude/skills/style-{package-name}/`

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

**Role Selection**: Handled by Phase 1 (artifacts) - intelligent recommendation + user selection

## Error Handling

- **Role selection failure**: Phase 1 defaults to product-manager with explanation
- **Agent execution failure**: Agent-specific retry with minimal dependencies
- **Template loading issues**: Agent handles graceful degradation
- **Synthesis conflicts**: Phase 3 highlights disagreements without resolution
- **Context overflow protection**: Per-role limits enforced by conceptual-planning-agent

## Reference Information

**File Structure**:
```
.workflow/active/WFS-[topic]/
├── workflow-session.json              # Session metadata ONLY
└── .brainstorming/
    ├── guidance-specification.md      # Framework (Phase 1)
    ├── {role}/
    │   ├── analysis.md                # Main document (with optional @references)
    │   └── analysis-{slug}.md         # Section documents (max 5)
    └── synthesis-specification.md     # Integration (Phase 3)
```

**Next Steps** (returned to user):
```
Brainstorming complete for session: {sessionId}
Roles analyzed: {count}
Synthesis: .workflow/active/WFS-{topic}/.brainstorming/synthesis-specification.md

✅ Next Steps:
1. Phase 3 synthesis (phases/03-synthesis-integration.md) - Optional refinement (if not auto-executed)
2. Planning workflow (workflow-plan/SKILL.md) --session {sessionId} - Generate implementation plan
```
