---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
argument-hint: "[path] [--tool <gemini|qwen|codex>] [--cli-generate]"
examples:
  - /workflow:docs                              # Current directory (root: full docs, subdir: module only)
  - /workflow:docs src/modules                  # Module documentation only
  - /workflow:docs . --tool qwen                # Root directory with Qwen
  - /workflow:docs --cli-generate               # Use CLI for doc generation (not just analysis)
---

# Documentation Workflow (/workflow:docs)

## Overview
Lightweight planner that analyzes project structure, decomposes documentation work into tasks, and generates execution plans. Does NOT generate documentation content itself - delegates to doc-generator agent.

**Two Execution Modes**:
- **Default**: CLI analyzes in `pre_analysis` (MODE=analysis), agent writes docs in `implementation_approach`
- **--cli-generate**: CLI generates docs in `implementation_approach` (MODE=write)

## Parameters

```bash
/workflow:docs [path] [--tool <gemini|qwen|codex>] [--cli-generate]
```

- **path**: Target directory (default: current directory)
  - Project root → Full documentation (modules + project-level docs)
  - Subdirectory → Module documentation only (API.md + README.md)

- **--tool**: CLI tool selection (default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition
  - `qwen`: Architecture analysis, system design focus
  - `codex`: Implementation validation, code quality

- **--cli-generate**: Enable CLI-based documentation generation (optional)
  - When enabled: CLI generates docs with MODE=write in implementation_approach
  - When disabled (default): CLI analyzes with MODE=analysis in pre_analysis

## Planning Workflow

### Phase 1: Initialize Session
```bash
# Parse arguments
path="${1:-.}"
tool="gemini"
cli_generate=false

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) tool="$2"; shift 2 ;;
    --cli-generate) cli_generate=true; shift ;;
    *) shift ;;
  esac
done

# Detect project root
bash(git rev-parse --show-toplevel)
project_root=$(pwd)
target_path=$(cd "$path" && pwd)
is_root=false
[[ "$target_path" == "$project_root" ]] && is_root=true

# Create session structure
timestamp=$(date +%Y%m%d-%H%M%S)
session_dir=".workflow/WFS-docs-${timestamp}"

bash(mkdir -p "${session_dir}"/{.task,.process,.summaries})
bash(touch ".workflow/.active-WFS-docs-${timestamp}")

# Record configuration
bash(cat > "${session_dir}/.process/config.txt" <<EOF
path=$path
target_path=$target_path
is_root=$is_root
tool=$tool
cli_generate=$cli_generate
EOF
)
```

### Phase 2: Analyze Structure
```bash
# Step 1: Discover module hierarchy
bash(~/.claude/scripts/get_modules_by_depth.sh)
# Output: depth:N|path:<PATH>|files:N|size:N|has_claude:yes/no

# Step 2: Classify folders by type
bash(cat > "${session_dir}/.process/classify-folders.sh" <<'SCRIPT'
while IFS='|' read -r depth_info path_info files_info size_info claude_info; do
  folder_path=$(echo "$path_info" | cut -d':' -f2-)

  # Count code files (maxdepth 1)
  code_files=$(find "$folder_path" -maxdepth 1 -type f \
    \( -name "*.ts" -o -name "*.js" -o -name "*.py" \
       -o -name "*.go" -o -name "*.java" -o -name "*.rs" \) \
    2>/dev/null | wc -l)

  # Count subfolders
  subfolders=$(find "$folder_path" -maxdepth 1 -type d \
    -not -path "$folder_path" 2>/dev/null | wc -l)

  # Determine type
  if [[ $code_files -gt 0 ]]; then
    folder_type="code"  # API.md + README.md
  elif [[ $subfolders -gt 0 ]]; then
    folder_type="navigation"  # README.md only
  else
    folder_type="skip"  # Empty
  fi

  echo "${folder_path}|${folder_type}|code:${code_files}|dirs:${subfolders}"
done
SCRIPT
)

bash(~/.claude/scripts/get_modules_by_depth.sh | bash "${session_dir}/.process/classify-folders.sh" > "${session_dir}/.process/folder-analysis.txt")

# Step 3: Group by top-level directories
bash(awk -F'|' '{split($1, parts, "/"); if (length(parts) >= 2) print parts[1] "/" parts[2]}' \
  "${session_dir}/.process/folder-analysis.txt" | sort -u > "${session_dir}/.process/top-level-dirs.txt")
```

### Phase 3: Detect Update Mode
```bash
# Check existing documentation
bash(find "$target_path" -name "API.md" -o -name "README.md" -o -name "ARCHITECTURE.md" -o -name "EXAMPLES.md" 2>/dev/null | grep -v ".workflow" | wc -l)

existing_docs=$(...)

if [[ $existing_docs -gt 0 ]]; then
  bash(find "$target_path" -name "*.md" 2>/dev/null | grep -v ".workflow" > "${session_dir}/.process/existing-docs.txt")
  echo "mode=update" >> "${session_dir}/.process/config.txt"
else
  echo "mode=create" >> "${session_dir}/.process/config.txt"
fi

# Record strategy
bash(cat > "${session_dir}/.process/strategy.md" <<EOF
**Path**: ${target_path}
**Is Root**: ${is_root}
**Tool**: ${tool}
**CLI Generate**: ${cli_generate}
**Mode**: $(grep 'mode=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)
**Existing Docs**: ${existing_docs} files
EOF
)
```

### Phase 4: Decompose Tasks

**Task Hierarchy**:
```
Level 1: Module Tree Tasks (Always generated, can execute in parallel)
  ├─ IMPL-001: Document tree 'src/modules/'
  ├─ IMPL-002: Document tree 'src/utils/'
  └─ IMPL-003: Document tree 'lib/'

Level 2: Project README (Only if is_root=true, depends on Level 1)
  └─ IMPL-004: Generate Project README

Level 3: Architecture & Examples (Only if is_root=true, depends on Level 2)
  ├─ IMPL-005: Generate ARCHITECTURE.md
  ├─ IMPL-006: Generate EXAMPLES.md
  └─ IMPL-007: Generate HTTP API docs (optional)
```

**Implementation**:
```bash
# Generate Level 1 tasks (always)
task_count=0
while read -r top_dir; do
  task_count=$((task_count + 1))
  # Create IMPL-00${task_count}.json for module tree
done < "${session_dir}/.process/top-level-dirs.txt"

# Generate Level 2-3 tasks (only if root)
if [[ "$is_root" == "true" ]]; then
  # IMPL-00$((task_count+1)).json: Project README
  # IMPL-00$((task_count+2)).json: ARCHITECTURE.md
  # IMPL-00$((task_count+3)).json: EXAMPLES.md
  # IMPL-00$((task_count+4)).json: HTTP API (optional)
fi
```

### Phase 5: Generate Task JSONs

```bash
# Read configuration
cli_generate=$(grep 'cli_generate=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)
tool=$(grep 'tool=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)

# Determine CLI command placement
if [[ "$cli_generate" == "true" ]]; then
  # CLI generates docs: MODE=write, place in implementation_approach
  mode="write"
  placement="implementation_approach"
  approval_flag="--approval-mode yolo"
else
  # CLI for analysis only: MODE=analysis, place in pre_analysis
  mode="analysis"
  placement="pre_analysis"
  approval_flag=""
fi

# Build tool-specific command
if [[ "$tool" == "codex" ]]; then
  cmd="codex -C ${dir} --full-auto exec \"...\" --skip-git-repo-check -s danger-full-access"
else
  cmd="bash(cd ${dir} && ~/.claude/scripts/${tool}-wrapper ${approval_flag} -p \"...MODE: ${mode}...\")"
fi
```

## Task Templates

### Level 1: Module Tree Task

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
    "cli_generate": false
  },
  "context": {
    "requirements": [
      "Recursively process all folders in src/modules/",
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
        "command": "bash(find src/modules -name '*.md' 2>/dev/null | xargs cat || echo 'No existing docs')",
        "output_to": "existing_module_docs"
      },
      {
        "step": "load_folder_analysis",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders"
      },
      {
        "step": "analyze_module_tree",
        "command": "bash(cd src/modules && ~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze module structure\\nTASK: Generate documentation outline\\nMODE: analysis\\nCONTEXT: @{**/*} [target_folders]\\nEXPECTED: Structure outline\\nRULES: Analyze only\")",
        "output_to": "tree_outline",
        "note": "CLI for analysis only"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate module tree documentation",
        "description": "Process target folders and generate appropriate documentation files based on folder types",
        "modification_points": ["Parse folder types from [target_folders]", "Parse structure from [tree_outline]", "Generate API.md for code folders", "Generate README.md for all folders"],
        "logic_flow": ["Parse [target_folders] to get folder types", "Parse [tree_outline] for structure", "For each folder: if type == 'code': Generate API.md + README.md; elif type == 'navigation': Generate README.md only"],
        "depends_on": [],
        "output": "module_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/modules/*/API.md",
      ".workflow/docs/modules/*/README.md"
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
    "cli_generate": true
  },
  "context": {
    "requirements": [
      "Recursively process all folders in src/modules/",
      "CLI generates documentation files directly"
    ],
    "focus_paths": ["src/modules"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(find src/modules -name '*.md' 2>/dev/null | xargs cat || echo 'No existing docs')",
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
        "description": "Call CLI to generate documentation files for each folder using MODE=write",
        "modification_points": ["Execute CLI generation command", "Generate API.md and README.md files"],
        "logic_flow": ["Call CLI to generate documentation files for each folder"],
        "command": "bash(cd src/modules && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p \"PURPOSE: Generate module docs\\nTASK: Create documentation files\\nMODE: write\\nCONTEXT: @{**/*} [target_folders] [existing_module_docs]\\nEXPECTED: API.md and README.md files\\nRULES: Generate complete docs\")",
        "depends_on": [1],
        "output": "generated_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/modules/*/API.md",
      ".workflow/docs/modules/*/README.md"
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
        "command": "bash(cat .workflow/docs/README.md 2>/dev/null || echo 'No existing README')",
        "output_to": "existing_readme"
      },
      {
        "step": "load_module_docs",
        "command": "bash(find .workflow/docs/modules -name '*.md' | xargs cat)",
        "output_to": "all_module_docs"
      },
      {
        "step": "analyze_project",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze project structure\\nTASK: Extract overview from modules\\nMODE: analysis\\nCONTEXT: [all_module_docs]\\nEXPECTED: Project outline\")",
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
    "target_files": [".workflow/docs/README.md"]
  }
}
```

### Level 3: Architecture Documentation Task

**Default Mode**:
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
    "cli_generate": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_arch",
        "command": "bash(cat .workflow/docs/ARCHITECTURE.md 2>/dev/null || echo 'No existing ARCHITECTURE')",
        "output_to": "existing_architecture"
      },
      {
        "step": "load_all_docs",
        "command": "bash(cat .workflow/docs/README.md && find .workflow/docs/modules -name '*.md' | xargs cat)",
        "output_to": "all_docs"
      },
      {
        "step": "analyze_architecture",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze system architecture\\nTASK: Synthesize architectural overview\\nMODE: analysis\\nCONTEXT: [all_docs]\\nEXPECTED: Architecture outline\")",
        "output_to": "arch_outline"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate architecture documentation",
        "description": "Generate ARCHITECTURE.md while preserving existing user modifications",
        "modification_points": ["Parse [arch_outline] and [all_docs]", "Generate ARCHITECTURE.md structure", "Document system design and patterns", "Preserve [existing_architecture] modifications"],
        "logic_flow": ["Parse [arch_outline] and [all_docs]", "Generate ARCHITECTURE.md", "Preserve [existing_architecture] modifications"],
        "depends_on": [],
        "output": "architecture_doc"
      }
    ],
    "target_files": [".workflow/docs/ARCHITECTURE.md"]
  }
}
```

### Level 3: Examples Documentation Task

**Default Mode**:
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
    "cli_generate": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_examples",
        "command": "bash(cat .workflow/docs/EXAMPLES.md 2>/dev/null || echo 'No existing EXAMPLES')",
        "output_to": "existing_examples"
      },
      {
        "step": "load_project_readme",
        "command": "bash(cat .workflow/docs/README.md)",
        "output_to": "project_readme"
      },
      {
        "step": "generate_examples_outline",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Generate usage examples\\nTASK: Extract example patterns\\nMODE: analysis\\nCONTEXT: [project_readme]\\nEXPECTED: Examples outline\")",
        "output_to": "examples_outline"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate examples documentation",
        "description": "Generate EXAMPLES.md with code snippets while preserving existing user modifications",
        "modification_points": ["Parse [examples_outline] and [project_readme]", "Generate EXAMPLES.md structure", "Add code snippets and usage examples", "Preserve [existing_examples] modifications"],
        "logic_flow": ["Parse [examples_outline] and [project_readme]", "Generate EXAMPLES.md with code snippets", "Preserve [existing_examples] modifications"],
        "depends_on": [],
        "output": "examples_doc"
      }
    ],
    "target_files": [".workflow/docs/EXAMPLES.md"]
  }
}
```

### Level 3: HTTP API Documentation Task (Optional)

**Default Mode**:
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
        "command": "bash(cat .workflow/docs/api/README.md 2>/dev/null || echo 'No existing API docs')",
        "output_to": "existing_api_docs"
      },
      {
        "step": "analyze_api",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document HTTP API\\nTASK: Analyze API endpoints\\nMODE: analysis\\nCONTEXT: @{src/api/**/*} [endpoint_discovery]\\nEXPECTED: API outline\")",
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
    "target_files": [".workflow/docs/api/README.md"]
  }
}
```

