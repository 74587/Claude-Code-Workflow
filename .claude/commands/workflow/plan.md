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
5. **Artifacts-Integrated**: Automatically detect and reference brainstorming artifacts
6. **Design-Context-Aware**: Ensure design documents are loaded in pre_analysis steps

**Automatic Task Generation Workflow**:
1. **Parse Analysis Results**: Extract task recommendations from ANALYSIS_RESULTS.md
2. **Extract Task Details**: Parse task ID, title, scope, complexity from structured analysis
3. **Detect Brainstorming Artifacts**: Scan for ui-designer, system-architect, and other role outputs
4. **Generate Context**: Create requirements, focus_paths, acceptance criteria, and artifacts references
5. **Build Enhanced Flow Control**: Define pre_analysis steps with artifact loading and implementation approach
6. **Create Artifact-Aware JSON Files**: Generate individual .task/IMPL-*.json files with enhanced schema

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

### Brainstorming Artifacts Integration ⚠️ NEW FEATURE
- **Artifact Detection**: Automatically scan .brainstorming/ directory for role outputs
- **Role-Task Mapping**: Map brainstorming roles to task types (ui-designer → UI tasks)
- **Artifact References**: Create structured references to design documents and specifications
- **Context Enhancement**: Load artifacts in pre_analysis steps to provide complete design context


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
1. **Artifact Detection**: Scan session for brainstorming outputs (.brainstorming/ directory)
2. **Plan Generation**: Create IMPL_PLAN.md from analysis results and artifacts
3. **Enhanced Task JSON Creation**: Generate task JSON files with artifacts integration
4. **TODO List Creation**: Generate TODO_LIST.md with artifact references
5. **Session Update**: Mark session as ready for execution with artifact context

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
    {"content": "Detect and analyze brainstorming artifacts", "status": "pending", "activeForm": "Detecting and analyzing brainstorming artifacts"},
    {"content": "Gather intelligent context", "status": "pending", "activeForm": "Gathering intelligent context"},
    {"content": "Execute intelligent analysis", "status": "pending", "activeForm": "Executing intelligent analysis"},
    {"content": "Generate artifact-enhanced implementation plan and tasks", "status": "pending", "activeForm": "Generating artifact-enhanced implementation plan and tasks"}
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

### Enhanced Task JSON Schema (5-Field + Artifacts)
Each task.json uses the workflow-architecture.md 5-field schema enhanced with artifacts:
- **id**: IMPL-N[.M] format (max 2 levels)
- **title**: Descriptive task name
- **status**: pending|active|completed|blocked|container
- **meta**: { type, agent }
- **context**: { requirements, focus_paths, acceptance, parent, depends_on, inherited, shared_context, **artifacts** }
- **flow_control**: { pre_analysis[] (with artifact loading), implementation_approach, target_files[] }

