---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
argument-hint: "[path] [--tool <gemini|qwen|codex>] [--mode <full|partial>] [--cli-generate]"
---

# Documentation Workflow (/memory:docs)

## Overview
Lightweight planner that analyzes project structure, decomposes documentation work into tasks, and generates execution plans. Does NOT generate documentation content itself - delegates to doc-generator agent.

**Documentation Output**: All generated documentation is placed in `.workflow/docs/{project_name}/` directory with **mirrored project structure**. For example:
- Project: `my_app`
- Source: `my_app/src/core/` → Docs: `.workflow/docs/my_app/src/core/API.md`
- Source: `my_app/src/modules/auth/` → Docs: `.workflow/docs/my_app/src/modules/auth/API.md`

**Two Execution Modes**:
- **Default**: CLI analyzes in `pre_analysis` (MODE=analysis), agent writes docs in `implementation_approach`
- **--cli-generate**: CLI generates docs in `implementation_approach` (MODE=write)

## Path Mirroring Strategy

**Principle**: Documentation structure **mirrors** source code structure under project-specific directory.

| Source Path | Project Name | Documentation Path |
|------------|--------------|-------------------|
| `my_app/src/core/` | `my_app` | `.workflow/docs/my_app/src/core/API.md` |
| `my_app/src/modules/auth/` | `my_app` | `.workflow/docs/my_app/src/modules/auth/API.md` |
| `another_project/lib/utils/` | `another_project` | `.workflow/docs/another_project/lib/utils/API.md` |

**Benefits**:
- Easy to locate documentation for any source file
- Maintains logical organization
- Clear 1:1 mapping between code and docs
- Supports any project structure (src/, lib/, packages/, etc.)

## Parameters

```bash
/memory:docs [path] [--tool <gemini|qwen|codex>] [--mode <full|partial>] [--cli-generate]
```

- **path**: Target directory (default: current directory)
  - Specifies the directory to generate documentation for

- **--mode**: Documentation generation mode (default: full)
  - `full`: Complete documentation (modules + project README + ARCHITECTURE + EXAMPLES)
    - Level 1: Module tree documentation
    - Level 2: Project README.md
    - Level 3: ARCHITECTURE.md + EXAMPLES.md + HTTP API (optional)
  - `partial`: Module documentation only
    - Level 1: Module tree documentation (API.md + README.md)
    - Skips project-level documentation

