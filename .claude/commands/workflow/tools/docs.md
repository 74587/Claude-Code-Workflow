---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
argument-hint: "architecture"|"api"|"all" [--tool <gemini|qwen|codex>] [--scope <path>]
examples:
  - /workflow:docs all                          # Complete documentation (gemini default)
  - /workflow:docs all --tool qwen              # Use Qwen for architecture focus
  - /workflow:docs architecture --scope src/modules
  - /workflow:docs api --tool gemini --scope api/
---

# Workflow Documentation Command

## Purpose

**`/workflow:docs` is a lightweight planner/orchestrator** - it analyzes project structure using metadata tools, decomposes documentation work into tasks, and generates execution plans. It does **NOT** generate any documentation content itself.

**Key Principle**: Lightweight Planning + Targeted Execution
- **docs.md** → Collect metadata (paths, structure), generate task JSONs with path references
- **doc-generator.md** → Execute targeted analysis on focus_paths, generate content

**Optimization Philosophy**:
- **Planning phase**: Minimal context - only metadata (module paths, file lists via `get_modules_by_depth.sh` and Code Index MCP)
- **Task JSON**: Store path references, not content
- **Execution phase**: Targeted deep analysis within focus_paths scope

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

#### Phase 2: Lightweight Metadata Collection with Folder Type Analysis (MANDATORY)
```bash
# Step 1: Run get_modules_by_depth.sh for module hierarchy (metadata only)
module_data=$(~/.claude/scripts/get_modules_by_depth.sh)
# Format: depth:N|path:<PATH>|files:N|size:N|has_claude:yes/no

# Step 2: Analyze each folder to determine its type
# Create folder analysis file
mkdir -p "${session_dir}/.process"
> "${session_dir}/.process/folder-analysis.txt"

# For each folder discovered by get_modules_by_depth.sh:
while IFS='|' read -r depth_info path_info files_info size_info claude_info; do
  folder_path=$(echo "$path_info" | cut -d':' -f2-)
  depth=$(echo "$depth_info" | cut -d':' -f2)

  # Count code files in this folder (not recursive, maxdepth 1)
  code_files=$(find "$folder_path" -maxdepth 1 -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.rs" \) 2>/dev/null | wc -l)

  # Count immediate subfolders
  subfolders=$(find "$folder_path" -maxdepth 1 -type d -not -path "$folder_path" 2>/dev/null | wc -l)

  # Determine folder type
  if [[ $code_files -gt 0 ]]; then
    folder_type="code"  # Has code files → needs API.md + README.md
  elif [[ $subfolders -gt 0 ]]; then
    folder_type="navigation"  # Only subfolders → needs README.md (navigation)
  else
    folder_type="skip"  # Empty folder → skip
  fi

  # Record the analysis
  echo "${folder_path}|${folder_type}|depth:${depth}|code_files:${code_files}|subfolders:${subfolders}" >> "${session_dir}/.process/folder-analysis.txt"
done <<< "$module_data"

# Step 3: Group folders by top-level directories for task assignment
# Example: src/modules/auth, src/modules/api → group under "src/modules"
# This reduces task count while maintaining logical organization
awk -F'|' '{
  split($1, parts, "/");
  if (length(parts) >= 2) {
    top_dir = parts[1] "/" parts[2];
    print top_dir;
  }
}' "${session_dir}/.process/folder-analysis.txt" | sort -u > "${session_dir}/.process/top-level-dirs.txt"

# IMPORTANT: Do NOT read file contents in planning phase
# Only collect: paths, file counts, module structure, folder types
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

#### Phase 4: Task Decomposition & TodoWrite Setup (Revised Dependency Order)

**New Decomposition Strategy (Bottom-Up)**:

**Level 1: Module Tree Tasks** (Execute in parallel)
- For each top-level directory in `top-level-dirs.txt`, create one "tree" task
- Each tree task recursively handles all subfolders within that directory
- Task generates both API.md and README.md based on folder type analysis

**Level 2: Project README Task** (Depends on all Level 1 tasks)
- MUST wait for all module trees to complete
- Aggregates information from all module documents
- Creates navigation structure

**Level 3: Architecture & Examples** (Depends on Level 2)
- Architecture document synthesizes from all module docs + project README
- Examples document uses project README as foundation

**Task ID Assignment**:
```
IMPL-001 to IMPL-00N: Module tree tasks (Level 1)
IMPL-[N+1]: Project README.md (Level 2, depends_on: IMPL-001 to IMPL-00N)
IMPL-[N+2]: ARCHITECTURE.md (Level 3, depends_on: IMPL-[N+1])
IMPL-[N+3]: EXAMPLES.md (Level 3, depends_on: IMPL-[N+1])
IMPL-[N+4]: API docs (Optional, Level 3, depends_on: IMPL-[N+1])
```

**Example with 3 top-level dirs**:
```
IMPL-001: Document tree 'src/modules/' (Level 1)
IMPL-002: Document tree 'src/utils/' (Level 1)
IMPL-003: Document tree 'lib/' (Level 1)
IMPL-004: Project README.md (Level 2, depends_on: [001,002,003])
IMPL-005: ARCHITECTURE.md (Level 3, depends_on: [004])
IMPL-006: EXAMPLES.md (Level 3, depends_on: [004])
```

**TodoWrite Setup (Correct Dependency Order)**:
```
✅ Session initialization (completed)
⏳ IMPL-001: Document tree 'src/modules/' (pending)
⏳ IMPL-002: Document tree 'src/utils/' (pending)
⏳ IMPL-003: Document tree 'lib/' (pending)
⏳ IMPL-004: Project README (pending, depends on IMPL-001~003)
⏳ IMPL-005: Architecture Documentation (pending, depends on IMPL-004)
⏳ IMPL-006: Examples Documentation (pending, depends on IMPL-004)
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