**Streamlined Artifacts Field with Single Synthesis Document**:
```json
"artifacts": [
  {
    "type": "synthesis_specification",
    "source": "brainstorm_synthesis",
    "path": ".workflow/WFS-[session]/.brainstorming/synthesis-specification.md",
    "priority": "highest",
    "contains": "complete_integrated_specification"
  },
  {
    "type": "topic_framework",
    "source": "brainstorm_framework",
    "path": ".workflow/WFS-[session]/.brainstorming/topic-framework.md",
    "priority": "medium",
    "contains": "discussion_framework_structure"
  },
  {
    "type": "individual_role_analysis",
    "source": "brainstorm_roles",
    "path": ".workflow/WFS-[session]/.brainstorming/[role]/analysis.md",
    "priority": "low",
    "contains": "role_specific_analysis_fallback"
  }
]
```

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
      "step": "load_synthesis_specification",
      "action": "Load consolidated synthesis specification from brainstorming",
      "commands": [
        "bash(ls .workflow/WFS-[session]/.brainstorming/synthesis-specification.md 2>/dev/null || echo 'synthesis specification not found')",
        "Read(.workflow/WFS-[session]/.brainstorming/synthesis-specification.md)"
      ],
      "output_to": "synthesis_specification",
      "on_error": "skip_optional"
    },
    {
      "step": "load_individual_role_artifacts",
      "action": "Load individual role analyses as fallback",
      "commands": [
        "bash(find .workflow/WFS-[session]/.brainstorming/ -name 'analysis.md' 2>/dev/null | head -8)",
        "Read(.workflow/WFS-[session]/.brainstorming/ui-designer/analysis.md)",
        "Read(.workflow/WFS-[session]/.brainstorming/system-architect/analysis.md)",
        "Read(.workflow/WFS-[session]/.brainstorming/topic-framework.md)"
      ],
      "output_to": "individual_artifacts",
      "on_error": "skip_optional"
    },
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
        "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze task patterns TASK: Review '[task_title]' patterns CONTEXT: Task [task_id] in [task_focus_paths], synthesis spec: [synthesis_specification], fallback artifacts: [individual_artifacts] EXPECTED: Pattern analysis integrating consolidated design specification RULES: Prioritize synthesis-specification.md over individual artifacts, align with consolidated requirements and design\")"
      ],
      "output_to": "task_context",
      "on_error": "fail"
    }
  ],
  "implementation_approach": {
    "task_description": "Implement '[task_title]' following consolidated synthesis specification from [synthesis_specification] with fallback to [individual_artifacts]",
    "modification_points": [
      "Apply consolidated requirements and design patterns from synthesis-specification.md",
      "Follow technical guidelines and implementation roadmap from synthesis specification",
      "Integrate with existing patterns while maintaining design integrity from consolidated specification"
    ],
    "logic_flow": [
      "Load consolidated synthesis specification as primary context",
      "Extract specific requirements, design patterns, and technical guidelines",
      "Analyze existing code patterns for integration with synthesized design",
      "Implement feature following consolidated specification",
      "Validate implementation against synthesized acceptance criteria"
    ]
  }
}
```

## Artifact Detection & Integration ⚠️ ENHANCED FEATURE

### Artifact Detection Logic
**Automatic Brainstorming Artifact Scanning**:
1. **Session Scan**: Check `.workflow/WFS-[session]/.brainstorming/` directory
2. **Role Detection**: Identify completed role analyses (ui-designer, system-architect, etc.)
3. **Artifact Mapping**: Map artifacts to relevant task types
4. **Relevance Scoring**: Assign relevance scores based on task-artifact alignment

### Role-Task Mapping Rules
**Artifact-Task Relevance Matrix**:
- **ui-designer** → UI/Frontend/Component tasks (high relevance)
- **system-architect** → Architecture/Backend/Database tasks (high relevance)
- **security-expert** → Authentication/Security/Validation tasks (high relevance)
- **data-architect** → Data/API/Analytics tasks (high relevance)
- **product-manager** → Feature/Business Logic tasks (medium relevance)
- **topic-framework.md** → All tasks (low-medium relevance for context)

### Enhanced Task Generation
**Artifact-Enhanced Task Creation Process**:
1. **Standard Task Generation**: Create base task from analysis results
2. **Artifact Detection**: Scan for relevant brainstorming outputs
3. **Context Enrichment**: Add artifacts array to task.context
4. **Pre-Analysis Enhancement**: Insert artifact loading steps
5. **Implementation Update**: Reference artifacts in task description and approach

### Artifact Loading in Pre-Analysis
**Automatic Artifact Integration**:
```json
{
  "step": "load_brainstorming_artifacts",
  "action": "Load brainstorming artifacts and design documents",
  "commands": [
    "bash(find .workflow/WFS-[session]/.brainstorming/ -name 'analysis.md' 2>/dev/null | while read file; do echo \"=== $(dirname \"$file\" | xargs basename) ===\"; cat \"$file\"; echo; done)",
    "Read(.workflow/WFS-[session]/.brainstorming/topic-framework.md)"
  ],
  "output_to": "brainstorming_artifacts",
  "on_error": "skip_optional"
}
```

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md

### Execution Integration
Documents created for `/workflow:execute`:
- **IMPL_PLAN.md**: Context loading and requirements with artifact references
- **.task/*.json**: Agent implementation context with enhanced artifact loading
- **TODO_LIST.md**: Status tracking (container tasks with ▸, leaf tasks with checkboxes)