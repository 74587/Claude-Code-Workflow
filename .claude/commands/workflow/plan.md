---
name: plan
description: Create implementation plans by orchestrating intelligent context gathering and analysis modules
usage: /workflow:plan [--agent] <input>
argument-hint: "[--agent] \"text description\"|file.md|ISS-001"
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan --agent "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
---

# Workflow Plan Command (/workflow:plan)

## Overview
Creates comprehensive implementation plans by orchestrating intelligent context gathering and analysis modules. Integrates with workflow session management, brainstorming artifacts, and automated task generation.

**Execution Modes**:
- **Manual Mode** (default): Command-driven task generation with phase-by-phase control
- **Agent Mode** (`--agent`): Autonomous agent-driven task generation using action-planning-agent

## Core Planning Principles

**⚡ Autonomous Execution Mandate**: Complete all planning phases sequentially without user interruption—from session initialization through task generation—ensuring full workflow integrity.

### Task Decomposition Standards

**Core Principle: Task Merging Over Decomposition**
- **Merge Rule**: Tasks that can be executed together should not be separated - avoid unnecessary decomposition
- **Decomposition Criteria**: Only decompose tasks in the following situations:
  - **Excessive Workload**: Code exceeds 2500 lines or modifies more than 6 files
  - **Context Separation**: Involves completely different tech stacks or business domains
  - **Dependency Blocking**: Subsequent tasks must wait for prerequisite task completion
  - **Parallel Execution**: Independent features that can be developed simultaneously by different developers

**Task Limits & Structure**:
- **Maximum 10 tasks**: Hard limit - exceeding requires re-scoping
- **Function-based**: Complete functional units with related files (logic + UI + tests + config)
- **File cohesion**: Group tightly coupled components in same task
- **Hierarchy**: Flat (≤5 tasks) | Two-level (6-10 tasks) | Re-scope (>10 tasks)

**Task Pattern Examples**:
- ✅ **Correct (Function-based)**: `IMPL-001: User authentication system` (models + routes + components + middleware + tests)
- ❌ **Wrong (File/step-based)**: `IMPL-001: Create database model`, `IMPL-002: Create API endpoint`

### Task JSON Creation Process

**Task JSON Generation Philosophy**:
1. **Analysis-Driven**: Task definitions generated from intelligent analysis results
2. **Context-Rich**: Each task includes comprehensive context for autonomous execution
3. **Flow-Control Ready**: Pre-analysis steps and implementation approach pre-defined
4. **Agent-Optimized**: Complete context provided for specialized agent execution
5. **Artifacts-Integrated**: Automatically detect and reference brainstorming artifacts
6. **Design-Context-Aware**: Ensure design documents are loaded in pre_analysis steps

**Automatic Task Generation Workflow**:
1. **Parse Analysis Results**: Extract task recommendations from ANALYSIS_RESULTS.md
2. **Extract Task Details**: Parse task ID, title, scope, complexity from structured analysis
3. **Detect Brainstorming Artifacts**: Scan for ui-designer, system-architect, and other role outputs
4. **Generate Context**: Create requirements, focus_paths, acceptance criteria, and artifacts references
5. **Build Enhanced Flow Control**: Define pre_analysis steps with artifact loading and implementation approach
6. **Create Artifact-Aware JSON Files**: Generate individual .task/IMPL-*.json files with enhanced schema

## Critical Process Requirements

### Session Management ⚠️ CRITICAL FIRST STEP
- **⚡ FIRST ACTION**: Execute `SlashCommand(command="/workflow:session:start --auto \"[task-description]\"")` for intelligent session discovery
- **Command Integration**: Uses `/workflow:session:start --auto` for automated session discovery and creation
- **Auto Mode Behavior**: Automatically analyzes relevance and selects/creates appropriate session
- **Relevance Analysis**: Keyword-based matching between task description and existing session projects
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists or task is unrelated
- **Session continuity**: MUST use selected active session to maintain context
- **⚠️ Dependency context**: MUST read ALL previous task summary documents from selected session before planning
- **Session isolation**: Each session maintains independent context and state
- **Output Parsing**: Extract session ID from output line matching pattern `SESSION_ID: WFS-[id]`

### Session ID Transmission Guidelines ⚠️ CRITICAL
- **Format**: `WFS-[topic-slug]` from active session markers
- **Usage**: `SlashCommand(command="/workflow:tools:context-gather --session WFS-[id]")` and `SlashCommand(command="/workflow:tools:concept-enhanced --session WFS-[id]")`
- **Rule**: ALL modular commands MUST receive current session ID for context continuity