### Task Execution Order

**Level 1** (Parallel): Module tree tasks (IMPL-001 to IMPL-00N)
**Level 2** (Sequential): Project README (IMPL-[N+1], depends on Level 1)
**Level 3** (Parallel): Architecture, Examples, API docs (depends on Level 2)

### 1. Module Tree Task (IMPL-001 to IMPL-00N) - Level 1
**Purpose**: Recursively document entire directory tree
**Output**: Multiple files: `modules/*/API.md`, `modules/*/README.md`
**Dependencies**: None (can run in parallel with other tree tasks)

**Complete JSON Structure**:
```json
{
  "id": "IMPL-001",
  "title": "Document Module Tree: 'src/modules/'",
  "status": "pending",
  "meta": {
    "type": "docs-tree",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "api + module-readme + folder-navigation"
  },
  "context": {
    "requirements": [
      "Recursively process all folders in src/modules/",
      "For folders with code files: generate API.md + README.md",
      "For folders with only subfolders: generate README.md (navigation)",
      "Use folder-analysis.txt to determine folder types"
    ],
    "focus_paths": ["src/modules"],
    "folder_analysis_file": "${session_dir}/.process/folder-analysis.txt",
    "acceptance": [
      "All code-containing folders have both API.md and README.md",
      "All navigation folders have README.md",
      "Documents follow their respective templates",
      "File hierarchy matches source structure"
    ],
    "scope": "src/modules/ tree only"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_folder_analysis",
        "action": "Load folder type analysis for this tree",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders",
        "on_error": "fail",
        "note": "Filter analysis to only this tree's folders"
      },
      {
        "step": "analyze_module_tree_content",
        "action": "Deep analysis of module tree content",
        "command": "bash(cd src/modules && ~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document module tree comprehensively\\nTASK: For each folder, generate appropriate documentation (API.md for code folders, README.md for all)\\nMODE: analysis\\nCONTEXT: @{**/*} [target_folders]\\nEXPECTED: Structured documentation content for entire tree\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api.txt) for API docs, $(cat ~/.claude/workflows/cli-templates/prompts/documentation/module-readme.txt) for module README, $(cat ~/.claude/workflows/cli-templates/prompts/documentation/folder-navigation.txt) for navigation README\")",
        "output_to": "tree_documentation",
        "on_error": "fail",
        "note": "Analysis scoped to focus_paths only - controlled context"
      }
    ],
    "implementation_approach": {
      "task_description": "Generate all documentation files for the module tree based on folder types",
      "logic_flow": [
        "Parse [target_folders] to get list of folders and their types",
        "For each folder in tree:",
        "  if type == 'code':",
        "    - Generate API.md using api.txt template (Part A: Code API)",
        "    - Generate README.md using module-readme.txt template",
        "  elif type == 'navigation':",
        "    - Generate README.md using folder-navigation.txt template",
        "Maintain directory structure in output"
      ]
    },
    "target_files": [
      ".workflow/docs/modules/README.md",
      ".workflow/docs/modules/*/API.md",
      ".workflow/docs/modules/*/README.md",
      ".workflow/docs/modules/*/*/API.md",
      ".workflow/docs/modules/*/*/README.md"
    ]
  }
}
```

