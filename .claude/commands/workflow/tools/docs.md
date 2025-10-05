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

## Planning Process

### Phase 1: Session Initialization
```bash
# 1. Parse user input
doc_type="all"  # architecture|api|all
tool="gemini"   # gemini|qwen|codex (default: gemini)
scope=""        # optional path filter

# Extract from command arguments
[[ "$*" == *"architecture"* ]] && doc_type="architecture"
[[ "$*" == *"api"* ]] && doc_type="api"
[[ "$*" == *"--tool qwen"* ]] && tool="qwen"
[[ "$*" == *"--tool codex"* ]] && tool="codex"
[[ "$*" =~ --scope[[:space:]]+([^[:space:]]+) ]] && scope="${BASH_REMATCH[1]}"

# 2. Create session structure
timestamp=$(date +%Y%m%d-%H%M%S)
session_dir=".workflow/WFS-docs-${timestamp}"
mkdir -p "${session_dir}"/{.task,.process,.summaries}

# 3. Create active marker
touch ".workflow/.active-WFS-docs-${timestamp}"
```

### Phase 2: Project Structure Analysis (MANDATORY)
```bash
# Run get_modules_by_depth.sh for module hierarchy
module_data=$(~/.claude/scripts/get_modules_by_depth.sh)

# Parse module information
# Format: depth:N|path:<PATH>|files:N|size:N|has_claude:yes/no
```

### Phase 3: Pre-Planning Analysis (Optional)
Uses selected tool to analyze existing documentation and suggest improvements:

```bash
if [[ "$tool" == "codex" ]]; then
    # Codex: Direct exec
    codex -C . --full-auto exec "
    PURPOSE: Analyze documentation strategy
    TASK: Review existing docs and suggest improvements for ${doc_type}
    MODE: analysis
    CONTEXT: @{CLAUDE.md,**/*CLAUDE.md,docs/**/*}
    EXPECTED: Gap analysis and recommendations
    RULES: Focus on clarity, completeness, architectural alignment
    " --skip-git-repo-check > "${session_dir}/.process/pre-analysis.md"
else
    # Gemini/Qwen: Wrapper
    cd .workflow && ~/.claude/scripts/${tool}-wrapper -p "
    PURPOSE: Analyze documentation strategy
    TASK: Review existing docs and suggest improvements for ${doc_type}
    MODE: analysis
    CONTEXT: @{../CLAUDE.md,../**/*CLAUDE.md,../docs/**/*}
    EXPECTED: Gap analysis and recommendations
    RULES: Focus on clarity, completeness, architectural alignment
    " > "${session_dir}/.process/pre-analysis.md"
fi
```

### Phase 4: Task Decomposition

**Decomposition Strategy**:
1. **Always create**: System Overview task (IMPL-001)
2. **If architecture/all**: Architecture Documentation task
3. **If api/all**: Unified API Documentation task
4. **For each module**: Module Documentation task (grouped for efficiency)

**Grouping Rules**:
- Max 3 modules per task
- Max 30 files per task
- Group by dependency depth and functional similarity

**Task Count Formula**:
```
base_tasks = 1 (system overview)
+ (doc_type includes "architecture" ? 1 : 0)
+ (doc_type includes "api" ? 1 : 0)
+ ceil(module_count / 3)
```

### Phase 5: Task JSON Generation

Each task follows the 5-field schema with detailed flow_control.

#### Command Generation Logic

At planning time, commands are built based on the `$tool` variable:

```bash
# Build tool-specific command for pre_analysis step
build_analysis_command() {
    local step_name="$1"
    local context_path="$2"
    local template_path="$3"
    local output_var="$4"

    if [[ "$tool" == "codex" ]]; then
        # Codex: direct exec with -C directory
        echo "codex -C ${context_path} --full-auto exec \"PURPOSE: ...\\nTASK: ...\\nMODE: analysis\\nCONTEXT: @{**/*}\\nEXPECTED: ...\\nRULES: \$(cat ${template_path})\" --skip-git-repo-check"
    else
        # Gemini/Qwen: wrapper with -p
        echo "bash(cd ${context_path} && ~/.claude/scripts/${tool}-wrapper -p \"PURPOSE: ...\\nTASK: ...\\nMODE: analysis\\nCONTEXT: @{**/*}\\nEXPECTED: ...\\nRULES: \$(cat ${template_path})\")"
    fi
}

# Usage in task JSON generation
analyze_cmd=$(build_analysis_command "analyze_module" "src/auth" \
    "~/.claude/workflows/cli-templates/prompts/documentation/module-documentation.txt" \
    "module_analysis")
```

**Key Points**:
- **Default tool**: `gemini`
- **Template reference**: Use `$(cat template_path.txt)` to embed template content
- **One command per step**: No conditional blocks, command is concrete
- **Tool selection happens at planning time**, not execution time

#### IMPL-001: System Overview Task
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

#### IMPL-002+: Module Documentation Tasks
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

#### Architecture Documentation Task (if requested)
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

#### API Documentation Task (if requested)
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

### Phase 6: Generate Planning Documents