### Brainstorming Artifacts Integration ⚠️ NEW FEATURE
- **Artifact Detection**: Automatically scan .brainstorming/ directory for role outputs
- **Role-Task Mapping**: Map brainstorming roles to task types (ui-designer → UI tasks)
- **Artifact References**: Create structured references to design documents and specifications
- **Context Enhancement**: Load artifacts in pre_analysis steps to provide complete design context

## Planning Execution Lifecycle

### Phase 1: Session Management & Discovery ⚠️ TodoWrite Control
1. **TodoWrite Initialization**: Initialize flow control, mark first phase as `in_progress`
2. **Session Discovery**: Execute `SlashCommand(command="/workflow:session:start --auto \"[task-description]\"")`
3. **Parse Session ID**: Extract session ID from command output matching pattern `SESSION_ID: WFS-[id]`
4. **Validate Session**: Verify session directory structure and metadata exist
5. **Context Preparation**: Load session state and prepare for planning
6. **TodoWrite Update**: Mark phase 1 as `completed`, phase 2 as `in_progress`

**Note**: The `--auto` flag enables automatic relevance analysis and session selection/creation without user interaction.

### Phase 2: Context Gathering & Asset Discovery ⚠️ TodoWrite Control
1. **Context Collection**: Execute `SlashCommand(command="/workflow:tools:context-gather --session WFS-[id] \"task description\"")`
2. **Asset Discovery**: Gather relevant documentation, code, and configuration files
3. **Context Packaging**: Generate standardized context-package.json
4. **Validation**: Ensure context package contains sufficient information for analysis
5. **TodoWrite Update**: Mark phase 2 as `completed`, phase 3 as `in_progress`

### Phase 3: Intelligent Analysis & Tool Orchestration ⚠️ TodoWrite Control
1. **Analysis Execution**: Execute `SlashCommand(command="/workflow:tools:concept-enhanced --session WFS-[id] --context path/to/context-package.json")` (delegated to independent concept-enhanced command)
2. **Context Passing**: Pass session ID and context package path from Phase 2 to enable comprehensive analysis
3. **Result Generation**: Produce structured ANALYSIS_RESULTS.md with task recommendations via concept-enhanced command
4. **Validation**: Verify analysis completeness and task recommendations from concept-enhanced output
5. **TodoWrite Update**: Mark phase 3 as `completed`, phase 4 as `in_progress`

### Phase 4: Plan Assembly & Artifact Integration ⚠️ TodoWrite Control
**Delegated to**:
- Manual Mode: `/workflow:tools:task-generate --session WFS-[id]`
- Agent Mode: `/workflow:tools:task-generate-agent --session WFS-[id]`

Execute task generation command to:
1. **Artifact Detection**: Scan session for brainstorming outputs (.brainstorming/ directory)
2. **Plan Generation**: Create IMPL_PLAN.md from analysis results and artifacts
3. **Enhanced Task JSON Creation**: Generate task JSON files with artifacts integration (5-field schema)
4. **TODO List Creation**: Generate TODO_LIST.md with artifact references
5. **Session Update**: Mark session as ready for execution with artifact context
6. **TodoWrite Completion Validation**: Ensure all phases are marked as `completed` for complete execution

**Command Execution**:
```bash
# Manual Mode (default)
SlashCommand(command="/workflow:tools:task-generate --session WFS-[id]")

# Agent Mode (if --agent flag provided)
SlashCommand(command="/workflow:tools:task-generate-agent --session WFS-[id]")
```

**Reference Documentation**:
- Manual: `@.claude/commands/workflow/tools/task-generate.md`
- Agent: `@.claude/commands/workflow/tools/task-generate-agent.md`

## TodoWrite Progress Tracking ⚠️ CRITICAL FLOW CONTROL

**TodoWrite Control Ensures Complete Workflow Execution** - Guarantees planning lifecycle integrity through real-time status tracking:

### TodoWrite Flow Control Rules ⚠️ MANDATORY
1. **Process Integrity Guarantee**: TodoWrite is the key control mechanism ensuring all planning phases execute in sequence
2. **Phase Gating**: Must wait for previous phase `completed` before starting next phase
3. **SlashCommand Synchronization**: Update TodoWrite status before and after each SlashCommand execution
4. **Error Recovery**: If phase fails, TodoWrite maintains `in_progress` status until issue resolved
5. **Process Validation**: Verify all required phases completed through TodoWrite

