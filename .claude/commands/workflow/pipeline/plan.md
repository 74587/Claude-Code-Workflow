---
name: plan
description: Create implementation plans by orchestrating intelligent context gathering and analysis modules
usage: /workflow:plan <input>
argument-hint: "text description"|file.md|ISS-001
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
---

# Workflow Plan Command (/workflow:plan)

## Overview
Creates implementation plans by orchestrating intelligent context gathering and analysis modules.

## Core Principles

### Task Decomposition Standards

**Core Principle: Task Merging Over Decomposition**
- **Merge Rule**: Tasks that can be executed together should not be separated - avoid unnecessary decomposition
- **Decomposition Criteria**: Only decompose tasks in the following situations:
  - **Excessive Workload**: Code exceeds 2500 lines or modifies more than 6 files
  - **Context Separation**: Involves completely different tech stacks or business domains
  - **Dependency Blocking**: Subsequent tasks must wait for prerequisite task completion
  - **Parallel Execution**: Independent features that can be developed simultaneously by different developers

**Rules**:
- **Maximum 10 tasks**: Hard limit - exceeding requires re-scoping
- **Function-based**: Complete functional units with related files (logic + UI + tests + config)
- **File cohesion**: Group tightly coupled components in same task
- **Hierarchy**: Flat (≤5 tasks) | Two-level (6-10 tasks) | Re-scope (>10 tasks)

**Task Patterns**:
- ✅ **Correct (Function-based)**: `IMPL-001: User authentication system` (models + routes + components + middleware + tests)
- ❌ **Wrong (File/step-based)**: `IMPL-001: Create database model`, `IMPL-002: Create API endpoint`

### Task JSON Creation Process

**Task JSON Generation Philosophy**:
1. **Analysis-Driven**: Task definitions generated from intelligent analysis results
2. **Context-Rich**: Each task includes comprehensive context for autonomous execution
3. **Flow-Control Ready**: Pre-analysis steps and implementation approach pre-defined
4. **Agent-Optimized**: Complete context provided for specialized agent execution

**Automatic Task Generation Workflow**:
1. **Parse Analysis Results**: Extract task recommendations from ANALYSIS_RESULTS.md
2. **Extract Task Details**: Parse task ID, title, scope, complexity from structured analysis
3. **Generate Context**: Create requirements, focus_paths, and acceptance criteria
4. **Build Flow Control**: Define pre_analysis steps and implementation approach
5. **Create JSON Files**: Generate individual .task/IMPL-*.json files with 5-field schema

### Session Management ⚠️ CRITICAL
- **Command**: Uses `/workflow:session:start` command for intelligent session discovery and creation
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before any planning
- **Relevance Analysis**: Automatically analyzes task relevance with existing sessions
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists or task is unrelated
- **Session continuity**: MUST use selected active session to maintain context
- **⚠️ Dependency context**: MUST read ALL previous task summary documents from selected session before planning
- **Session isolation**: Each session maintains independent context and state

### Session ID Transmission Guidelines ⚠️ CRITICAL
- **Format**: `WFS-[topic-slug]` from active session markers
- **Usage**: `/context:gather --session WFS-[id]` and `/analysis:run --session WFS-[id]`
- **Rule**: ALL modular commands MUST receive current session ID for context continuity


## Execution Lifecycle

### Phase 1: Session Management
1. **Session Discovery**: Use `/workflow:session:start` command for intelligent session discovery
2. **Relevance Analysis**: Automatically analyze task relevance with existing sessions
3. **Session Selection**: Auto-select or create session based on relevance analysis
4. **Context Preparation**: Load session state and prepare for planning

### Phase 2: Context Gathering
1. **Context Collection**: Execute `/context:gather` with task description and session ID
2. **Asset Discovery**: Gather relevant documentation, code, and configuration files
3. **Context Packaging**: Generate standardized context-package.json
4. **Validation**: Ensure context package contains sufficient information

### Phase 3: Intelligent Analysis
1. **Analysis Execution**: Run `/analysis:run` with context package and session ID
2. **Tool Selection**: Automatically select optimal analysis tools (Gemini/Qwen/Codex)
3. **Result Generation**: Produce structured ANALYSIS_RESULTS.md
4. **Validation**: Verify analysis completeness and task recommendations

### Phase 4: Plan Assembly & Document Generation
1. **Plan Generation**: Create IMPL_PLAN.md from analysis results
2. **Task JSON Creation**: Generate individual task JSON files with 5-field schema
3. **TODO List Creation**: Generate TODO_LIST.md with document format
4. **Session Update**: Mark session as ready for execution

## TodoWrite Progress Tracking
**Comprehensive planning tracking** with real-time status updates throughout entire planning lifecycle:

### TodoWrite Planning Rules
1. **Initial Creation**: Generate TodoWrite from planning phases
2. **Single In-Progress**: Mark ONLY ONE phase as `in_progress` at a time
3. **Immediate Updates**: Update status after each phase completion
4. **Continuous Tracking**: Maintain TodoWrite throughout entire planning workflow

