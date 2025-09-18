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

## Core Workflow

### Analysis & Planning Process
The command performs comprehensive analysis through:

**0. Pre-Analysis Documentation Check** ⚠️ FIRST STEP
- **Selective documentation loading based on task requirements**:
  - **Always check**: `.workflow/docs/README.md` - System navigation and module index
  - **For architecture tasks**: `.workflow/docs/architecture/system-design.md`, `module-map.md`
  - **For specific modules**: `.workflow/docs/modules/[relevant-module]/overview.md`
  - **For API tasks**: `.workflow/docs/api/unified-api.md`
- **Context-driven selection**: Only load documentation relevant to the specific task scope
- **Foundation for analysis**: Use relevant docs to understand affected components and dependencies

**1. Context Gathering & Intelligence Selection**
- Reading relevant CLAUDE.md documentation based on task requirements
- Automatic tool assignment based on complexity:
  - **Simple tasks** (≤3 modules): Direct CLI tools (`~/.claude/scripts/gemini-wrapper` or `codex --full-auto exec`)
  - **Complex tasks** (>3 modules): Task agents with integrated CLI tool access
- Flow control integration with automatic tool selection

**2. Project Structure Analysis** ⚠️ CRITICAL PRE-PLANNING STEP
- **Documentation Context First**: Reference `.workflow/docs/` content from `/workflow:docs` command if available
- **Complexity assessment**: Count total saturated tasks
- **Decomposition strategy**: Flat (≤5) | Hierarchical (6-10) | Re-scope (>10)
- **Module boundaries**: Identify relationships and dependencies using existing documentation
- **File grouping**: Cohesive file sets and target_files generation
- **Pattern recognition**: Existing implementations and conventions

**3. Analysis Artifacts Generated**
- **ANALYSIS_RESULTS.md**: Context analysis, codebase structure, pattern identification, task decomposition
- **Context mapping**: Project structure, dependencies, cohesion groups
- **Implementation strategy**: Tool selection and execution approach

## Implementation Standards

### Context Management & Agent Execution

**Agent Context Loading** ⚠️ CRITICAL
Agents automatically load context from plan-generated documents during execution:

```json
"flow_control": {
  "pre_analysis": [
    {
      "step": "load_planning_context",
      "action": "Load plan-generated analysis and context",
      "command": "bash(cat .workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md 2>/dev/null || echo 'planning analysis not found')",
      "output_to": "planning_context"
    },
    {
      "step": "load_dependencies",
      "action": "Retrieve dependency task summaries",
      "command": "bash(cat .workflow/WFS-[session]/.summaries/IMPL-[dependency_id]-summary.md 2>/dev/null || echo 'dependency summary not found')",
      "output_to": "dependency_context"
    },
    {
      "step": "load_documentation",
      "action": "Retrieve relevant documentation based on task scope and requirements",
      "command": "bash(cat .workflow/docs/README.md $(if [[ \"$TASK_TYPE\" == *\"architecture\"* ]]; then echo .workflow/docs/architecture/*.md; fi) $(if [[ \"$TASK_MODULES\" ]]; then for module in $TASK_MODULES; do echo .workflow/docs/modules/$module/*.md; done; fi) $(if [[ \"$TASK_TYPE\" == *\"api\"* ]]; then echo .workflow/docs/api/*.md; fi) CLAUDE.md README.md 2>/dev/null || echo 'documentation not found')",
      "output_to": "doc_context"
    }
  ]
}
```

**Context Accumulation & Inheritance**:
1. **Structure Analysis**: project hierarchy
2. **Pattern Analysis**: Tool-specific commands → existing patterns
3. **Dependency Mapping**: Previous task summaries → inheritance context
4. **Task Context Generation**: Combined analysis → task.context fields

**Content Sources**:
- Task summaries: `.workflow/WFS-[session]/.summaries/IMPL-[task-id]-summary.md`
- Generated documentation: `.workflow/docs/` (architecture, modules, APIs from `/workflow:docs`)
- Documentation: `CLAUDE.md`, `README.md`, config files
- Schema definitions: `.json`, `.yaml`, `.sql` files
- Dependency contexts: `.workflow/WFS-[session]/.task/IMPL-*.json`
- Analysis artifacts: `.workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md`

**Trigger Conditions**: Task has `context.depends_on` array, references external docs, builds on previous summaries, requires config/schema files

### Task Decomposition Standards

**Core Principles**:
1. **Functional Completeness** - Each task delivers complete, independently runnable functional unit including all related files (logic, UI, tests, config)
2. **Minimum Size Threshold** - Single task must contain ≥3 related files or 200 lines of code; smaller content merged with adjacent features
3. **Dependency Cohesion** - Tightly coupled components completed in same task (shared models, API endpoints, user flows)
4. **Hierarchy Control** - Flat structure (≤5 tasks) | Two-level (6-10 tasks) | Re-scope (>10 tasks)

**Implementation Rules**:
- **Maximum 10 tasks**: Hard enforced limit - projects exceeding must be re-scoped
- **Function-based decomposition**: By complete functional units, not files/steps
- **File cohesion**: Group related files (UI + logic + tests + config) in same task
- **Task saturation**: Merge "analyze + implement" by default (0.5 count for complex prep tasks)

**Task Saturation Assessment**:
- **Default Merge** (cohesive files together): Functional modules with UI + logic + tests + config, features with tests/docs, files sharing interfaces/data structures
- **Only Separate When**: Independent functional modules, different tech stacks/deployment units, would exceed 10-task limit


### Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before any planning
- **Multiple sessions support**: Different Claude instances can have different active sessions
- **User selection**: If multiple active sessions found, prompt user to select which one to work with
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists
- **Session continuity**: MUST use selected active session to maintain context
- **⚠️ Dependency context**: MUST read ALL previous task summary documents from selected session before planning
- **Session isolation**: Each session maintains independent context and state


**Task Patterns**:
- ✅ **Correct (Function-based)**: `IMPL-001: User authentication system` (models + routes + components + middleware + tests)
- ❌ **Wrong (File/step-based)**: `IMPL-001: Create database model`, `IMPL-002: Create API endpoint`

## Document Generation

**Workflow**: Identifier Creation → Folder Structure → IMPL_PLAN.md → .task/IMPL-NNN.json → TODO_LIST.md

**Always Created**:
- **IMPL_PLAN.md**: Requirements, task breakdown, success criteria
- **Session state**: Task references and paths

**Auto-Created (complexity > simple)**:
- **TODO_LIST.md**: Hierarchical progress tracking
- **.task/*.json**: Individual task definitions with flow_control
- **.process/ANALYSIS_RESULTS.md**: Analysis results and planning artifacts

**Document Structure**:
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


## Reference Information

### Task JSON Schema (5-Field Architecture)
Each task.json uses the workflow-architecture.md 5-field schema:
- **id**: IMPL-N[.M] format (max 2 levels)
- **title**: Descriptive task name
- **status**: pending|active|completed|blocked|container
- **meta**: { type, agent }
- **context**: { requirements, focus_paths, acceptance, parent, depends_on, inherited, shared_context }
- **flow_control**: { pre_analysis[], implementation_approach, target_files[] }

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md

### Execution Integration
Documents created for `/workflow:execute`:
- **IMPL_PLAN.md**: Context loading and requirements
- **.task/*.json**: Agent implementation context
- **TODO_LIST.md**: Status tracking (container tasks with ▸, leaf tasks with checkboxes)

## Error Handling
- **Vague input**: Auto-reject ("fix it", "make better", etc.)
- **File not found**: Clear suggestions
- **>10 tasks**: Force re-scoping into iterations