### TodoWrite Execution Control Rules
1. **Initial Creation**: Generate TodoWrite task list from planning phases
2. **Single Execution**: Only one task can be `in_progress` at any time
3. **Immediate Updates**: Update status to `completed` immediately after each phase completion
4. **Continuous Tracking**: Maintain TodoWrite state throughout entire planning workflow
5. **Integrity Validation**: Final verification that all tasks are `completed` status

### TodoWrite Tool Usage

**Core Control Rule**: Monitor SlashCommand completion status to ensure sequential execution

```javascript
// Flow Control Example: Ensure Complete Execution of All Planning Phases
// Step 1: Initialize Flow Control
TodoWrite({
  todos: [
    {"content": "Initialize session management and discovery", "status": "in_progress", "activeForm": "Initializing session management and discovery"},
    {"content": "Detect and analyze brainstorming artifacts", "status": "pending", "activeForm": "Detecting and analyzing brainstorming artifacts"},
    {"content": "Gather intelligent context and assets", "status": "pending", "activeForm": "Gathering intelligent context and assets"},
    {"content": "Execute intelligent analysis and tool orchestration", "status": "pending", "activeForm": "Executing intelligent analysis and tool orchestration"},
    {"content": "Generate artifact-enhanced implementation plan and tasks", "status": "pending", "activeForm": "Generating artifact-enhanced implementation plan and tasks"}
  ]
})

// Step 2: Execute SlashCommand and Update Status Immediately
SlashCommand(command="/workflow:session:start --auto \"task-description\"")
// After command completion:
TodoWrite({
  todos: [
    {"content": "Initialize session management and discovery", "status": "completed", "activeForm": "Initializing session management and discovery"},
    {"content": "Detect and analyze brainstorming artifacts", "status": "in_progress", "activeForm": "Detecting and analyzing brainstorming artifacts"},
    {"content": "Gather intelligent context and assets", "status": "pending", "activeForm": "Gathering intelligent context and assets"},
    {"content": "Execute intelligent analysis and tool orchestration", "status": "pending", "activeForm": "Executing intelligent analysis and tool orchestration"},
    {"content": "Generate artifact-enhanced implementation plan and tasks", "status": "pending", "activeForm": "Generating artifact-enhanced implementation plan and tasks"}
  ]
})

// Step 3: Continue Next SlashCommand
SlashCommand(command="/workflow:tools:context-gather --session WFS-[id] \"task description\"")
// Repeat this pattern until all phases completed
```

### Flow Control Validation Checkpoints
- ✅ **Phase Completion Verification**: Check return status after each SlashCommand execution
- ✅ **Dependency Checking**: Ensure prerequisite phases completed before starting next phase
- ✅ **Error Handling**: If command fails, remain in current phase until issue resolved
- ✅ **Final Validation**: All todos status must be `completed` for planning completion

## Output Documents

### Generated Files
**Documents Created by Phase 4** (`/workflow:tools:task-generate`):
- **IMPL_PLAN.md**: Implementation plan with context analysis and artifact references
- **.task/*.json**: Task definitions using 5-field schema with flow_control and artifacts
- **TODO_LIST.md**: Progress tracking (container tasks with ▸, leaf tasks with checkboxes)

**Key Schemas**:
- **Task JSON**: 5-field schema (id, title, status, meta, context, flow_control) with artifacts integration
- **Artifacts**: synthesis-specification.md (highest), topic-framework.md (medium), role analyses (low)
- **Flow Control**: Pre-analysis steps for artifact loading, MCP tools, and pattern analysis

**Architecture Reference**: `@~/.claude/workflows/workflow-architecture.md`

## Command Chain Integration
1. `/workflow:plan [--agent]` → Orchestrates planning phases and delegates to modular commands
2. `/workflow:tools:context-gather` → Collects project context (Phase 2)
3. `/workflow:tools:concept-enhanced` → Analyzes and generates recommendations (Phase 3)
4. `/workflow:tools:task-generate` or `/workflow:tools:task-generate-agent` → Creates tasks and documents (Phase 4)

**Next Steps** (manual execution):
- Run `/workflow:execute` to begin task execution
- Run `/workflow:status` to check planning results and task status