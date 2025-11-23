---
name: task-generate-agent
description: Generate implementation plan documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent - produces planning artifacts, does NOT execute code implementation
argument-hint: "--session WFS-session-id [--cli-execute]"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
  - /workflow:tools:task-generate-agent --session WFS-auth --cli-execute
---

# Generate Implementation Plan Command

## Overview
Generate implementation planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent. This command produces **planning artifacts only** - it does NOT execute code implementation. Actual code implementation requires separate execution command (e.g., /workflow:execute).

## Core Philosophy
- **Planning Only**: Generate planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) - does NOT implement code
- **Agent-Driven Document Generation**: Delegate plan generation to action-planning-agent
- **Progressive Loading**: Load content incrementally (Core → Selective → On-Demand) to avoid token overflow - NEVER load all files at once
- **Two-Phase Flow**: Discovery (context gathering) → Output (planning document generation)
- **Memory-First**: Reuse loaded documents from conversation memory
- **Smart Selection**: Load synthesis_output OR guidance + 1-2 role analyses, NOT all role analyses
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root (e.g., `./src/module`)

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
   - `execution_mode` (agent-mode | cli-execute-mode)
   - `mcp_capabilities` (available MCP tools)

**Note**: Agent uses **progressive loading strategy** to avoid token overflow. Load context incrementally (Core → Selective → On-Demand), NOT all files at once. Brainstorming artifacts loaded selectively based on availability and relevance.

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

CRITICAL: Use PROGRESSIVE loading to avoid token overflow - DO NOT load all files at once

## MANDATORY FIRST STEPS
1. Read session metadata: {session.session_metadata_path}
2. Load context package STRUCTURE ONLY: {session.context_package_path}
3. Use PROGRESSIVE 4-phase loading strategy (detailed below)

## PROGRESSIVE LOADING STRATEGY (4 Phases)

### PHASE 1: Core Context (REQUIRED - Always Load First)
Purpose: Establish baseline understanding without token overflow

Step 1.1 - Session Metadata:
  Read: {session.session_metadata_path}
  Extract: User description, project scope, technical constraints

Step 1.2 - Context Package Structure (catalog only, NOT file contents):
  Read: {session.context_package_path}
  Extract fields:
    - metadata (task_description, keywords, complexity)
    - project_context (architecture_patterns, tech_stack, conventions)
    - assets (file PATHS only, not contents)
    - brainstorm_artifacts (catalog structure with paths and priorities)
    - conflict_detection (risk_level)

Step 1.3 - Existing Plan (if resuming/refining):
  Check: .workflow/active/{session-id}/IMPL_PLAN.md
  Action: If exists, load for continuity; else skip

### PHASE 2: Selective Artifacts (CONDITIONAL - Load Smart, Not All)
Purpose: Get architectural guidance for planning task breakdown

Decision Tree (choose ONE option):

  OPTION A: synthesis_output exists (PREFERRED - most efficient)
    Load ONLY: brainstorm_artifacts.synthesis_output.path
    Skip: All role analyses (already integrated in synthesis)
    Reason: Synthesis already combines all perspectives

  OPTION B: NO synthesis, but guidance_specification exists
    Load: brainstorm_artifacts.guidance_specification.path
    Then load 1-2 most relevant role analyses based on task type:
      - Architecture/System: system-architect + data-architect
      - Frontend/UI: ui-designer + ux-expert
      - Backend/API: api-designer + subject-matter-expert
      - General: system-architect + subject-matter-expert
    Skip: Other role analyses (load on-demand only if needed)

  OPTION C: ONLY role analyses exist (no synthesis/guidance)
    Load: Top 2 highest-priority role analyses ONLY
    Skip: Other analyses (use selection guide from Option B)

Conflict Handling:
  If conflict_risk >= "medium":
    Check: conflict_detection.status
    If "resolved": Use latest artifact versions (conflicts pre-addressed)

### PHASE 3: On-Demand Deep Dive (OPTIONAL - Only When Insufficient)
Purpose: Load additional analysis files ONLY if Phase 2 lacks detail for task planning

When to use:
  - Complex planning requiring multi-role coordination
  - Specific expertise not covered in loaded artifacts
  - Task breakdown requires detailed role-specific requirements

How to load:
  - Load ONE additional analysis at a time
  - Prioritize based on planning needs
  - Justify each additional load explicitly

### PHASE 4: Project Assets (FINAL)
Purpose: Get concrete project context for task planning

Extract from context_package:
  - focus_areas: Target directories
  - assets.source_code: File PATHS (read content selectively if needed)
  - assets.documentation: Reference docs
  - dependencies: Internal and external

Rule: Load source code content ONLY when necessary for patterns/integration

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
Planning Mode: {agent-mode | cli-execute-mode}
MCP Capabilities: {exa_code, exa_web, code_index}

## EXPECTED DELIVERABLES
1. Task JSON Files (.task/IMPL-*.json)
   - 6-field schema (id, title, status, context_package_path, meta, context, flow_control)
   - Quantified requirements with explicit counts
   - Artifacts integration from context package
   - Flow control with pre_analysis steps

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

**Key Changes from Previous Version**:
1. **Progressive Loading Strategy**: 4-phase incremental loading (Core → Selective → On-Demand → Assets) to prevent token overflow from loading all files at once
2. **Smart Artifact Selection**: Load synthesis_output (if exists) OR guidance + 1-2 role analyses, NOT all role analyses simultaneously
3. **Existing Plan Priority**: Check and load previous IMPL_PLAN.md first for context continuity when resuming/refining
4. **Paths over Content**: Provide file paths for agent to read, not embedded content
5. **MANDATORY FIRST STEPS**: Explicit requirement to load session metadata and context package structure
6. **Complete Session Paths**: All file paths provided for agent operations
7. **Emphasized Deliverables**: Clear deliverable requirements with quality standards
8. **No Agent Self-Reference**: Removed "Refer to action-planning-agent.md" (agent knows its own definition)
9. **No Template Paths**: Removed all template references (agent has complete schema/structure definitions)