- **--tool**: CLI tool selection (default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition
  - `qwen`: Architecture analysis, system design focus
  - `codex`: Implementation validation, code quality

- **--cli-generate**: Enable CLI-based documentation generation (optional)
  - When enabled: CLI generates docs with MODE=write in implementation_approach
  - When disabled (default): CLI analyzes with MODE=analysis in pre_analysis

## Planning Workflow

### Phase 1: Initialize Session

#### Step 1: Create Session and Generate Config
```bash
# Create session structure and initialize config in one step
bash(
  # Parse arguments
  path="${1:-.}"
  tool="gemini"
  mode="full"
  cli_generate=false
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="$2"; shift 2 ;;
      --mode) mode="$2"; shift 2 ;;
      --cli-generate) cli_generate=true; shift ;;
      *) shift ;;
    esac
  done

  # Detect paths
  project_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  if [[ "$path" == /* ]] || [[ "$path" == [A-Z]:* ]]; then
    target_path="$path"
  else
    target_path=$(cd "$path" 2>/dev/null && pwd || echo "$PWD/$path")
  fi

  # Extract project name from target_path
  project_name=$(basename "$target_path")

  # Create session
  timestamp=$(date +%Y%m%d-%H%M%S)
  session="WFS-docs-${timestamp}"
  mkdir -p ".workflow/${session}"/{.task,.process,.summaries}
  touch ".workflow/.active-${session}"

  # Generate single config file with all info
  cat > ".workflow/${session}/.process/config.json" <<EOF
{
  "session_id": "${session}",
  "timestamp": "$(date -Iseconds)",
  "path": "${path}",
  "target_path": "${target_path}",
  "project_root": "${project_root}",
  "project_name": "${project_name}",
  "mode": "${mode}",
  "tool": "${tool}",
  "cli_generate": ${cli_generate}
}
EOF

  echo "✓ Session initialized: ${session}"
  echo "✓ Target: ${target_path}"
  echo "✓ Mode: ${mode}"
  echo "✓ Tool: ${tool}, CLI generate: ${cli_generate}"
)
```

**Output**:
```
✓ Session initialized: WFS-docs-20240120-143022
✓ Target: /d/Claude_dms3
✓ Mode: full
✓ Tool: gemini, CLI generate: false
```

### Phase 2: Analyze Structure

**Smart filter**: Auto-detect and skip tests/build/config/vendor based on project tech stack (Node.js/Python/Go/Rust/etc).

#### Step 1: Discover and Classify Folders
```bash
# Run analysis pipeline (module discovery + folder classification + smart filtering)
bash(~/.claude/scripts/get_modules_by_depth.sh | ~/.claude/scripts/classify-folders.sh > .workflow/WFS-docs-20240120/.process/folder-analysis.txt)
```

**Output Sample** (folder-analysis.txt):
```
./src/modules/auth|code|code:5|dirs:2
./src/modules/api|code|code:3|dirs:0
./src/utils|navigation|code:0|dirs:4
```

**Auto-skipped**:
- Tests: `**/test/**`, `**/*.test.*`, `**/__tests__/**`
- Build: `**/node_modules/**`, `**/dist/**`, `**/build/**`
- Config: Root-level config files (package.json, tsconfig.json, etc)
- Vendor: Language-specific dependency directories

#### Step 2: Extract Top-Level Directories
```bash
# Group folders by top-level directory
bash(awk -F'|' '{
  path = $1
  gsub(/^\.\//, "", path)
  split(path, parts, "/")
  if (length(parts) >= 2) print parts[1] "/" parts[2]
  else if (length(parts) == 1 && parts[1] != ".") print parts[1]
}' .workflow/WFS-docs-20240120/.process/folder-analysis.txt | sort -u > .workflow/WFS-docs-20240120/.process/top-level-dirs.txt)
```

**Output** (top-level-dirs.txt):
```
src/modules
src/utils
lib/core
```

#### Step 3: Generate Analysis Summary
```bash
# Calculate statistics
bash(
  total=$(wc -l < .workflow/WFS-docs-20240120/.process/folder-analysis.txt)
  code_count=$(grep '|code|' .workflow/WFS-docs-20240120/.process/folder-analysis.txt | wc -l)
  nav_count=$(grep '|navigation|' .workflow/WFS-docs-20240120/.process/folder-analysis.txt | wc -l)
  top_dirs=$(wc -l < .workflow/WFS-docs-20240120/.process/top-level-dirs.txt)

  echo "📊 Folder Analysis Complete:"
  echo "  - Total folders: $total"
  echo "  - Code folders: $code_count"
  echo "  - Navigation folders: $nav_count"
  echo "  - Top-level dirs: $top_dirs"
)

# Update config with statistics
bash(jq '. + {analysis: {total: "15", code: "8", navigation: "7", top_level: "3"}}' .workflow/WFS-docs-20240120/.process/config.json > .workflow/WFS-docs-20240120/.process/config.json.tmp && mv .workflow/WFS-docs-20240120/.process/config.json.tmp .workflow/WFS-docs-20240120/.process/config.json)
```

### Phase 3: Detect Update Mode

#### Step 1: Count Existing Documentation in .workflow/docs/{project_name}/
```bash
# Check .workflow/docs/{project_name}/ directory and count existing files
bash(
  project_name=$(jq -r '.project_name' .workflow/WFS-docs-20240120/.process/config.json)
  if [[ -d ".workflow/docs/${project_name}" ]]; then
    find .workflow/docs/${project_name} -name "*.md" 2>/dev/null | wc -l
  else
    echo "0"
  fi
)
```

**Output**: `5` (existing docs in .workflow/docs/{project_name}/)

#### Step 2: List Existing Documentation
```bash
# List existing files in .workflow/docs/{project_name}/ (for task context)
bash(
  project_name=$(jq -r '.project_name' .workflow/WFS-docs-20240120/.process/config.json)
  if [[ -d ".workflow/docs/${project_name}" ]]; then
    find .workflow/docs/${project_name} -name "*.md" 2>/dev/null > .workflow/WFS-docs-20240120/.process/existing-docs.txt
  else
    touch .workflow/WFS-docs-20240120/.process/existing-docs.txt
  fi
)
```

**Output** (existing-docs.txt):
```
.workflow/docs/my_app/src/modules/auth/API.md
.workflow/docs/my_app/src/modules/auth/README.md
.workflow/docs/my_app/lib/core/README.md
.workflow/docs/my_app/README.md
```

#### Step 3: Update Config with Update Status
```bash
# Determine update status (create or update) and update config
bash(
  project_name=$(jq -r '.project_name' .workflow/WFS-docs-20240120/.process/config.json)
  existing_count=$(find .workflow/docs/${project_name} -name "*.md" 2>/dev/null | wc -l)
  if [[ $existing_count -gt 0 ]]; then
    jq ". + {update_mode: \"update\", existing_docs: $existing_count}" .workflow/WFS-docs-20240120/.process/config.json > .workflow/WFS-docs-20240120/.process/config.json.tmp && mv .workflow/WFS-docs-20240120/.process/config.json.tmp .workflow/WFS-docs-20240120/.process/config.json
  else
    jq '. + {update_mode: "create", existing_docs: 0}' .workflow/WFS-docs-20240120/.process/config.json > .workflow/WFS-docs-20240120/.process/config.json.tmp && mv .workflow/WFS-docs-20240120/.process/config.json.tmp .workflow/WFS-docs-20240120/.process/config.json
  fi
)

# Display strategy summary
bash(
  mode=$(jq -r '.mode' .workflow/WFS-docs-20240120/.process/config.json)
  update_mode=$(jq -r '.update_mode' .workflow/WFS-docs-20240120/.process/config.json)
  existing=$(jq -r '.existing_docs' .workflow/WFS-docs-20240120/.process/config.json)
  tool=$(jq -r '.tool' .workflow/WFS-docs-20240120/.process/config.json)
  cli_gen=$(jq -r '.cli_generate' .workflow/WFS-docs-20240120/.process/config.json)

  echo "📋 Documentation Strategy:"
  echo "  - Path: $(jq -r '.target_path' .workflow/WFS-docs-20240120/.process/config.json)"
  echo "  - Mode: $mode ($([ "$mode" = "full" ] && echo "complete docs" || echo "modules only"))"
  echo "  - Update: $update_mode ($existing existing files)"
  echo "  - Tool: $tool, CLI generate: $cli_gen"
)
```

### Phase 4: Decompose Tasks

#### Task Hierarchy
```
Level 1: Module Trees (always, parallel execution)
  ├─ IMPL-001: Document 'src/modules/'
  ├─ IMPL-002: Document 'src/utils/'
  └─ IMPL-003: Document 'lib/'

Level 2: Project README (mode=full only, depends on Level 1)
  └─ IMPL-004: Generate Project README

Level 3: Architecture & Examples (mode=full only, depends on Level 2)
  ├─ IMPL-005: Generate ARCHITECTURE.md + EXAMPLES.md
  └─ IMPL-006: Generate HTTP API (optional)
```

#### Step 1: Generate Level 1 Tasks (Module Trees)
```bash
# Read top-level directories and create tasks
bash(
  task_count=0
  while read -r top_dir; do
    task_count=$((task_count + 1))
    task_id=$(printf "IMPL-%03d" $task_count)
    echo "Creating $task_id for '$top_dir'"
    # Generate task JSON (see Task Templates section)
  done < .workflow/WFS-docs-20240120/.process/top-level-dirs.txt
)
```

**Output**:
```
Creating IMPL-001 for 'src/modules'
Creating IMPL-002 for 'src/utils'
Creating IMPL-003 for 'lib'
```

#### Step 2: Generate Level 2-3 Tasks (Full Mode Only)
```bash
# Check documentation mode
bash(jq -r '.mode' .workflow/WFS-docs-20240120/.process/config.json)

# If full mode, create project-level tasks
bash(
  mode=$(jq -r '.mode' .workflow/WFS-docs-20240120/.process/config.json)
  if [[ "$mode" == "full" ]]; then
    echo "Creating IMPL-004: Project README"
    echo "Creating IMPL-005: ARCHITECTURE.md + EXAMPLES.md"
    # Optional: Check for HTTP API endpoints
    if grep -r "router\.|@Get\|@Post" src/ >/dev/null 2>&1; then
      echo "Creating IMPL-006: HTTP API docs"
    fi
  else
    echo "Partial mode: Skipping project-level tasks"
  fi
)
```

### Phase 5: Generate Task JSONs

#### Step 1: Extract Configuration
```bash
# Read config values from JSON
bash(jq -r '.tool' .workflow/WFS-docs-20240120/.process/config.json)
bash(jq -r '.cli_generate' .workflow/WFS-docs-20240120/.process/config.json)
```

**Output**: `tool=gemini`, `cli_generate=false`

#### Step 2: Determine CLI Command Strategy
```bash
# Determine MODE and placement based on cli_generate flag
bash(
  cli_generate=$(jq -r '.cli_generate' .workflow/WFS-docs-20240120/.process/config.json)

  if [[ "$cli_generate" == "true" ]]; then
    echo "mode=write"
    echo "placement=implementation_approach"
    echo "approval_flag=--approval-mode yolo"
  else
    echo "mode=analysis"
    echo "placement=pre_analysis"
    echo "approval_flag="
  fi
)
```

**Output**:
```
mode=analysis
placement=pre_analysis
approval_flag=
```

#### Step 3: Build Tool-Specific Commands
```bash
# Generate command templates based on tool selection
bash(
  tool=$(jq -r '.tool' .workflow/WFS-docs-20240120/.process/config.json)

  if [[ "$tool" == "codex" ]]; then
    echo "codex -C \${dir} --full-auto exec \"...\" --skip-git-repo-check -s danger-full-access"
  else
    echo "bash(cd \${dir} && ${tool} ${approval_flag} -p \"...\")"
    # Direct CLI commands for gemini/qwen
  fi
)
```

## Task Templates

### Level 1: Module Tree Task

**Path Mapping**:
- Project: `{project_name}` (extracted from target_path)
- Source: `{project_name}/src/modules/`
- Output: `.workflow/docs/{project_name}/src/modules/`

**Default Mode (cli_generate=false)**:
```json
{
  "id": "IMPL-001",
  "title": "Document Module Tree: 'src/modules/'",
  "status": "pending",
  "meta": {
    "type": "docs-tree",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_generate": false,
    "source_path": "src/modules",
    "output_path": ".workflow/docs/${project_name}/src/modules"
  },
  "context": {
    "requirements": [
      "Analyze source code in src/modules/",
      "Generate docs to .workflow/docs/${project_name}/src/modules/ (mirrored structure)",
      "For code folders: generate API.md + README.md",
      "For navigation folders: generate README.md only"
    ],
    "focus_paths": ["src/modules"],
    "folder_analysis_file": "${session_dir}/.process/folder-analysis.txt"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(find .workflow/docs/${project_name}/${top_dir} -name '*.md' 2>/dev/null | xargs cat || echo 'No existing docs')",
        "output_to": "existing_module_docs"
      },
      {
        "step": "load_folder_analysis",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders"
      },
      {
        "step": "analyze_module_tree",
        "command": "bash(cd src/modules && gemini \"PURPOSE: Analyze module structure\\nTASK: Generate documentation outline\\nMODE: analysis\\nCONTEXT: @**/* [target_folders]\\nEXPECTED: Structure outline\\nRULES: Analyze only\")",
        "output_to": "tree_outline",
        "note": "CLI for analysis only"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate module tree documentation",
        "description": "Analyze source folders and generate docs to .workflow/docs/ with mirrored structure",
        "modification_points": [
          "Parse folder types from [target_folders]",
          "Parse structure from [tree_outline]",
          "For src/modules/auth/ → write to .workflow/docs/${project_name}/src/modules/auth/",
          "Generate API.md for code folders",
          "Generate README.md for all folders"
        ],
        "logic_flow": [
          "Parse [target_folders] to get folder types",
          "Parse [tree_outline] for structure",
          "For each folder in source:",
          "  - Map source_path to .workflow/docs/${project_name}/{source_path}",
          "  - If type == 'code': Generate API.md + README.md",
          "  - Elif type == 'navigation': Generate README.md only"
        ],
        "depends_on": [],
        "output": "module_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/${top_dir}/*/API.md",
      ".workflow/docs/${project_name}/${top_dir}/*/README.md"
    ]
  }
}
```

**CLI Generate Mode (cli_generate=true)**:
```json
{
  "id": "IMPL-001",
  "title": "Document Module Tree: 'src/modules/'",
  "status": "pending",
  "meta": {
    "type": "docs-tree",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_generate": true,
    "source_path": "src/modules",
    "output_path": ".workflow/docs/${project_name}/src/modules"
  },
  "context": {
    "requirements": [
      "Analyze source code in src/modules/",
      "Generate docs to .workflow/docs/${project_name}/src/modules/ (mirrored structure)",
      "CLI generates documentation files directly"
    ],
    "focus_paths": ["src/modules"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(find .workflow/docs/${project_name}/${top_dir} -name '*.md' 2>/dev/null | xargs cat || echo 'No existing docs')",
        "output_to": "existing_module_docs"
      },
      {
        "step": "load_folder_analysis",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Parse folder analysis",
        "description": "Parse [target_folders] to get folder types and structure",
        "modification_points": ["Extract folder types", "Identify code vs navigation folders"],
        "logic_flow": ["Parse [target_folders] to get folder types", "Prepare folder list for CLI generation"],
        "depends_on": [],
        "output": "folder_types"
      },
      {
        "step": 2,
        "title": "Generate documentation via CLI",
        "description": "Call CLI to generate docs to .workflow/docs/ with mirrored structure using MODE=write",
        "modification_points": [
          "Execute CLI generation command",
          "Generate files to .workflow/docs/${project_name}/src/modules/ (mirrored path)",
          "Generate API.md and README.md files"
        ],
        "logic_flow": [
          "CLI analyzes source code in src/modules/",
          "CLI writes documentation to .workflow/docs/${project_name}/src/modules/",
          "Maintains directory structure mirroring"
        ],
        "command": "bash(cd src/modules && gemini --approval-mode yolo \"PURPOSE: Generate module docs\\nTASK: Create documentation files in .workflow/docs/${project_name}/src/modules/\\nMODE: write\\nCONTEXT: @**/* [target_folders] [existing_module_docs]\\nEXPECTED: API.md and README.md in .workflow/docs/${project_name}/src/modules/\\nRULES: Mirror source structure, generate complete docs\")",
        "depends_on": [1],
        "output": "generated_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/${top_dir}/*/API.md",
      ".workflow/docs/${project_name}/${top_dir}/*/README.md"
    ]
  }
}
```

### Level 2: Project README Task

**Default Mode**:
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
    "cli_generate": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_readme",
        "command": "bash(cat .workflow/docs/${project_name}/README.md 2>/dev/null || echo 'No existing README')",
        "output_to": "existing_readme"
      },
      {
        "step": "load_module_docs",
        "command": "bash(find .workflow/docs/${project_name} -type f -name '*.md' ! -path '.workflow/docs/${project_name}/README.md' ! -path '.workflow/docs/${project_name}/ARCHITECTURE.md' ! -path '.workflow/docs/${project_name}/EXAMPLES.md' ! -path '.workflow/docs/${project_name}/api/*' | xargs cat)",
        "output_to": "all_module_docs",
        "note": "Load all module docs from mirrored structure"
      },
      {
        "step": "analyze_project",
        "command": "bash(gemini \"PURPOSE: Analyze project structure\\nTASK: Extract overview from modules\\nMODE: analysis\\nCONTEXT: [all_module_docs]\\nEXPECTED: Project outline\")",
        "output_to": "project_outline"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate project README",
        "description": "Generate project README with navigation links while preserving existing user modifications",
        "modification_points": ["Parse [project_outline] and [all_module_docs]", "Generate project README structure", "Add navigation links to modules", "Preserve [existing_readme] user modifications"],
        "logic_flow": ["Parse [project_outline] and [all_module_docs]", "Generate project README with navigation links", "Preserve [existing_readme] user modifications"],
        "depends_on": [],
        "output": "project_readme"
      }
    ],
    "target_files": [".workflow/docs/${project_name}/README.md"]
  }
}
```

### Level 3: Architecture & Examples Documentation Task

**Default Mode**:
```json
{
  "id": "IMPL-005",
  "title": "Generate Architecture & Examples Documentation",
  "status": "pending",
  "depends_on": ["IMPL-004"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_generate": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(cat .workflow/docs/${project_name}/ARCHITECTURE.md 2>/dev/null || echo 'No existing ARCHITECTURE'; echo '---SEPARATOR---'; cat .workflow/docs/${project_name}/EXAMPLES.md 2>/dev/null || echo 'No existing EXAMPLES')",
        "output_to": "existing_arch_examples"
      },
      {
        "step": "load_all_docs",
        "command": "bash(cat .workflow/docs/${project_name}/README.md && find .workflow/docs/${project_name} -type f -name '*.md' ! -path '.workflow/docs/${project_name}/README.md' ! -path '.workflow/docs/${project_name}/ARCHITECTURE.md' ! -path '.workflow/docs/${project_name}/EXAMPLES.md' ! -path '.workflow/docs/${project_name}/api/*' | xargs cat)",
        "output_to": "all_docs",
        "note": "Load README + all module docs from mirrored structure"
      },
      {
        "step": "analyze_architecture_and_examples",
        "command": "bash(gemini \"PURPOSE: Analyze system architecture and generate examples\\nTASK: Synthesize architectural overview and usage patterns\\nMODE: analysis\\nCONTEXT: [all_docs]\\nEXPECTED: Architecture outline + Examples outline\")",
        "output_to": "arch_examples_outline"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate architecture and examples documentation",
        "description": "Generate ARCHITECTURE.md and EXAMPLES.md while preserving existing user modifications",
        "modification_points": [
          "Parse [arch_examples_outline] and [all_docs]",
          "Generate ARCHITECTURE.md structure with system design and patterns",
          "Generate EXAMPLES.md structure with code snippets and usage examples",
          "Preserve [existing_arch_examples] user modifications"
        ],
        "logic_flow": [
          "Parse [arch_examples_outline] and [all_docs]",
          "Generate ARCHITECTURE.md with system design",
          "Generate EXAMPLES.md with code snippets",
          "Preserve [existing_arch_examples] modifications"
        ],
        "depends_on": [],
        "output": "arch_examples_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/ARCHITECTURE.md",
      ".workflow/docs/${project_name}/EXAMPLES.md"
    ]
  }
}
```

### Level 3: HTTP API Documentation Task (Optional)

**Default Mode**:
```json
{
  "id": "IMPL-006",
  "title": "Generate HTTP API Documentation",
  "status": "pending",
  "depends_on": ["IMPL-004"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_generate": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "discover_api_endpoints",
        "command": "mcp__code-index__search_code_advanced(pattern='router\\.|@(Get|Post)', file_pattern='*.{ts,js}')",
        "output_to": "endpoint_discovery"
      },
      {
        "step": "load_existing_api_docs",
        "command": "bash(cat .workflow/docs/${project_name}/api/README.md 2>/dev/null || echo 'No existing API docs')",
        "output_to": "existing_api_docs"
      },
      {
        "step": "analyze_api",
        "command": "bash(gemini \"PURPOSE: Document HTTP API\\nTASK: Analyze API endpoints\\nMODE: analysis\\nCONTEXT: @src/api/**/* [endpoint_discovery]\\nEXPECTED: API outline\")",
        "output_to": "api_outline"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate HTTP API documentation",
        "description": "Generate HTTP API documentation while preserving existing user modifications",
        "modification_points": ["Parse [api_outline] and [endpoint_discovery]", "Generate HTTP API documentation", "Document endpoints and request/response formats", "Preserve [existing_api_docs] modifications"],
        "logic_flow": ["Parse [api_outline] and [endpoint_discovery]", "Generate HTTP API documentation", "Preserve [existing_api_docs] modifications"],
        "depends_on": [],
        "output": "api_docs"
      }
    ],
    "target_files": [".workflow/docs/${project_name}/api/README.md"]
  }
}
```

## Session Structure

```
.workflow/
├── .active-WFS-docs-20240120-143022        # Active session marker
└── WFS-docs-20240120-143022/
    ├── IMPL_PLAN.md                         # Implementation plan
    ├── TODO_LIST.md                         # Progress tracker
    ├── .process/
    │   ├── config.json                      # Single config (all settings + stats)
    │   ├── folder-analysis.txt              # Folder classification results
    │   ├── top-level-dirs.txt               # Top-level directory list
    │   └── existing-docs.txt                # Existing documentation paths
    └── .task/
        ├── IMPL-001.json                    # Module tree task
        ├── IMPL-002.json                    # Module tree task
        ├── IMPL-003.json                    # Module tree task
        ├── IMPL-004.json                    # Project README (full mode)
        ├── IMPL-005.json                    # ARCHITECTURE.md + EXAMPLES.md (full mode)
        └── IMPL-006.json                    # HTTP API docs (optional)
