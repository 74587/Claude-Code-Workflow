---
name: workflow-brainstorm-auto-parallel
description: Parallel brainstorming automation with dynamic role selection and concurrent execution across multiple perspectives. Triggers on "workflow:brainstorm:auto-parallel".
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Brainstorm Auto-Parallel

Parallel brainstorming automation orchestrating interactive framework generation, concurrent multi-role analysis, and synthesis integration to produce comprehensive guidance specifications.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Auto-Parallel Orchestrator (SKILL.md)                          │
│  → Pure coordinator: Execute phases, parse outputs, manage agents│
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
3. **Subagent Lifecycle**: Explicit lifecycle management with spawn_agent → wait → close_agent
4. **Progressive Phase Loading**: Phase docs are read on-demand when phase executes
5. **Parallel Execution**: Phase 2 launches N role agents concurrently
6. **Role Path Loading**: Subagent roles loaded via path reference in MANDATORY FIRST STEPS

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
      ├─ Sub-phases: Phase 0-5 (Context → Topic → Roles → Questions → Conflicts → Spec)
      ├─ Output: guidance-specification.md + workflow-session.json
      └─ Parse: selected_roles[], session_id

Phase 2: Parallel Role Analysis
   └─ Ref: phases/02-parallel-role-analysis.md
      ├─ Spawn N conceptual-planning-agent (concurrent execution)
      ├─ For each role: Execute framework-based analysis
      ├─ Optional: ui-designer appends --style-skill if provided
      ├─ Lifecycle: spawn_agent → batch wait → close_agent
      └─ Output: [role]/analysis*.md (one per role)

Phase 3: Synthesis Integration
   └─ Ref: phases/03-synthesis-integration.md
      ├─ Spawn cross-role analysis agent
      ├─ User interaction: Enhancement selection + clarifications
      ├─ Spawn parallel update agents (one per role)
      ├─ Lifecycle: spawn_agent → wait → close_agent for each agent
      └─ Output: synthesis-specification.md + updated analyses

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

1. **Start Immediately**: First action is parameter parsing
2. **No Preliminary Analysis**: Do not analyze topic before Phase 1 - artifacts handles all analysis
3. **Parse Every Output**: Extract selected_roles from workflow-session.json after Phase 1
4. **Auto-Continue**: Execute next pending phase automatically after previous completes
5. **Track Progress**: Phase execution state managed through workflow-session.json
6. **⚠️ CRITICAL: DO NOT STOP**: Continuous multi-phase workflow. After completing each phase, immediately proceed to next
7. **Parallel Execution**: Phase 2 spawns multiple agent tasks simultaneously for concurrent execution
8. **Progressive Phase Loading**: Read phase docs ONLY when that phase is about to execute
9. **Explicit Lifecycle**: Always close_agent after wait completes to free resources

## Usage

```bash
workflow:brainstorm:auto-parallel "<topic>" [--count N] [--style-skill package-name]
```

**Recommended Structured Format**:
```bash
workflow:brainstorm:auto-parallel "GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]" [--count N] [--style-skill package-name]
```

**Parameters**:
- `topic` (required): Topic or challenge description (structured format recommended)
- `--count N` (optional): Number of roles to select (default: 3, max: 9)
- `--style-skill package-name` (optional): Style SKILL package to load for ui-designer (located at `.codex/skills/style-{package-name}/`)

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
const session_data = Read("${projectRoot}/.workflow/active/WFS-{topic}/workflow-session.json");
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
- Updated `[role]/analysis*.md` with clarifications

**Validation**:
```javascript
const synthesis_path = `${brainstorm_dir}/synthesis-specification.md`;
if (!exists(synthesis_path)) {
  ERROR: "Synthesis generation failed";
}
```

## Subagent API Reference

### spawn_agent

Create a new subagent with task assignment.

```javascript
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

## TASK CONTEXT
${taskContext}

## DELIVERABLES
${deliverables}
`
})
```

### wait

Get results from subagent (only way to retrieve results).

```javascript
const result = wait({
  ids: [agentId],
  timeout_ms: 600000  // 10 minutes
})

if (result.timed_out) {
  // Handle timeout - can continue waiting or send_input to prompt completion
}

// Check completion status
if (result.status[agentId].completed) {
  const output = result.status[agentId].completed;
}
```

### send_input

Continue interaction with active subagent (for clarification or follow-up).

```javascript
send_input({
  id: agentId,
  message: `
## CLARIFICATION ANSWERS
${answers}

## NEXT STEP
Continue with analysis generation.
`
})
```

### close_agent

Clean up subagent resources (irreversible).

```javascript
close_agent({ id: agentId })
```

## Session Management

**⚡ FIRST ACTION**: Check `{projectRoot}/.workflow/active/` for existing sessions before Phase 1

**Multiple Sessions Support**:
- Different Codex instances can have different brainstorming sessions
- If multiple sessions found, prompt user to select
- If single session found, use it
- If no session exists, create `WFS-[topic-slug]`

**Session Continuity**:
- MUST use selected session for all phases
- Each role's context stored in session directory
- Session isolation: Each session maintains independent state

## Output Structure

**Phase 1 Output**:
- `{projectRoot}/.workflow/active/WFS-{topic}/.brainstorming/guidance-specification.md` (framework content)
- `{projectRoot}/.workflow/active/WFS-{topic}/workflow-session.json` (metadata: selected_roles[], topic, timestamps, style_skill_package)

**Phase 2 Output**:
- `{projectRoot}/.workflow/active/WFS-{topic}/.brainstorming/{role}/analysis.md` (one per role)
- `.superdesign/design_iterations/` (ui-designer artifacts, if --style-skill provided)

**Phase 3 Output**:
- `{projectRoot}/.workflow/active/WFS-{topic}/.brainstorming/synthesis-specification.md` (integrated analysis)
- Updated `[role]/analysis*.md` with Enhancements + Clarifications sections

**⚠️ Storage Separation**: Guidance content in .md files, metadata in .json (no duplication)
**⚠️ Style References**: When --style-skill provided, workflow-session.json stores style_skill_package name, ui-designer loads from `.codex/skills/style-{package-name}/`

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
- **Agent lifecycle errors**: Ensure close_agent in error paths to prevent resource leaks

## Reference Information

**File Structure**:
```
{projectRoot}/.workflow/active/WFS-[topic]/
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
Synthesis: {projectRoot}/.workflow/active/WFS-{topic}/.brainstorming/synthesis-specification.md

✅ Next Steps:
1. workflow:plan --session {sessionId}  # Generate implementation plan
```