### 2. Project README Task (IMPL-[N+1]) - Level 2
**Purpose**: Project-level overview and navigation
**Output**: `.workflow/docs/README.md`
**Dependencies**: All Level 1 module tree tasks (MUST complete first)

**Complete JSON Structure**:
```json
{
  "id": "IMPL-004",
  "title": "Generate Project README",
  "status": "pending",
  "depends_on": ["IMPL-001", "IMPL-002", "IMPL-003"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "project-readme"
  },
  "context": {
    "requirements": [
      "Aggregate information from all module documentation",
      "Generate navigation links to all modules",
      "Provide project overview and getting started guide",
      "Use Project README Template"
    ],
    "focus_paths": ["."],
    "acceptance": [
      "Complete .workflow/docs/README.md following template",
      "All modules linked in navigation",
      "Project structure clearly explained"
    ],
    "scope": "Project root - aggregates all module info"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_all_module_docs",
        "action": "Load all module documentation for aggregation",
        "command": "bash(find .workflow/docs/modules -name 'README.md' -o -name 'API.md' | xargs cat)",
        "output_to": "all_module_docs",
        "on_error": "fail",
        "note": "This step requires all module tree tasks to be completed"
      },
      {
        "step": "analyze_project_structure",
        "action": "Synthesize project overview from module docs",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Generate project overview\\nTASK: Extract project structure, navigation, and summary from all module docs\\nMODE: analysis\\nCONTEXT: [all_module_docs] @{package.json,CLAUDE.md}\\nEXPECTED: Project README content\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-readme.txt) | Focus on navigation and aggregation\")",
        "output_to": "project_overview",
        "on_error": "fail",
        "note": "Synthesizes information from completed module docs"
      }
    ],
    "implementation_approach": {
      "task_description": "Generate project README aggregating all module information",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/project-readme.txt",
        "Extract module list and purposes from [all_module_docs]",
        "Generate navigation structure with links to all modules",
        "Fill template sections with [project_overview]",
        "Format output as Markdown"
      ]
    },
    "target_files": [".workflow/docs/README.md"]
  }
}
```

### 3. Architecture Documentation Task (IMPL-[N+2]) - Level 3
**Purpose**: System design and patterns aggregation
**Output**: `.workflow/docs/ARCHITECTURE.md`
**Dependencies**: Project README (IMPL-[N+1]) - MUST complete first