## Session Structure

```
.workflow/
├── .active-WFS-docs-20240120-143022
└── WFS-docs-20240120-143022/
    ├── IMPL_PLAN.md              # Implementation plan
    ├── TODO_LIST.md              # Progress tracker
    ├── .process/
    │   ├── config.txt            # path, is_root, tool, cli_generate, mode
    │   ├── strategy.md           # Documentation strategy summary
    │   ├── folder-analysis.txt   # Folder type classification
    │   ├── top-level-dirs.txt    # Top-level directory list
    │   └── existing-docs.txt     # Existing documentation files
    └── .task/
        ├── IMPL-001.json         # Module tree task
        ├── IMPL-002.json         # Module tree task
        ├── IMPL-003.json         # Module tree task
        ├── IMPL-004.json         # Project README (if root)
        ├── IMPL-005.json         # Architecture (if root)
        ├── IMPL-006.json         # Examples (if root)
        └── IMPL-007.json         # HTTP API (if root, optional)
```

## Generated Documentation

```
.workflow/docs/
├── modules/                           # Level 1 output
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
├── README.md                          # Level 2 output (root only)
├── ARCHITECTURE.md                    # Level 3 output (root only)
├── EXAMPLES.md                        # Level 3 output (root only)
└── api/                               # Level 3 output (optional)
    └── README.md                      # HTTP API reference
```

