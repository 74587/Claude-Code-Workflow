---
name: task-generate-agent
description: Autonomous task generation using action-planning-agent with discovery and output phases for workflow planning
argument-hint: "--session WFS-session-id [--cli-execute]"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
  - /workflow:tools:task-generate-agent --session WFS-auth --cli-execute
---

# Autonomous Task Generation Command

## Overview
Autonomous task JSON and IMPL_PLAN.md generation using action-planning-agent with two-phase execution: discovery and document generation. Supports both agent-driven execution (default) and CLI tool execution modes.

## Core Philosophy
- **Agent-Driven**: Delegate execution to action-planning-agent for autonomous operation
- **Two-Phase Flow**: Discovery (context gathering) → Output (document generation)
- **Memory-First**: Reuse loaded documents from conversation memory
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root (e.g., `./src/module`)

## Execution Lifecycle

### Phase 1: Context Preparation (Command Responsibility)

**Command prepares session paths and metadata, agent loads content autonomously.**

**Session Path Structure**:
```
.workflow/active/WFS-{session-id}/
├── workflow-session.json          # Session metadata
├── .process/
│   └── context-package.json       # Context package with artifact catalog
├── .task/                         # Output: Task JSON files
├── IMPL_PLAN.md                   # Output: Implementation plan
└── TODO_LIST.md                   # Output: TODO list
```

**Command Preparation**:
1. **Assemble Session Paths** for agent prompt:
   - `session_metadata_path`
   - `context_package_path`
   - Output directory paths

2. **Provide Metadata** (simple values):
   - `session_id`
   - `execution_mode` (agent-mode | cli-execute-mode)
   - `mcp_capabilities` (available MCP tools)

**Note**: Agent autonomously loads files based on context package content (dynamic, not fixed template). Brainstorming artifacts only loaded if they exist in session.

### Phase 2: Agent Execution (Document Generation)

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate task JSON and implementation plan",
  prompt=`
## Task Objective
Generate implementation plan (IMPL_PLAN.md), task JSONs, and TODO list for workflow session

## MANDATORY FIRST STEPS
1. Read session metadata: {session.session_metadata_path}
2. Load context package: {session.context_package_path}
3. **Dynamically load files based on context package content** (see below)

## Dynamic Content Loading Strategy

**Load files based on what exists in context package - NOT a fixed template**

### Step 1: Always Load (Required)
- **Session Metadata** → Extract user input
  - User description: Original task requirements
  - Project scope and boundaries
  - Technical constraints

### Step 2: Check Context Package (Conditional Loading)

**If `brainstorm_artifacts` exists in context package:**
- Load artifacts **in priority order** as listed below
- **If `brainstorm_artifacts` does NOT exist**: Skip to Step 3

**Priority Loading (when artifacts exist):**
1. **guidance-specification.md** (if `guidance_specification.exists = true`)
   - Overall design framework - use as primary reference

2. **Role Analyses** (if `role_analyses[]` array exists)
   - Load ALL role analysis files listed in array
   - Each file path: `role_analyses[i].files[j].path`

3. **Synthesis Output** (if `synthesis_output.exists = true`)
   - Integrated view with clarifications

4. **Conflict Resolution** (if `conflict_risk` = "medium" or "high")
   - Check `conflict_resolution.status`
   - If "resolved": Use updated artifacts (conflicts pre-addressed)

### Step 3: Extract Project Context
- `focus_areas`: Target directories for implementation
- `assets`: Existing code patterns to reuse

## Session Paths
- Session Metadata: .workflow/active/{session-id}/workflow-session.json
- Context Package: .workflow/active/{session-id}/.process/context-package.json
- Output Task Dir: .workflow/active/{session-id}/.task/
- Output IMPL_PLAN: .workflow/active/{session-id}/IMPL_PLAN.md
- Output TODO_LIST: .workflow/active/{session-id}/TODO_LIST.md

## Context Metadata
- Session ID: {session-id}
- Execution Mode: {agent-mode | cli-execute-mode}
- MCP Capabilities Available: {exa_code, exa_web, code_index}

**Note**: Content loading is **dynamic** based on actual files in session, not a fixed template

## Expected Deliverables
1. **Task JSON Files** (.task/IMPL-*.json)
   - 6-field schema (id, title, status, context_package_path, meta, context, flow_control)
   - Quantified requirements with explicit counts
   - Artifacts integration from context package
   - Flow control with pre_analysis steps

2. **Implementation Plan** (IMPL_PLAN.md)
   - Context analysis and artifact references
   - Task breakdown and execution strategy
   - Complete structure per agent definition

3. **TODO List** (TODO_LIST.md)
   - Hierarchical structure with status indicators (▸, [ ], [x])
   - Links to task JSONs and summaries
   - Matches task JSON hierarchy

## Quality Standards
- Task count ≤12 (hard limit)
- All requirements quantified (explicit counts and lists)
- Acceptance criteria measurable (verification commands)
- Artifact references mapped from context package
- All documents follow agent-defined structure

## Success Criteria
- All task JSONs valid and saved to .task/ directory
- IMPL_PLAN.md created with complete structure
- TODO_LIST.md generated matching task JSONs
- Return completion status with file count
`
)
```

**Key Changes from Previous Version**:
1. **Paths over Content**: Provide file paths for agent to read, not embedded content
2. **MANDATORY FIRST STEPS**: Explicit requirement to load session metadata and context package
3. **Complete Session Paths**: All file paths provided for agent operations
4. **Emphasized Deliverables**: Clear deliverable requirements with quality standards
5. **No Agent Self-Reference**: Removed "Refer to action-planning-agent.md" (agent knows its own definition)
6. **No Template Paths**: Removed all template references (agent has complete schema/structure definitions)