**Complete JSON Structure**:
```json
{
  "id": "IMPL-005",
  "title": "Generate Architecture Documentation",
  "status": "pending",
  "depends_on": ["IMPL-004"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "project-architecture"
  },
  "context": {
    "requirements": [
      "Synthesize system architecture from all module docs",
      "Aggregate API overview from all module API.md files",
      "Document module interactions and design patterns",
      "Use Project Architecture Template"
    ],
    "focus_paths": ["."],
    "acceptance": [
      "Complete .workflow/docs/ARCHITECTURE.md following template",
      "All modules included in architecture overview",
      "Aggregated API section with links to detailed docs"
    ],
    "scope": "System-level architecture synthesis"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_all_docs",
        "action": "Load project README and all module documentation",
        "command": "bash(cat .workflow/docs/README.md && find .workflow/docs/modules -name 'README.md' -o -name 'API.md' | xargs cat)",
        "output_to": "all_docs",
        "on_error": "fail",
        "note": "Requires both project README and all module docs to be complete"
      },
      {
        "step": "synthesize_architecture",
        "action": "Create system architecture synthesis",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Synthesize system architecture\\nTASK: Create comprehensive architecture doc from all module information\\nMODE: analysis\\nCONTEXT: [all_docs]\\nEXPECTED: Architecture documentation with patterns, module map, aggregated APIs\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-architecture.txt) | Focus on system-level view, aggregate APIs, show relationships\")",
        "output_to": "architecture_content",
        "on_error": "fail",
        "note": "Synthesizes from completed documentation"
      }
    ],
    "implementation_approach": {
      "task_description": "Generate architecture documentation synthesizing all module information",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/project-architecture.txt",
        "Extract module purposes and responsibilities from [all_docs]",
        "Build module map showing relationships",
        "Aggregate public APIs from all API.md files",
        "Generate architecture diagrams (text-based)",
        "Fill template sections with [architecture_content]",
        "Format output as Markdown"
      ]
    },
    "target_files": [".workflow/docs/ARCHITECTURE.md"]
  }
}
```

### 4. Examples Documentation Task (IMPL-[N+3]) - Level 3
**Purpose**: Practical usage examples and best practices
**Output**: `.workflow/docs/EXAMPLES.md`
**Dependencies**: Project README (IMPL-[N+1]) - MUST complete first

**Complete JSON Structure**:
```json
{
  "id": "IMPL-006",
  "title": "Generate Examples Documentation",
  "status": "pending",
  "depends_on": ["IMPL-004"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "project-examples"
  },
  "context": {
    "requirements": [
      "Create end-to-end usage examples spanning multiple modules",
      "Demonstrate common scenarios with complete, runnable code",
      "Show best practices and integration patterns",
      "Use Project Examples Template"
    ],
    "focus_paths": ["."],
    "acceptance": [
      "Complete .workflow/docs/EXAMPLES.md following template",
      "All code examples are complete and runnable",
      "Core use cases covered with explanations"
    ],
    "scope": "Project-level examples"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_project_readme",
        "action": "Load project README for context",
        "command": "bash(cat .workflow/docs/README.md)",
        "output_to": "project_readme",
        "on_error": "fail",
        "note": "Requires project README to be complete"
      },
      {
        "step": "identify_example_scenarios",
        "action": "Identify key usage scenarios from module docs",
        "command": "bash(find .workflow/docs/modules -name 'README.md' | xargs grep -A 5 'Usage Scenarios\\|Common Use Cases' | head -100)",
        "output_to": "module_usage_patterns",
        "on_error": "skip_optional"
      },
      {
        "step": "generate_examples_content",
        "action": "Create comprehensive examples based on project structure",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Generate practical usage examples\\nTASK: Create end-to-end examples showing how modules work together\\nMODE: analysis\\nCONTEXT: [project_readme] [module_usage_patterns] @{src/**/*.ts}\\nEXPECTED: Complete, runnable code examples\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-examples.txt) | Focus on real-world scenarios\")",
        "output_to": "examples_content",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "task_description": "Generate comprehensive examples documentation",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/project-examples.txt",
        "Identify 3-5 core usage scenarios from [module_usage_patterns]",
        "Generate complete, runnable code for each scenario",
        "Add explanations and best practices",
        "Fill template sections with [examples_content]",
        "Format output as Markdown"
      ]
    },
    "target_files": [".workflow/docs/EXAMPLES.md"]
  }
}
```

### 5. HTTP API Documentation (IMPL-[N+4]) - Level 3 (Optional)
**Purpose**: REST/GraphQL API reference
**Output**: `.workflow/docs/api/README.md`
**Dependencies**: Project README (IMPL-[N+1])

