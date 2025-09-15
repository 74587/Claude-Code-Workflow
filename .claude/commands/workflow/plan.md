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
/workflow:plan [--AM gemini|codex] [--analyze|--deep] <input>
```

## Input Detection
- **Files**: `.md/.txt/.json/.yaml/.yml` → Reads content and extracts requirements
- **Issues**: `ISS-*`, `ISSUE-*`, `*-request-*` → Loads issue data and acceptance criteria
- **Text**: Everything else → Parses natural language requirements

## Analysis Levels
- **Quick** (default): Structure only (5s)
- **--analyze**: Structure + context analysis (30s)
- **--deep**: Structure + comprehensive parallel analysis (1-2m)

## Core Rules

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md

### Task Limits & Decomposition
- **Maximum 10 tasks**: Hard enforced limit - projects exceeding must be re-scoped
- **Function-based decomposition**: By complete functional units, not files/steps
- **File cohesion**: Group related files (UI + logic + tests + config) in same task
- **Task saturation**: Merge "analyze + implement" by default (0.5 count for complex prep tasks)

### Pre-Planning Analysis (CRITICAL)
⚠️ **Must complete BEFORE generating any plan documents**
1. **Complexity assessment**: Count total saturated tasks
2. **Decomposition strategy**: Flat (≤5) | Hierarchical (6-10) | Re-scope (>10)
3. **File grouping**: Identify cohesive file sets
4. **Quantity prediction**: Estimate main tasks, subtasks, container vs leaf ratio

### Session Management
- **Active session check**: Check for `.workflow/.active-*` marker first
- Auto-creates new session: `WFS-[topic-slug]`
- Uses existing active session if available
- **Dependency context**: MUST read previous task summary documents before planning

### Project Structure Analysis
**Always First**: Run project hierarchy analysis before planning
```bash
# Get project structure with depth analysis
~/.claude/scripts/get_modules_by_depth.sh

# Results populate task paths automatically
# Used for focus_paths and target_files generation
```

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

### Always Created
- **IMPL_PLAN.md**: Requirements, task breakdown, success criteria
- **Session state**: Task references and paths

### Auto-Created (complexity > simple)
- **TODO_LIST.md**: Hierarchical progress tracking
- **.task/*.json**: Individual task definitions with flow_control

### Document Structure
```
.workflow/WFS-[topic]/
├── IMPL_PLAN.md          # Main planning document
├── TODO_LIST.md          # Progress tracking (if complex)
└── .task/
    ├── IMPL-001.json     # Task definitions
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

## Context Acquisition Strategy

### Analysis Method Selection (--AM)
- **gemini** (default): Pattern analysis, architectural understanding
- **codex**: Autonomous development, intelligent file discovery

### Detailed Context Gathering Commands

#### Gemini Analysis Templates
```bash
# Module-specific pattern analysis
cd [module] && ~/.claude/scripts/gemini-wrapper -p "analyze patterns"

# Full architectural analysis
cd [module] && ~/.claude/scripts/gemini-wrapper -p "analyze [scope] architecture"

# Cross-module relationship analysis
~/.claude/scripts/gemini-wrapper -p "@{src/**/*} @{CLAUDE.md} analyze module relationships and dependencies"
```

#### Codex Analysis Templates
```bash
# Autonomous architectural analysis
codex --full-auto exec "analyze [scope] architecture"

# Pattern-based development context
codex --full-auto exec "analyze existing patterns for [feature] implementation"

# Comprehensive project understanding
codex --full-auto exec "@{**/*} @{CLAUDE.md} analyze project structure and conventions"
```

### Context Accumulation & Inheritance
**Context Flow Process**:
1. **Structure Analysis**: `get_modules_by_depth.sh` → project hierarchy
2. **Pattern Analysis**: Tool-specific commands → existing patterns
3. **Dependency Mapping**: Previous task summaries → inheritance context
4. **Task Context Generation**: Combined analysis → task.context fields

**Context Inheritance Rules**:
- **Parent → Child**: Container tasks pass context to subtasks via `context.inherited`
- **Dependency → Dependent**: Previous task summaries loaded via `context.depends_on`
- **Session → Task**: Global session context included in all tasks
- **Module → Feature**: Module patterns inform feature implementation context

### Variable System & Path Rules
**Flow Control Variables**: Use `[variable_name]` format (see workflow-architecture.md)
- **Step outputs**: `[dependency_context]`, `[pattern_analysis]`
- **Task properties**: `[depends_on]`, `[focus_paths]`, `[parent]`
- **Commands**: Wrapped in `bash()` with error handling strategies

**Focus Paths**: Concrete paths only (no wildcards)
- Use `get_modules_by_depth.sh` results for actual directory names
- Include both directories and specific files from requirements
- Format: `["src/auth", "tests/auth", "config/auth.json"]`