### TodoWrite Tool Usage
```javascript
// Initialize planning workflow tracking
TodoWrite({
  todos: [
    {"content": "Initialize session management", "status": "pending", "activeForm": "Initializing session management"},
    {"content": "Gather intelligent context", "status": "pending", "activeForm": "Gathering intelligent context"},
    {"content": "Execute intelligent analysis", "status": "pending", "activeForm": "Executing intelligent analysis"},
    {"content": "Generate implementation plan and tasks", "status": "pending", "activeForm": "Generating implementation plan and tasks"}
  ]
})
```


### IMPL_PLAN.md Structure ⚠️ REQUIRED FORMAT

**File Header** (required)：
- **Identifier**: Unique project identifier and session ID, format WFS-[topic]
- **Source**: Input type, e.g. "User requirements analysis"
- **Analysis**: Analysis document reference

**Summary** (execution overview)：
- Concise description of core requirements and objectives
- Technical direction and implementation approach

**Context Analysis** (context analysis)：
- **Project** - Project type and architectural patterns
- **Modules** - Involved modules and component list
- **Dependencies** - Dependency mapping and constraints
- **Patterns** - Identified code patterns and conventions

**Task Breakdown** (task decomposition)：
- **Task Count** - Total task count and complexity level
- **Hierarchy** - Task organization structure (flat/hierarchical)
- **Dependencies** - Inter-task dependency graph

**Implementation Plan** (implementation plan)：
- **Execution Strategy** - Execution strategy and methodology
- **Resource Requirements** - Required resources and tool selection
- **Success Criteria** - Success criteria and acceptance conditions


## Reference Information

### Task JSON Schema (5-Field Architecture)
Each task.json uses the workflow-architecture.md 5-field schema:
- **id**: IMPL-N[.M] format (max 2 levels)
- **title**: Descriptive task name
- **status**: pending|active|completed|blocked|container
- **meta**: { type, agent }
- **context**: { requirements, focus_paths, acceptance, parent, depends_on, inherited, shared_context }
- **flow_control**: { pre_analysis[], implementation_approach, target_files[] }

**MCP Tools Integration**: Enhanced with optional MCP servers for advanced analysis:
- **Code Index MCP**: `mcp__code-index__find_files()`, `mcp__code-index__search_code_advanced()`
- **Exa MCP**: `mcp__exa__get_code_context_exa()` for external patterns




### Context Management & Agent Execution

**Agent Context Loading** ⚠️ CRITICAL
The following pre_analysis steps are generated for agent execution:

```json
// Example pre_analysis steps generated by /workflow:plan for agent execution
"flow_control": {
  "pre_analysis": [
    {
      "step": "load_planning_context",
      "action": "Load plan-generated analysis and context",
      "commands": [
        "Read(.workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md)",
        "Read(.workflow/WFS-[session]/.process/context-package.json)"
      ],
      "output_to": "planning_context"
    },
    {
      "step": "load_context_assets",
      "action": "Load structured assets from context package",
      "command": "Read(.workflow/WFS-[session]/.process/context-package.json)",
      "output_to": "context_assets"
    },
    {
      "step": "mcp_codebase_exploration",
      "action": "Explore codebase structure and patterns using MCP tools",
      "command": "mcp__code-index__find_files(pattern=\"[task_focus_patterns]\") && mcp__code-index__search_code_advanced(pattern=\"[relevant_patterns]\", file_pattern=\"[target_extensions]\")",
      "output_to": "codebase_structure"
    },
    {
      "step": "mcp_external_context",
      "action": "Get external API examples and best practices",
      "command": "mcp__exa__get_code_context_exa(query=\"[task_technology] [task_patterns]\", tokensNum=\"dynamic\")",
      "output_to": "external_context"
    },
    {
      "step": "load_dependencies",
      "action": "Retrieve dependency task summaries",
      "command": "bash(cat .workflow/WFS-[session]/.summaries/IMPL-[dependency_id]-summary.md 2>/dev/null || echo 'dependency summary not found')",
      "output_to": "dependency_context"
    },
    {
      "step": "load_base_documentation",
      "action": "Load core documentation files",
      "commands": [
        "bash(cat .workflow/docs/README.md 2>/dev/null || echo 'base docs not found')",
        "bash(cat CLAUDE.md README.md 2>/dev/null || echo 'project docs not found')"
      ],
      "output_to": "base_docs"
    },
    {
      "step": "load_task_specific_docs",
      "action": "Load documentation relevant to task type",
      "commands": [
        "bash(cat .workflow/docs/architecture/*.md 2>/dev/null || echo 'architecture docs not found')",
        "bash(cat .workflow/docs/api/*.md 2>/dev/null || echo 'api docs not found')"
      ],
      "output_to": "task_docs"
    },
    {
      "step": "analyze_task_patterns",
      "action": "Analyze existing code patterns for task context",
      "commands": [
        "bash(cd \"[task_focus_paths]\")",
        "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze task patterns TASK: Review '[task_title]' patterns CONTEXT: Task [task_id] in [task_focus_paths] EXPECTED: Pattern analysis RULES: Focus on existing patterns\")"
      ],
      "output_to": "task_context",
      "on_error": "fail"
    }
  ]
}
```

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md

### Execution Integration
Documents created for `/workflow:execute`:
- **IMPL_PLAN.md**: Context loading and requirements
- **.task/*.json**: Agent implementation context
- **TODO_LIST.md**: Status tracking (container tasks with ▸, leaf tasks with checkboxes)