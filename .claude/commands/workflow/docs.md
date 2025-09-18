---
name: docs
description: Generate hierarchical architecture and API documentation using doc-generator agent with flow_control
usage: /workflow:docs <type> [scope]
argument-hint: "architecture"|"api"|"all"
examples:
  - /workflow:docs all
  - /workflow:docs architecture src/modules
  - /workflow:docs api --scope api/
---

# Workflow Documentation Command

## Usage
```bash
/workflow:docs <type> [scope]
```

## Input Detection
- **Document Types**: `architecture`, `api`, `all` → Creates appropriate documentation tasks
- **Scope**: Optional module/directory filtering → Focuses documentation generation
- **Default**: `all` → Complete documentation suite

## Core Workflow

### Planning & Task Creation Process
The command performs structured planning and task creation:

**0. Pre-Planning Architecture Analysis** ⚠️ FIRST STEP
- **System Structure Analysis**: Run `bash(~/.claude/scripts/get_modules_by_depth.sh)` to discover project hierarchy
- **Module Boundary Identification**: Understand module organization and dependencies
- **Architecture Pattern Recognition**: Identify architectural styles and design patterns
- **Foundation for documentation**: Use structure analysis to guide task decomposition

**1. Documentation Planning**
- **Type Analysis**: Determine documentation scope (architecture/api/all)
- **Module Discovery**: Use architecture analysis results to identify components
- **Dynamic Task Decomposition**: Analyze project structure to determine optimal task count and module grouping
- **Session Management**: Create or use existing documentation session

**2. Task Generation**
- **Create session**: `.workflow/WFS-docs-[timestamp]/`
- **Create active marker**: `.workflow/.active-WFS-docs-[timestamp]` (must match session folder name)
- **Generate IMPL_PLAN.md**: Documentation requirements and task breakdown
- **Create task.json files**: Individual documentation tasks with flow_control
- **Setup TODO_LIST.md**: Progress tracking for documentation generation

### Session Management ⚠️ CRITICAL
- **Check for active sessions**: Look for `.workflow/.active-WFS-docs-*` markers
- **Marker naming**: Active marker must exactly match session folder name
- **Session creation**: `WFS-docs-[timestamp]` folder with matching `.active-WFS-docs-[timestamp]` marker
- **Task execution**: Use `/workflow:execute` to run individual documentation tasks within active session
- **Session isolation**: Each documentation session maintains independent context and state

## Output Structure
```
.workflow/docs/
├── README.md              # System navigation
├── modules/               # Level 1: Module documentation
│   ├── [module-1]/
│   │   ├── overview.md
│   │   ├── api.md
│   │   ├── dependencies.md
│   │   └── examples.md
│   └── [module-n]/...
├── architecture/          # Level 2: System architecture
│   ├── system-design.md
│   ├── module-map.md
│   ├── data-flow.md
│   └── tech-stack.md
└── api/                   # Level 2: Unified API docs
    ├── unified-api.md
    └── openapi.yaml
```

## Task Decomposition Standards

### Dynamic Task Planning Rules
**Module Grouping**: Max 3 modules per task, max 30 files per task
**Task Count**: Calculate based on `total_modules ÷ 3 (rounded up) + base_tasks`
**File Limits**: Split tasks when file count exceeds 30 in any module group
**Base Tasks**: System overview (1) + Architecture (1) + API consolidation (1)
**Module Tasks**: Group related modules by dependency depth and functional similarity

### Documentation Task Types
**IMPL-001**: System Overview Documentation
- Project structure analysis
- Technology stack documentation
- Main navigation creation

**IMPL-002**: Module Documentation (per module)
- Individual module analysis
- API surface documentation
- Dependencies and relationships
- Usage examples

**IMPL-003**: Architecture Documentation
- System design patterns
- Module interaction mapping
- Data flow documentation
- Design principles

**IMPL-004**: API Documentation
- Endpoint discovery and analysis
- OpenAPI specification generation
- Authentication documentation
- Integration examples

### Task JSON Schema (5-Field Architecture)
Each documentation task uses the workflow-architecture.md 5-field schema:
- **id**: IMPL-N format
- **title**: Documentation task name
- **status**: pending|active|completed|blocked
- **meta**: { type: "documentation", agent: "doc-generator" }
- **context**: { requirements, focus_paths, acceptance, scope }
- **flow_control**: { pre_analysis[], implementation_approach, target_files[] }

## Document Generation

### Workflow Process
**Input Analysis** → **Session Creation** → **IMPL_PLAN.md** → **.task/IMPL-NNN.json** → **TODO_LIST.md** → **Execute Tasks**

**Always Created**:
- **IMPL_PLAN.md**: Documentation requirements and task breakdown
- **Session state**: Task references and documentation paths

