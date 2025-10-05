---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
usage: /workflow:docs <type> [options]
argument-hint: "architecture"|"api"|"all" [--tool <gemini|qwen|codex>] [--scope <path>]
examples:
  - /workflow:docs all                          # Complete documentation (gemini default)
  - /workflow:docs all --tool qwen              # Use Qwen for architecture focus
  - /workflow:docs architecture --scope src/modules
  - /workflow:docs api --tool gemini --scope api/
---

# Workflow Documentation Command

## Purpose

**`/workflow:docs` is a pure planner/orchestrator** - it analyzes project structure, decomposes documentation work into tasks, and generates execution plans. It does **NOT** generate any documentation content itself.

**Key Principle**: Separation of Concerns
- **docs.md** → Planning, session creation, task generation
- **doc-generator.md** → Execution, content generation, quality assurance

## Usage

```bash
/workflow:docs <type> [--tool <gemini|qwen|codex>] [--scope <path>]
```

### Parameters

- **type**: `architecture` | `api` | `all` (required)
  - `architecture`: System design, module interactions, patterns
  - `api`: Endpoint documentation, API specifications
  - `all`: Complete documentation suite

- **--tool**: `gemini` | `qwen` | `codex` (optional, default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition
  - `qwen`: Architecture analysis, system design focus
  - `codex`: Implementation validation, code quality

- **--scope**: Directory path filter (optional)

## Planning Workflow

### Complete Execution Flow

```
/workflow:docs [type] [--tool] [--scope]
    ↓
Phase 1: Init Session → Create session dir & active marker
    ↓
Phase 2: Module Analysis → Run get_modules_by_depth.sh
    ↓
Phase 3: Quick Assess → Check existing docs
    ↓
Phase 4: Decompose → Create task list & TodoWrite
    ↓
Phase 5: Generate Tasks → Build IMPL-*.json & plans
    ↓
✅ Planning Complete → Show TodoWrite status
```

### Phase Details

#### Phase 1: Session Initialization
```bash
# Parse arguments and create session structure
doc_type="all"  # architecture|api|all
tool="gemini"   # gemini|qwen|codex (default: gemini)
scope=""        # optional path filter

timestamp=$(date +%Y%m%d-%H%M%S)
session_dir=".workflow/WFS-docs-${timestamp}"
mkdir -p "${session_dir}"/{.task,.process,.summaries}
touch ".workflow/.active-WFS-docs-${timestamp}"
```

#### Phase 2: Project Structure Analysis (MANDATORY)
```bash
# Run get_modules_by_depth.sh for module hierarchy
module_data=$(~/.claude/scripts/get_modules_by_depth.sh)
# Format: depth:N|path:<PATH>|files:N|size:N|has_claude:yes/no
```

#### Phase 3: Quick Documentation Assessment
```bash
# Lightweight check - no heavy analysis
existing_docs=$(find . -maxdepth 2 -name "*.md" -not -path "./.workflow/*" | wc -l)

if [[ $existing_docs -gt 5 ]]; then
    find . -maxdepth 3 -name "*.md" > "${session_dir}/.process/existing-docs.txt"
fi

# Record strategy
cat > "${session_dir}/.process/strategy.md" <<EOF
**Type**: ${doc_type}
**Tool**: ${tool}
**Scope**: ${scope:-"Full project"}
EOF
```

#### Phase 4: Task Decomposition & TodoWrite Setup

**Decomposition Strategy**:
1. **Always create**: System Overview task (IMPL-001)
2. **If architecture/all**: Architecture Documentation task
3. **If api/all**: Unified API Documentation task
4. **For each module**: Module Documentation task (grouped)

**Grouping Rules**:
- Max 3 modules per task
- Max 30 files per task
- Group by dependency depth and functional similarity

**TodoWrite Setup**:
```
✅ Session initialization (completed)
⏳ IMPL-001: Project Overview (pending)
⏳ IMPL-002: Module 'auth' (pending)
⏳ IMPL-003: Module 'api' (pending)
⏳ IMPL-004: Architecture Documentation (pending)
⏳ IMPL-005: API Documentation (pending)
```

#### Phase 5: Task JSON Generation

Each task follows the 5-field schema with detailed flow_control.

**Command Generation Logic**:
```bash
# Build tool-specific command at planning time
if [[ "$tool" == "codex" ]]; then
    cmd="codex -C ${dir} --full-auto exec \"...\""
else
    cmd="bash(cd ${dir} && ~/.claude/scripts/${tool}-wrapper -p \"...\")"
fi
```

## Task Templates

### 1. System Overview (IMPL-001)
**Purpose**: Project-level documentation
**Output**: `.workflow/docs/README.md`

**Complete JSON Structure**:
```json
{
  "id": "IMPL-001",
  "title": "Generate Project Overview Documentation",
  "status": "pending",
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "project-overview"
  },
  "context": {
    "requirements": [
      "Document project purpose, architecture, and getting started guide",
      "Create navigation structure for all documentation",
      "Use Project-Level Documentation Template"
    ],
    "focus_paths": ["."],
    "acceptance": [
      "Complete .workflow/docs/README.md following template",
      "All template sections populated with accurate information",
      "Navigation links to module and API documentation"
    ],
    "scope": "Project root and overall structure"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "discover_project_structure",
        "action": "Analyze project structure and modules",
        "command": "bash(~/.claude/scripts/get_modules_by_depth.sh)",
        "output_to": "system_structure"
      },
      {
        "step": "discover_project_files",
        "action": "Identify key project files",
        "command": "bash(find . -maxdepth 2 -type f \\( -name '*.json' -o -name '*.md' -o -name '*.yml' -o -name '*.yaml' \\) | head -30)",
        "output_to": "project_files"
      },
      {
        "step": "analyze_tech_stack",
        "action": "Analyze technology stack and dependencies",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze project technology stack\\nTASK: Extract tech stack, architecture patterns, design principles\\nMODE: analysis\\nCONTEXT: System structure: [system_structure]\\n         Project files: [project_files]\\nEXPECTED: Technology analysis with architecture style\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-overview.txt)\")",
        "output_to": "tech_analysis",
        "on_error": "fail",
        "note": "Command is built at planning time based on $tool variable (gemini/qwen/codex)"
      }
    ],
    "implementation_approach": {
      "task_description": "Use tech_analysis to populate Project-Level Documentation Template",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/project-overview.txt",
        "Parse tech_analysis for: purpose, architecture, tech stack, design principles",
        "Fill template sections with extracted information",
        "Generate navigation links to module/API docs",
        "Format output as Markdown"
      ]
    },
    "target_files": [".workflow/docs/README.md"]
  }
}
```

### 2. Module Documentation (IMPL-002+)
**Purpose**: Module-level documentation
**Output**: `.workflow/docs/modules/[name]/README.md`

**Complete JSON Structure**:
```json
{
  "id": "IMPL-002",
  "title": "Document Module: 'auth'",
  "status": "pending",
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "module-documentation"
  },
  "context": {
    "requirements": [
      "Document module purpose, internal architecture, public API",
      "Include dependencies and usage examples",
      "Use Module-Level Documentation Template"
    ],
    "focus_paths": ["src/auth"],
    "acceptance": [
      "Complete .workflow/docs/modules/auth/README.md",
      "All exported functions/classes documented",
      "Working code examples included"
    ],
    "scope": "auth module only"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_system_context",
        "action": "Load system architecture from IMPL-001",
        "command": "bash(cat .workflow/WFS-docs-*/IMPL-001-system_structure.output 2>/dev/null || ~/.claude/scripts/get_modules_by_depth.sh)",
        "output_to": "system_context",
        "on_error": "skip_optional"
      },
      {
        "step": "analyze_module_structure",
        "action": "Deep analysis of module structure and API",
        "command": "bash(cd src/auth && ~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document module comprehensively\\nTASK: Extract module purpose, architecture, public API, dependencies\\nMODE: analysis\\nCONTEXT: @{**/*}\\n         System: [system_context]\\nEXPECTED: Complete module analysis for documentation\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/module-documentation.txt)\")",
        "output_to": "module_analysis",
        "on_error": "fail",
        "note": "For qwen: qwen-wrapper | For codex: codex -C src/auth --full-auto exec \"...\" --skip-git-repo-check"
      }
    ],
    "implementation_approach": {
      "task_description": "Use module_analysis to populate Module-Level Documentation Template",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/module-documentation.txt",
        "Parse module_analysis for: purpose, components, API, dependencies",
        "Fill template sections with extracted information",
        "Generate code examples from actual usage",
        "Format output as Markdown"
      ]
    },
    "target_files": [".workflow/docs/modules/auth/README.md"]
  }
}
```

### 3. Architecture Documentation (if requested)
**Purpose**: System design and patterns
**Output**: `.workflow/docs/architecture/`

**Complete JSON Structure**:
```json
{
  "id": "IMPL-N-1",
  "title": "Generate Architecture Documentation",
  "status": "pending",
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "qwen",
    "template": "architecture"
  },
  "context": {
    "requirements": [
      "Document system design patterns and architectural decisions",
      "Create module interaction diagrams",
      "Explain data flow and component relationships"
    ],
    "focus_paths": ["."],
    "acceptance": [
      "Complete architecture documentation in .workflow/docs/architecture/",
      "Diagrams explaining system design",
      "Clear explanation of architectural patterns"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_all_module_docs",
        "action": "Aggregate all module documentation",
        "command": "bash(find .workflow/docs/modules -name 'README.md' -exec cat {} \\;)",
        "output_to": "module_docs",
        "on_error": "fail"
      },
      {
        "step": "analyze_architecture",
        "action": "Synthesize system architecture from modules",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Synthesize system architecture\\nTASK: Create architecture documentation from module docs\\nMODE: analysis\\nCONTEXT: [module_docs]\\nEXPECTED: Architecture documentation with patterns\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-overview.txt) | Focus on design patterns, data flow, component interactions\")",
        "output_to": "architecture_analysis",
        "on_error": "fail",
        "note": "Command varies: gemini-wrapper (default) | qwen-wrapper | codex exec"
      }
    ],
    "implementation_approach": {
      "task_description": "Create architecture documentation from synthesis",
      "logic_flow": [
        "Parse architecture_analysis for patterns and design decisions",
        "Create text-based diagrams (mermaid/ASCII) for module interactions",
        "Document data flow between components",
        "Explain architectural decisions and trade-offs",
        "Format as structured documentation"
      ]
    },
    "target_files": [
      ".workflow/docs/architecture/system-design.md",
      ".workflow/docs/architecture/module-map.md",
      ".workflow/docs/architecture/data-flow.md"
    ]
  }
}
```

### 4. API Documentation (if requested)
**Purpose**: API reference and specifications
**Output**: `.workflow/docs/api/README.md`

**Complete JSON Structure**:
```json
{
  "id": "IMPL-N",
  "title": "Generate Unified API Documentation",
  "status": "pending",
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "api-reference"
  },
  "context": {
    "requirements": [
      "Document all API endpoints with request/response formats",
      "Include authentication and error handling",
      "Generate OpenAPI specification if applicable",
      "Use API-Level Documentation Template"
    ],
    "focus_paths": ["src/api", "src/routes", "src/controllers"],
    "acceptance": [
      "Complete .workflow/docs/api/README.md following template",
      "All endpoints documented with examples",
      "OpenAPI spec generated if REST API detected"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "discover_api_endpoints",
        "action": "Find all API routes and endpoints",
        "command": "bash(rg -t ts -t js '(router\\.|app\\.|@(Get|Post|Put|Delete|Patch))' src/ --no-heading | head -100)",
        "output_to": "endpoint_discovery",
        "on_error": "skip_optional"
      },
      {
        "step": "analyze_api_structure",
        "action": "Analyze API structure and patterns",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document API comprehensively\\nTASK: Extract endpoints, auth, request/response formats\\nMODE: analysis\\nCONTEXT: @{src/api/**/*,src/routes/**/*,src/controllers/**/*}\\n         Endpoints: [endpoint_discovery]\\nEXPECTED: Complete API documentation\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api-reference.txt)\")",
        "output_to": "api_analysis",
        "on_error": "fail",
        "note": "Tool-specific: gemini-wrapper | qwen-wrapper | codex -C src/api exec"
      }
    ],
    "implementation_approach": {
      "task_description": "Use api_analysis to populate API-Level Documentation Template",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/api-reference.txt",
        "Parse api_analysis for: endpoints, auth, request/response",
        "Fill template sections with extracted information",
        "Generate OpenAPI spec if REST API detected",
        "Format output as Markdown"
      ]
    },
    "target_files": [
      ".workflow/docs/api/README.md",
      ".workflow/docs/api/openapi.yaml"
    ]
  }
}
```

## Planning Outputs

### File Structure
```
.workflow/
├── .active-WFS-docs-20240120-143022
└── WFS-docs-20240120-143022/
    ├── IMPL_PLAN.md              # Implementation plan
    ├── TODO_LIST.md              # Progress tracker
    ├── .process/
    │   ├── strategy.md           # Doc strategy
    │   └── existing-docs.txt     # Existing docs list
    └── .task/
        ├── IMPL-001.json         # System overview
        ├── IMPL-002.json         # Module: auth
        ├── IMPL-003.json         # Module: api
        ├── IMPL-004.json         # Architecture
        └── IMPL-005.json         # API docs
```

### IMPL_PLAN.md
```markdown
# Documentation Implementation Plan

**Session**: WFS-docs-[timestamp]
**Type**: [architecture|api|all]
**Tool**: [gemini|qwen|codex]

## Task Breakdown

### IMPL-001: System Overview
- **Output**: .workflow/docs/README.md
- **Template**: project-overview.txt

### IMPL-002+: Module Documentation
- **Modules**: [list]
- **Template**: module-documentation.txt

### IMPL-N: Architecture/API (if requested)
- **Template**: architecture.txt / api-reference.txt

## Execution Order
1. IMPL-001 (Foundation)
2. IMPL-002 to IMPL-[M] (Modules - can parallelize)
3. IMPL-[M+1] (Architecture - needs modules)
4. IMPL-[N] (API - can run after IMPL-001)
```

### TODO_LIST.md
```markdown
# Documentation Progress Tracker

- [ ] **IMPL-001**: Generate Project Overview
- [ ] **IMPL-002**: Document Module: 'auth'
- [ ] **IMPL-003**: Document Module: 'api'
- [ ] **IMPL-004**: Generate Architecture Documentation
- [ ] **IMPL-005**: Generate Unified API Documentation

## Execution
```bash
/workflow:execute IMPL-001
/workflow:execute IMPL-002
# ...
```
```

## Execution Phase

### Via /workflow:execute

```
For Each Task (IMPL-001, IMPL-002, ...):

/workflow:execute IMPL-NNN
    ↓
TodoWrite: pending → in_progress
    ↓
Execute flow_control (pre_analysis steps)
    ↓
Generate Documentation (apply template)
    ↓
TodoWrite: in_progress → completed
    ↓
✅ Task Complete
```

### TodoWrite Status Tracking

**Planning Phase**:
```
✅ Session initialization (completed)
⏳ IMPL-001: Project Overview (pending)
⏳ IMPL-002: Module 'auth' (pending)
```

**Execution Phase**:
```
Executing IMPL-001:
✅ Session initialization
🔄 IMPL-001: Project Overview (in_progress)
⏳ IMPL-002: Module 'auth'

After IMPL-001:
✅ Session initialization
✅ IMPL-001: Project Overview (completed)
🔄 IMPL-002: Module 'auth' (in_progress)
```

## Documentation Output

### Final Structure
```
.workflow/docs/
├── README.md                     # IMPL-001: Project overview
├── modules/
│   ├── auth/README.md           # IMPL-002: Auth module
│   └── api/README.md            # IMPL-003: API module
├── architecture/                # IMPL-004: Architecture
│   ├── system-design.md
│   ├── module-map.md
│   └── data-flow.md
└── api/                         # IMPL-005: API docs
    ├── README.md
    └── openapi.yaml
```

## Next Steps

### 1. Review Planning Output
```bash
cat .workflow/WFS-docs-*/IMPL_PLAN.md
cat .workflow/WFS-docs-*/TODO_LIST.md
```

### 2. Execute Documentation Tasks
```bash
# Sequential (recommended)
/workflow:execute IMPL-001  # System overview first
/workflow:execute IMPL-002  # Module docs
/workflow:execute IMPL-003
/workflow:execute IMPL-004  # Architecture
/workflow:execute IMPL-005  # API docs

# Parallel (module docs only)
/workflow:execute IMPL-002 &
/workflow:execute IMPL-003 &
wait
```

### 3. Review Generated Documentation
```bash
ls -lah .workflow/docs/
cat .workflow/docs/README.md
```

### 4. TodoWrite Progress
- Planning: All tasks `pending`
- Execution: `pending` → `in_progress` → `completed`
- Real-time status updates via TodoWrite

## Error Handling

- **No modules found**: Create only IMPL-001 (system overview)
- **Scope path invalid**: Show error and exit
- **Active session exists**: Prompt to complete or pause
- **Tool unavailable**: Fall back to gemini

## Key Benefits

### Clear Separation of Concerns
- **Planning**: Session creation, task decomposition (this command)
- **Execution**: Content generation, quality assurance (doc-generator agent)

### Scalable Task Management
- Independent, self-contained tasks
- Parallelizable module documentation
- Clear dependencies (architecture needs modules)

### Template-Driven Consistency
- All documentation follows standard templates
- Reusable and maintainable
- Easy to update standards

### Full Context for Execution
- Each task JSON contains complete instructions
- flow_control defines exact analysis steps
- Tool selection for flexibility