**Complete JSON Structure**:
```json
{
  "id": "IMPL-007",
  "title": "Generate HTTP API Documentation",
  "status": "pending",
  "depends_on": ["IMPL-004"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "api"
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
        "action": "Find all API routes and endpoints using MCP",
        "command": "mcp__code-index__search_code_advanced(pattern='router\\.|app\\.|@(Get|Post|Put|Delete|Patch)', file_pattern='*.{ts,js}', output_mode='content', head_limit=100)",
        "output_to": "endpoint_discovery",
        "on_error": "skip_optional",
        "note": "Use MCP instead of rg for better structure"
      },
      {
        "step": "analyze_api_structure",
        "action": "Analyze API structure and patterns",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document HTTP API comprehensively\\nTASK: Extract endpoints, auth, request/response formats\\nMODE: analysis\\nCONTEXT: @{src/api/**/*,src/routes/**/*,src/controllers/**/*}\\nEXPECTED: Complete HTTP API documentation\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api.txt) | Use Part B: HTTP API only\")",
        "output_to": "api_analysis",
        "on_error": "fail",
        "note": "Analysis limited to API-related paths - controlled context"
      }
    ],
    "implementation_approach": {
      "task_description": "Use api_analysis to populate HTTP API Documentation Template",
      "logic_flow": [
        "Load template: ~/.claude/workflows/cli-templates/prompts/documentation/api.txt",
        "Use Part B: HTTP API section only",
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
**Strategy**: Bottom-up, layered approach

## Task Breakdown by Level

### Level 1: Module Tree Tasks (Parallel Execution)
- **IMPL-001**: Document tree 'src/modules/'
  - Output: modules/*/API.md, modules/*/README.md
  - Templates: api.txt (Part A), module-readme.txt, folder-navigation.txt
- **IMPL-002**: Document tree 'src/utils/'
- **IMPL-003**: Document tree 'lib/'

### Level 2: Project README (Sequential - Depends on Level 1)
- **IMPL-004**: Generate Project README
  - Output: .workflow/docs/README.md
  - Template: project-readme.txt
  - Dependencies: IMPL-001, IMPL-002, IMPL-003

### Level 3: Architecture & Examples (Parallel - Depends on Level 2)
- **IMPL-005**: Generate Architecture Documentation
  - Output: .workflow/docs/ARCHITECTURE.md
  - Template: project-architecture.txt
  - Dependencies: IMPL-004
- **IMPL-006**: Generate Examples Documentation
  - Output: .workflow/docs/EXAMPLES.md
  - Template: project-examples.txt
  - Dependencies: IMPL-004
- **IMPL-007**: Generate HTTP API Documentation (Optional)
  - Output: .workflow/docs/api/README.md
  - Template: api.txt (Part B)
  - Dependencies: IMPL-004

## Execution Order (Respects Dependencies)
1. **Level 1** (Parallel): IMPL-001, IMPL-002, IMPL-003
2. **Level 2** (After Level 1): IMPL-004
3. **Level 3** (After Level 2, can parallelize within level): IMPL-005, IMPL-006, IMPL-007
```

### TODO_LIST.md
```markdown
# Documentation Progress Tracker

## Level 1: Module Tree Tasks (Can execute in parallel)
- [ ] **IMPL-001**: Document tree 'src/modules/'
- [ ] **IMPL-002**: Document tree 'src/utils/'
- [ ] **IMPL-003**: Document tree 'lib/'

## Level 2: Project README (Execute after Level 1)
- [ ] **IMPL-004**: Generate Project README (depends on IMPL-001~003)

## Level 3: Architecture & Examples (Execute after Level 2, can parallelize)
- [ ] **IMPL-005**: Generate Architecture Documentation (depends on IMPL-004)
- [ ] **IMPL-006**: Generate Examples Documentation (depends on IMPL-004)
- [ ] **IMPL-007**: Generate HTTP API Documentation (Optional, depends on IMPL-004)

## Execution

### Sequential (Respects Dependencies)
```bash
# Level 1 - Execute in parallel or sequence
/workflow:execute IMPL-001
/workflow:execute IMPL-002
/workflow:execute IMPL-003

# Wait for Level 1 to complete, then Level 2
/workflow:execute IMPL-004