```

**Config File Structure** (config.json):
```json
{
  "session_id": "WFS-docs-20240120-143022",
  "timestamp": "2024-01-20T14:30:22+08:00",
  "path": ".",
  "target_path": "/home/user/projects/my_app",
  "project_root": "/home/user/projects",
  "project_name": "my_app",
  "mode": "full",
  "tool": "gemini",
  "cli_generate": false,
  "update_mode": "update",
  "existing_docs": 5,
  "analysis": {
    "total": "15",
    "code": "8",
    "navigation": "7",
    "top_level": "3"
  }
}
```

## Generated Documentation

**Structure mirrors project source directories under project-specific folder**:

```
.workflow/docs/
└── {project_name}/                    # Project-specific root (e.g., my_app/)
    ├── src/                           # Mirrors src/ directory
    │   ├── modules/                   # Level 1 output
    │   │   ├── README.md              # Navigation for src/modules/
    │   │   ├── auth/
    │   │   │   ├── API.md             # Auth module API signatures
    │   │   │   ├── README.md          # Auth module documentation
    │   │   │   └── middleware/
    │   │   │       ├── API.md         # Middleware API
    │   │   │       └── README.md      # Middleware docs
    │   │   └── api/
    │   │       ├── API.md             # API module signatures
    │   │       └── README.md          # API module docs
    │   └── utils/                     # Level 1 output
    │       └── README.md              # Utils navigation
    ├── lib/                           # Mirrors lib/ directory
    │   └── core/
    │       ├── API.md
    │       └── README.md
    ├── README.md                      # Level 2 output (project root only)
    ├── ARCHITECTURE.md                # Level 3 output (project root only)
    ├── EXAMPLES.md                    # Level 3 output (project root only)
    └── api/                           # Level 3 output (optional)
        └── README.md                  # HTTP API reference
