---
name: plan
description: Create implementation plans with intelligent input detection
usage: /workflow:plan <input>
argument-hint: "text description"|file.md|ISS-001
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
---

# Workflow Plan Command

## Usage
```bash
/workflow:plan <input>
```

## Input Detection
- **Files**: `.md/.txt/.json/.yaml/.yml` → Reads content and extracts requirements
- **Issues**: `ISS-*`, `ISSUE-*`, `*-request-*` → Loads issue data and acceptance criteria
- **Text**: Everything else → Parses natural language requirements

## Default Analysis Workflow

### Automatic Intelligence Selection
The command automatically performs comprehensive analysis by:
1. **Context Gathering**: Reading relevant CLAUDE.md documentation based on task requirements
2. **Task Assignment**: Automatically assigning Task agents based on complexity:
   - **Simple tasks** (≤3 modules): Direct CLI tools (`~/.claude/scripts/gemini-wrapper` or `codex --full-auto exec`)
   - **Complex tasks** (>3 modules): Task agents with integrated CLI tool access
3. **Process Documentation**: Generates analysis artifacts in `.workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md`
4. **Flow Control Integration**: Automatic tool selection managed by flow_control system

### Analysis Artifacts Generated
- **ANALYSIS_RESULTS.md**: Documents context analysis, codebase structure, pattern identification, and task decomposition results
- **Context mapping**: Project structure, dependencies, and cohesion groups
- **Implementation strategy**: Tool selection and execution approach

## Core Rules

### Agent Execution Context (CRITICAL)
⚠️ **For agent execution phase**: Agents will automatically load context from plan-generated documents

**Agent Context Loading Pattern**:
```json
"flow_control": {
  "pre_analysis": [
    {
      "step": "load_planning_context",
      "action": "Load plan-generated analysis and context",
      "command": "bash(cat .workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md 2>/dev/null || echo 'planning analysis not found')",
      "output_to": "planning_context"
    }, // 可选：Task任务较为复杂时
    {
      "step": "load_dependencies",
      "action": "Retrieve dependency task summaries",
      "command": "bash(cat .workflow/WFS-[session]/.summaries/IMPL-[dependency_id]-summary.md 2>/dev/null || echo 'dependency summary not found')",
      "output_to": "dependency_context"
    },
    {
      "step": "load_documentation",
      "action": "Retrieve project documentation based on task requirements",
      "command": "bash(cat CLAUDE.md README.md 2>/dev/null || echo 'documentation not found')",
      "output_to": "doc_context"
    }
  ]
}
```

**Trigger Conditions**:
- Task has `context.depends_on` array with task IDs
- Task references external documentation files
- Task builds upon previous implementation summaries
- Task requires configuration or schema files

**Content Sources**:
- Task summaries: `.workflow/WFS-[session]/.summaries/IMPL-[task-id]-summary.md` (主任务) / `IMPL-[task-id].[subtask-id]-summary.md` (子任务)
- Documentation: `CLAUDE.md`, `README.md`, config files (loaded based on task context requirements)
- Schema definitions: `.json`, `.yaml`, `.sql` files
- Dependency contexts: `.workflow/WFS-[session]/.task/IMPL-*.json`
- Analysis artifacts: `.workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md`

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md


### Task Limits & Decomposition
- **Maximum 10 tasks**: Hard enforced limit - projects exceeding must be re-scoped
- **Function-based decomposition**: By complete functional units, not files/steps
- **File cohesion**: Group related files (UI + logic + tests + config) in same task
- **Task saturation**: Merge "analyze + implement" by default (0.5 count for complex prep tasks)

### Core Task Decomposition Standards
1. **Functional Completeness Principle** - Each task must deliver a complete, independently runnable functional unit including all related files (logic, UI, tests, config)

2. **Minimum Size Threshold** - A single task must contain at least 3 related files or 200 lines of code; content below this threshold must be merged with adjacent features

3. **Dependency Cohesion Principle** - Tightly coupled components must be completed in the same task, including shared data models, same API endpoints, and all parts of a single user flow

4. **Hierarchy Control Rule** - Use flat structure for ≤5 tasks, two-level structure for 6-10 tasks, and mandatory re-scoping into multiple iterations for >10 tasks

### Pre-Planning Analysis (CRITICAL)
⚠️ **Must complete BEFORE generating any plan documents**
1. **Complexity assessment**: Count total saturated tasks
2. **Decomposition strategy**: Flat (≤5) | Hierarchical (6-10) | Re-scope (>10)
3. **File grouping**: Identify cohesive file sets
4. **Quantity prediction**: Estimate main tasks, subtasks, container vs leaf ratio

### Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before any planning
- **Multiple sessions support**: Different Claude instances can have different active sessions
- **User selection**: If multiple active sessions found, prompt user to select which one to work with
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists
- **Session continuity**: MUST use selected active session to maintain context
- **⚠️ Dependency context**: MUST read ALL previous task summary documents from selected session before planning
- **Session isolation**: Each session maintains independent context and state

### Project Structure Analysis & Engineering Enhancement
**⚠️ CRITICAL PRE-PLANNING STEP**: Must complete comprehensive project analysis before any task planning begins
**Analysis Process**: Context Gathering → Codebase Exploration → Pattern Recognition → Implementation Strategy
**Tool Selection Protocol** (Managed by flow_control):
- **Simple patterns** (≤3 modules): Direct CLI tools (`~/.claude/scripts/gemini-wrapper` or `codex --full-auto exec`)
- **Complex analysis** (>3 modules): Task agents with integrated CLI tool access and built-in tool capabilities
**Tool Priority**: Task(complex) > Direct CLI(simple) > Hybrid(mixed complexity)
**Automatic Selection**: flow_control system determines optimal tool based on task complexity and context requirements

**Core Principles**:
- **Complexity-Driven Selection**: Simple patterns use direct CLI, complex analysis uses Task agents with CLI integration
- **Context-First Approach**: Always gather project understanding before tool selection
- **Intelligent Escalation**: Start CLI, escalate to Task agents when encountering complexity
- **Hybrid Flexibility**: Task agents can freely use CLI commands and built-in tools for comprehensive analysis

**Structure Integration**:
- Identifies module boundaries and relationships
- Maps file dependencies and cohesion groups
- Populates task.context.focus_paths automatically
- Enables precise target_files generation

## Task Patterns

### ✅ Correct (Function-based)
- `IMPL-001: User authentication system` (models + routes + components + middleware + tests)
- `IMPL-002: Data export functionality` (service + routes + UI + utils + tests)

### ❌ Wrong (File/step-based)
- `IMPL-001: Create database model`
- `IMPL-002: Create API endpoint`
- `IMPL-003: Create frontend component`

## Output Documents

### Document Workflow
**Identifier Creation** → **Folder Structure Creation** → **IMPL_PLAN.md** → **.task/IMPL-NNN.json** → **TODO_LIST.md**

### Always Created
- **IMPL_PLAN.md**: Requirements, task breakdown, success criteria
- **Session state**: Task references and paths

### Auto-Created (complexity > simple)
- **TODO_LIST.md**: Hierarchical progress tracking
- **.task/*.json**: Individual task definitions with flow_control
- **.process/ANALYSIS_RESULTS.md**: Analysis results and planning artifacts.Template:@~/.claude/workflows/ANALYSIS_RESULTS.md

### Document Structure
```
.workflow/WFS-[topic]/
├── IMPL_PLAN.md          # Main planning document
├── TODO_LIST.md          # Progress tracking (if complex)
├── .process/
│   └── ANALYSIS_RESULTS.md  # Analysis results and planning artifacts
└── .task/
    ├── IMPL-001.json     # Task definitions with flow_control
    └── IMPL-002.json
```

## Task Saturation Assessment
**Default Merge** (cohesive files together):
- Functional modules with UI + logic + tests + config
- Features with their tests and documentation
- Files sharing common interfaces/data structures

**Only Separate When**:
- Completely independent functional modules
- Different tech stacks or deployment units
- Would exceed 10-task limit otherwise

## Task JSON Schema (5-Field Architecture)
Each task.json uses the workflow-architecture.md 5-field schema:
- **id**: IMPL-N[.M] format (max 2 levels)
- **title**: Descriptive task name
- **status**: pending|active|completed|blocked|container
- **meta**: { type, agent }
- **context**: { requirements, focus_paths, acceptance, parent, depends_on, inherited, shared_context }
- **flow_control**: { pre_analysis[], implementation_approach, target_files[] }

## Execution Integration
Documents created for `/workflow:execute`:
- **IMPL_PLAN.md**: Context loading and requirements
- **.task/*.json**: Agent implementation context
- **TODO_LIST.md**: Status tracking (container tasks with ▸, leaf tasks with checkboxes)

## Error Handling
- **Vague input**: Auto-reject ("fix it", "make better", etc.)
- **File not found**: Clear suggestions
- **>10 tasks**: Force re-scoping into iterations

### Context Accumulation & Inheritance
**Context Flow Process**:
1. **Structure Analysis**: project hierarchy
2. **Pattern Analysis**: Tool-specific commands → existing patterns
3. **Dependency Mapping**: Previous task summaries → inheritance context
4. **Task Context Generation**: Combined analysis → task.context fields