## Execution Commands

### Root Directory (Full Documentation)
```bash
# Level 1 - Module documentation (parallel)
/workflow:execute IMPL-001
/workflow:execute IMPL-002
/workflow:execute IMPL-003

# Level 2 - Project README (after Level 1)
/workflow:execute IMPL-004

# Level 3 - Architecture & Examples (after Level 2, parallel)
/workflow:execute IMPL-005
/workflow:execute IMPL-006
/workflow:execute IMPL-007  # if HTTP API present
```

### Subdirectory (Module Only)
```bash
# Only Level 1 task generated
/workflow:execute IMPL-001
```

## Simple Bash Commands

### Check Documentation Status
```bash
# List existing documentation
bash(find . -name "API.md" -o -name "README.md" -o -name "ARCHITECTURE.md" 2>/dev/null | grep -v ".workflow")

# Count documentation files
bash(find . -name "*.md" 2>/dev/null | grep -v ".workflow" | wc -l)
```

### Analyze Module Structure
```bash
# Discover modules
bash(~/.claude/scripts/get_modules_by_depth.sh)

# Count code files in directory
bash(find src/modules -maxdepth 1 -type f \( -name "*.ts" -o -name "*.js" \) | wc -l)

# Count subdirectories
bash(find src/modules -maxdepth 1 -type d -not -path "src/modules" | wc -l)
```

### Session Management
```bash
# Create session directories
bash(mkdir -p .workflow/WFS-docs-20240120/.{task,process,summaries})

# Mark session as active
bash(touch .workflow/.active-WFS-docs-20240120)

# Read session configuration
bash(cat .workflow/WFS-docs-20240120/.process/config.txt)

# List session tasks
bash(ls .workflow/WFS-docs-20240120/.task/*.json)
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