**Auto-Created (based on scope)**:
- **TODO_LIST.md**: Progress tracking for documentation tasks
- **.task/IMPL-*.json**: Individual documentation tasks with flow_control
- **.process/ANALYSIS_RESULTS.md**: Documentation analysis artifacts

**Document Structure**:
```
.workflow/
├── .active-WFS-docs-20231201-143022  # Active session marker (matches folder name)
└── WFS-docs-20231201-143022/         # Documentation session folder
    ├── IMPL_PLAN.md                  # Main documentation plan
    ├── TODO_LIST.md                  # Progress tracking
    ├── .process/
    │   └── ANALYSIS_RESULTS.md       # Documentation analysis
    └── .task/
        ├── IMPL-001.json             # System overview task
        ├── IMPL-002.json             # Module documentation task
        ├── IMPL-003.json             # Architecture documentation task
        └── IMPL-004.json             # API documentation task
```

### Task Flow Control Templates

**System Overview Task (IMPL-001)**:
```json
"flow_control": {
  "pre_analysis": [
    {
      "step": "system_architecture_analysis",
      "action": "Discover system architecture and module hierarchy",
      "command": "bash(~/.claude/scripts/get_modules_by_depth.sh)",
      "output_to": "system_structure"
    },
    {
      "step": "project_discovery",
      "action": "Discover project structure and entry points",
      "command": "bash(find . -type f -name '*.json' -o -name '*.md' -o -name 'package.json' | head -20)",
      "output_to": "project_structure"
    },
    {
      "step": "analyze_tech_stack",
      "action": "Analyze technology stack and dependencies using structure analysis",
      "command": "~/.claude/scripts/gemini-wrapper -p \"Analyze project technology stack and dependencies based on: [system_structure]\"",
      "output_to": "tech_analysis"
    }
  ],
  "target_files": [".workflow/docs/README.md"]
}
```

**Module Documentation Task (IMPL-002)**:
```json
"flow_control": {
  "pre_analysis": [
    {
      "step": "load_system_structure",
      "action": "Load system architecture analysis from previous task",
      "command": "bash(cat .workflow/WFS-docs-*/IMPL-001-system_structure.output 2>/dev/null || ~/.claude/scripts/get_modules_by_depth.sh)",
      "output_to": "system_context"
    },
    {
      "step": "module_analysis",
      "action": "Analyze specific module structure and API within system context",
      "command": "~/.claude/scripts/gemini-wrapper -p \"Analyze module [MODULE_NAME] structure and exported API within system: [system_context]\"",
      "output_to": "module_context"
    }
  ],
  "target_files": [".workflow/docs/modules/[MODULE_NAME]/overview.md"]
}
```

## Analysis Templates

### Project Structure Analysis Rules
- Identify main modules and purposes
- Map directory organization patterns
- Extract entry points and configuration files
- Recognize architectural styles and design patterns
- Analyze module relationships and dependencies
- Document technology stack and requirements

### Module Analysis Rules
- Identify module boundaries and entry points
- Extract exported functions, classes, interfaces
- Document internal organization and structure
- Analyze API surfaces with types and parameters
- Map dependencies within and between modules
- Extract usage patterns and examples

### API Analysis Rules
- Classify endpoint types (REST, GraphQL, WebSocket, RPC)
- Extract request/response parameters and schemas
- Document authentication and authorization requirements
- Generate OpenAPI 3.0 specification structure
- Create comprehensive endpoint documentation
- Provide usage examples and integration guides

## Error Handling
- **Invalid document type**: Clear error message with valid options
- **Module not found**: Skip missing modules with warning
- **Analysis failures**: Fall back to file-based analysis
- **Permission issues**: Clear guidance on directory access

## Key Benefits

### Structured Documentation Process
- **Task-based approach**: Documentation broken into manageable, trackable tasks
- **Flow control integration**: Systematic analysis ensures completeness
- **Progress visibility**: TODO_LIST.md provides clear completion status
- **Quality assurance**: Each task has defined acceptance criteria

### Workflow Integration
- **Planning foundation**: Documentation provides context for implementation planning
- **Execution consistency**: Same task execution model as implementation
- **Context accumulation**: Documentation builds comprehensive project understanding

## Usage Examples

### Complete Documentation Workflow
```bash
# Step 1: Create documentation plan and tasks
/workflow:docs all

# Step 2: Execute documentation tasks (after planning)
/workflow:execute IMPL-001  # System overview
/workflow:execute IMPL-002  # Module documentation
/workflow:execute IMPL-003  # Architecture documentation
/workflow:execute IMPL-004  # API documentation
```
The system creates structured documentation tasks with proper session management, task.json files, and integration with the broader workflow system for systematic and trackable documentation generation.