# Wait for Level 2 to complete, then Level 3 (can parallelize)
/workflow:execute IMPL-005
/workflow:execute IMPL-006
/workflow:execute IMPL-007  # if applicable
```

### With Dependency Awareness (Future Enhancement)
```bash
# /workflow:execute will automatically handle dependencies
/workflow:execute --auto-deps IMPL-007
# This would automatically execute IMPL-001~003 → IMPL-004 → IMPL-007
```
```

## Execution Phase

### Layered Execution Flow

```
Phase 1: Module Tree Generation (Level 1 - Parallel)
├─ /workflow:execute IMPL-001 (src/modules/) ──┐
├─ /workflow:execute IMPL-002 (src/utils/)   ──┼─> All complete
└─ /workflow:execute IMPL-003 (lib/)         ──┘
                                                │
Phase 2: Project README (Level 2 - Sequential) │
└─ /workflow:execute IMPL-004 <────────────────┘ (Waits for Level 1)
                                                │
Phase 3: Architecture & Examples (Level 3)     │
├─ /workflow:execute IMPL-005 (Architecture) <─┤
├─ /workflow:execute IMPL-006 (Examples)    <──┤ (Waits for Level 2)
└─ /workflow:execute IMPL-007 (HTTP API)    <──┘
```

### Per-Task Execution Flow

```
For Each Task (IMPL-001 to IMPL-007):

/workflow:execute IMPL-NNN
    ↓
Check dependencies (if specified in depends_on)
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

### Final Structure (Revised)
```
.workflow/docs/
├── modules/                           # IMPL-001,002,003 (Level 1)
│   ├── README.md                      # Navigation for modules/
│   ├── auth/
│   │   ├── API.md                     # Auth module API signatures
│   │   ├── README.md                  # Auth module documentation
│   │   └── middleware/
│   │       ├── API.md                 # Middleware API
│   │       └── README.md              # Middleware docs
│   └── api/
│       ├── API.md                     # API module signatures
│       └── README.md                  # API module docs
├── README.md                          # IMPL-004 (Level 2) - Project overview
├── ARCHITECTURE.md                    # IMPL-005 (Level 3) - System architecture
├── EXAMPLES.md                        # IMPL-006 (Level 3) - Usage examples
└── api/                               # IMPL-007 (Level 3, Optional)
    └── README.md                      # HTTP API reference
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

### Bottom-Up Documentation Strategy
- **Self-contained modules first**: Each module gets complete documentation (API.md + README.md)
- **Project-level aggregation**: README, Architecture, Examples synthesize from completed modules
- **No premature aggregation**: Project docs wait for all module docs to complete

### Dynamic Folder Structure Recognition
- **No hardcoded paths**: Automatically discovers all project directories
- **Intelligent type detection**: Code folders get API.md + README.md, navigation folders get README.md only
- **Respects project structure**: Works with any directory layout (not just "modules/")

### Clear Separation of Concerns
- **API.md**: Pure interface signatures (what can be called)
- **README.md**: Purpose, usage, concepts (how and why to use it)
- **Architecture.md**: System design and module relationships
- **Examples.md**: End-to-end usage scenarios

### Correct Dependency Management
- **Level 1** (Module trees): Can execute in parallel
- **Level 2** (Project README): Must wait for all module docs
- **Level 3** (Architecture/Examples): Must wait for project README
- **Prevents incomplete aggregation**: Ensures all source data exists before synthesis

### Scalable Task Management
- **Coarse-grained tasks**: One task per top-level directory tree (not per module)
- **Recursive processing**: Each task handles all subfolders within its tree
- **Reduced task count**: 3 tree tasks instead of 10+ module tasks

### Template-Driven Consistency
- **5 specialized templates**: api (unified), module-readme, folder-navigation, project-architecture, project-examples
- **Clear template purpose**: Each template focuses on a single documentation aspect
- **Unified API template**: Single api.txt handles both Code API (Part A) and HTTP API (Part B)
- **No content duplication**: API signatures stay in API.md, usage stays in README.md