#### IMPL_PLAN.md
```markdown
# Documentation Implementation Plan

**Session**: WFS-docs-[timestamp]
**Type**: [architecture|api|all]
**Tool**: [gemini|qwen|codex]
**Scope**: [scope or "Full project"]

## Documentation Strategy

### Pre-Analysis Findings
[Summary from .process/pre-analysis.md]

### Documentation Scope
- System Overview: Yes
- Module Documentation: [N] modules
- Architecture Documentation: [Yes/No]
- API Documentation: [Yes/No]

## Task Breakdown

### IMPL-001: System Overview
- **Purpose**: Project-level documentation
- **Template**: project-overview.txt
- **Output**: .workflow/docs/README.md

### IMPL-002 to IMPL-[M]: Module Documentation
[For each module or module group]
- **Module(s)**: [module-name(s)]
- **Template**: module-documentation.txt
- **Output**: .workflow/docs/modules/[module]/README.md

### IMPL-[M+1]: Architecture Documentation (if requested)
- **Purpose**: System design and patterns
- **Output**: .workflow/docs/architecture/

### IMPL-[N]: API Documentation (if requested)
- **Purpose**: API reference and specifications
- **Template**: api-reference.txt
- **Output**: .workflow/docs/api/README.md

## Execution Order
1. IMPL-001 (Foundation - provides system context)
2. IMPL-002 to IMPL-[M] (Modules - can be parallelized)
3. IMPL-[M+1] (Architecture - requires module docs)
4. IMPL-[N] (API - can run after IMPL-001)

## Success Criteria
- [ ] All template sections populated
- [ ] Code examples tested and working
- [ ] Navigation links functional
- [ ] Documentation follows project standards
- [ ] No broken references
```

#### TODO_LIST.md
```markdown
# Documentation Progress Tracker

**Session**: WFS-docs-[timestamp]
**Created**: [timestamp]

## Tasks

- [ ] **IMPL-001**: Generate Project Overview Documentation
- [ ] **IMPL-002**: Document Module: 'auth'
- [ ] **IMPL-003**: Document Module: 'api'
- [ ] **IMPL-004**: Generate Architecture Documentation
- [ ] **IMPL-005**: Generate Unified API Documentation

## Execution Instructions

```bash
# Execute tasks in order (or parallelize modules)
/workflow:execute IMPL-001  # System overview (run first)
/workflow:execute IMPL-002  # Module: auth
/workflow:execute IMPL-003  # Module: api
/workflow:execute IMPL-004  # Architecture (after modules)
/workflow:execute IMPL-005  # API docs
```

## Completion Checklist

After all tasks complete:
- [ ] Review all generated documentation
- [ ] Test all code examples
- [ ] Verify navigation links
- [ ] Check for consistency
- [ ] Update main project README.md with docs link
```

## Output Structure

After planning, the session structure is:

```
.workflow/
├── .active-WFS-docs-20240120-143022  # Active session marker
└── WFS-docs-20240120-143022/         # Documentation session
    ├── IMPL_PLAN.md                  # Implementation plan
    ├── TODO_LIST.md                  # Progress tracker
    ├── .process/
    │   └── pre-analysis.md           # Pre-planning analysis
    └── .task/
        ├── IMPL-001.json             # System overview task
        ├── IMPL-002.json             # Module: auth task
        ├── IMPL-003.json             # Module: api task
        ├── IMPL-004.json             # Architecture task
        └── IMPL-005.json             # API docs task
```

Documentation output structure:
```
.workflow/docs/
├── README.md                         # From IMPL-001
├── modules/
│   ├── auth/
│   │   └── README.md                 # From IMPL-002
│   └── api/
│       └── README.md                 # From IMPL-003
├── architecture/
│   ├── system-design.md             # From IMPL-004
│   ├── module-map.md
│   └── data-flow.md
└── api/
    ├── README.md                     # From IMPL-005
    └── openapi.yaml
```

## Error Handling

- **No modules found**: Create only IMPL-001 (system overview)
- **Scope path invalid**: Show error and exit
- **Active session exists**: Prompt user to complete or pause current session
- **Tool unavailable**: Fall back to gemini

## Next Steps

After running `/workflow:docs`:
1. Review generated `IMPL_PLAN.md` and `TODO_LIST.md`
2. Execute tasks using `/workflow:execute IMPL-NNN`
3. Tasks can be parallelized (modules) or run sequentially
4. Review completed documentation in `.workflow/docs/`

## Key Benefits

### Clear Separation of Concerns
- **Planning** (docs.md): Session creation, task decomposition, no content generation
- **Execution** (doc-generator.md): Content generation, template application, quality assurance

### Scalable Task Management
- Each documentation task is independent and self-contained
- Tasks can be parallelized for faster completion
- Clear dependencies (e.g., architecture requires module docs)

### Template-Driven Consistency
- All documentation follows standard templates
- Templates are reusable and maintainable
- Easy to update documentation standards

### Full Context for Execution
- Each task JSON contains complete instructions
- flow_control defines exact analysis steps
- Conditional tool selection for flexibility
