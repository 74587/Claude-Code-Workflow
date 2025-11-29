---
name: task-generate-agent
description: Generate implementation plan documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent - produces planning artifacts, does NOT execute code implementation
argument-hint: "--session WFS-session-id"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
---

# Generate Implementation Plan Command

## Overview
Generate implementation planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent. This command produces **planning artifacts only** - it does NOT execute code implementation. Actual code implementation requires separate execution command (e.g., /workflow:execute).

## Core Philosophy
- **Planning Only**: Generate planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) - does NOT implement code
- **Agent-Driven Document Generation**: Delegate plan generation to action-planning-agent
- **Progressive Loading**: Load context incrementally (Core → Selective → On-Demand) due to analysis.md file size
- **Two-Phase Flow**: Discovery (context gathering) → Output (planning document generation)
- **Memory-First**: Reuse loaded documents from conversation memory
- **Smart Selection**: Load synthesis_output OR guidance + relevant role analyses, NOT all role analyses
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root (e.g., `./src/module`)

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session
   └─ Validation: session_id REQUIRED

Phase 1: Context Preparation (Command)
   ├─ Assemble session paths (metadata, context package, output dirs)
   └─ Provide metadata (session_id, execution_mode, mcp_capabilities)

Phase 2: Planning Document Generation (Agent)
   ├─ Load context package (progressive loading strategy)
   ├─ Generate Task JSON Files (.task/IMPL-*.json)
   ├─ Create IMPL_PLAN.md
   └─ Generate TODO_LIST.md
```

## Document Generation Lifecycle

### Phase 1: Context Preparation (Command Responsibility)

**Command prepares session paths and metadata for planning document generation.**

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
   - `mcp_capabilities` (available MCP tools)

**Note**: CLI tool usage is now determined semantically by action-planning-agent based on user's task description, not by flags.

### Phase 2: Planning Document Generation (Agent Responsibility)

**Purpose**: Generate IMPL_PLAN.md, task JSONs, and TODO_LIST.md - planning documents only, NOT code implementation.

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md)",
  prompt=`
## TASK OBJECTIVE
Generate implementation planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) for workflow session

IMPORTANT: This is PLANNING ONLY - you are generating planning documents, NOT implementing code.

CRITICAL: Follow the progressive loading strategy defined in agent specification (load analysis.md files incrementally due to file size)

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{session-id}/workflow-session.json
  - Context Package: .workflow/active/{session-id}/.process/context-package.json

Output:
  - Task Dir: .workflow/active/{session-id}/.task/
  - IMPL_PLAN: .workflow/active/{session-id}/IMPL_PLAN.md
  - TODO_LIST: .workflow/active/{session-id}/TODO_LIST.md

## CONTEXT METADATA
Session ID: {session-id}
MCP Capabilities: {exa_code, exa_web, code_index}

## CLI TOOL SELECTION
Determine CLI tool usage per-step based on user's task description:
- If user specifies "use Codex/Gemini/Qwen for X" → Add command field to relevant steps
- Default: Agent execution (no command field) unless user explicitly requests CLI

## EXPLORATION CONTEXT (from context-package.exploration_results)
- Load exploration_results from context-package.json
- Use aggregated_insights.critical_files for focus_paths generation
- Apply aggregated_insights.constraints to acceptance criteria
- Reference aggregated_insights.all_patterns for implementation approach
- Use aggregated_insights.all_integration_points for precise modification locations
- Use conflict_indicators for risk-aware task sequencing

## EXPECTED DELIVERABLES
1. Task JSON Files (.task/IMPL-*.json)
   - 6-field schema (id, title, status, context_package_path, meta, context, flow_control)
   - Quantified requirements with explicit counts
   - Artifacts integration from context package
   - **focus_paths enhanced with exploration critical_files**
   - Flow control with pre_analysis steps (include exploration integration_points analysis)

2. Implementation Plan (IMPL_PLAN.md)
   - Context analysis and artifact references
   - Task breakdown and execution strategy
   - Complete structure per agent definition

3. TODO List (TODO_LIST.md)
   - Hierarchical structure (containers, pending, completed markers)
   - Links to task JSONs and summaries
   - Matches task JSON hierarchy

## QUALITY STANDARDS
Hard Constraints:
  - Task count <= 12 (hard limit - request re-scope if exceeded)
  - All requirements quantified (explicit counts and enumerated lists)
  - Acceptance criteria measurable (include verification commands)
  - Artifact references mapped from context package
  - All documents follow agent-defined structure

## SUCCESS CRITERIA
- All planning documents generated successfully:
  - Task JSONs valid and saved to .task/ directory
  - IMPL_PLAN.md created with complete structure
  - TODO_LIST.md generated matching task JSONs
- Return completion status with document count and task breakdown summary
`
)
```

、