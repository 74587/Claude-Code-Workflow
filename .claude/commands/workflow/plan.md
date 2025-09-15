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

## Flow Control Schema
Each task.json includes required fields:
- **meta**: type, agent assignment
- **context**: requirements, focus_paths, acceptance, depends_on
- **flow_control**:
  - `pre_analysis`: Steps with commands and context variables (${var})
  - `implementation_approach`: One-line strategy
  - `target_files`: "file:function:lines" format

## Execution Integration
Documents created for `/workflow:execute`:
- **IMPL_PLAN.md**: Context loading and requirements
- **.task/*.json**: Agent implementation context
- **TODO_LIST.md**: Status tracking (container tasks with ▸, leaf tasks with checkboxes)

## Error Handling
- **Vague input**: Auto-reject ("fix it", "make better", etc.)
- **File not found**: Clear suggestions
- **>10 tasks**: Force re-scoping into iterations

## Analysis Method (--AM)
- **gemini** (default): Pattern analysis, architectural understanding
- **codex**: Autonomous development, intelligent file discovery