```

## Execution Commands

```bash
# Execute entire workflow (auto-discovers active session)
/workflow:execute

# Or specify session
/workflow:execute --resume-session="WFS-docs-yyyymmdd-hhmmss"

# Individual task execution (if needed)
/task:execute IMPL-001
```

## Simple Bash Commands

### Session Management
```bash
# Create session and initialize config (all in one)
bash(
  session="WFS-docs-$(date +%Y%m%d-%H%M%S)"
  mkdir -p ".workflow/${session}"/{.task,.process,.summaries}
  touch ".workflow/.active-${session}"
  cat > ".workflow/${session}/.process/config.json" <<EOF
{"session_id":"${session}","timestamp":"$(date -Iseconds)","path":".","mode":"full","tool":"gemini","cli_generate":false}
EOF
  echo "Session: ${session}"
)

# Read session config
bash(cat .workflow/WFS-docs-20240120/.process/config.json)

# Extract config values
bash(jq -r '.tool' .workflow/WFS-docs-20240120/.process/config.json)
bash(jq -r '.mode' .workflow/WFS-docs-20240120/.process/config.json)

# List session tasks
bash(ls .workflow/WFS-docs-20240120/.task/*.json)
```

### Analysis Commands
```bash
# Discover and classify folders (scans project source)
bash(~/.claude/scripts/get_modules_by_depth.sh | ~/.claude/scripts/classify-folders.sh)

# Count existing docs (in .workflow/docs/{project_name}/ directory)
bash(if [[ -d ".workflow/docs/${project_name}" ]]; then find .workflow/docs/${project_name} -name "*.md" 2>/dev/null | wc -l; else echo "0"; fi)

# List existing documentation (in .workflow/docs/{project_name}/ directory)
bash(if [[ -d ".workflow/docs/${project_name}" ]]; then find .workflow/docs/${project_name} -name "*.md" 2>/dev/null; fi)
```

## Template Reference

**Available Templates**:
- `api.txt`: Unified template for Code API (Part A) and HTTP API (Part B)
- `module-readme.txt`: Module purpose, usage, dependencies
- `folder-navigation.txt`: Navigation README for folders with subdirectories
- `project-readme.txt`: Project overview, getting started, module navigation
- `project-architecture.txt`: System structure, module map, design patterns
- `project-examples.txt`: End-to-end usage examples

**Template Location**: `~/.claude/workflows/cli-templates/prompts/documentation/`

## CLI Generate Mode Summary

| Mode | CLI Placement | CLI MODE | Agent Role |
|------|---------------|----------|------------|
| **Default** | pre_analysis | analysis | Generates documentation files |
| **--cli-generate** | implementation_approach | write | Validates and coordinates CLI output |

## Related Commands
- `/workflow:execute` - Execute documentation tasks
- `/workflow:status` - View task progress
- `/workflow:session:complete` - Mark session complete
