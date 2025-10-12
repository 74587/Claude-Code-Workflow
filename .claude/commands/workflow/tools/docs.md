---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
argument-hint: "[path] [--tool <gemini|qwen|codex>] [--cli-generate]"
examples:
  - /workflow:docs                              # Current directory (root: full docs, subdir: module only)
  - /workflow:docs src/modules                  # Module documentation only
  - /workflow:docs . --tool qwen                # Root directory with Qwen
  - /workflow:docs src/api --tool gemini        # API module documentation
  - /workflow:docs --cli-generate               # Use CLI for doc generation (not just analysis)
---

# Workflow Documentation Command

## Overview

### Purpose

**`/workflow:docs` is a lightweight planner/orchestrator** - it analyzes project structure using metadata tools, decomposes documentation work into tasks, and generates execution plans. It does **NOT** generate any documentation content itself.

**Key Principle**: Lightweight Planning + Targeted Execution
- **docs.md** → Collect metadata (paths, structure), generate task JSONs with path references
- **doc-generator agent** → Execute targeted analysis on focus_paths, generate content

**Optimization Philosophy**:
- **Planning phase**: Minimal context - only metadata (module paths, file lists)
- **Task JSON**: Store path references, not content
- **Execution phase**: Targeted deep analysis within focus_paths scope

### Key Features

**CLI Generation Control**
- Two execution modes: Analysis mode (default) vs Generation mode (--cli-generate)
- Analysis mode: CLI tools analyze in `pre_analysis`, agent writes docs in `implementation_approach`
- Generation mode: CLI tools generate docs directly in `implementation_approach` with MODE=write
- Flexible workflow: Choose between agent-driven or CLI-driven documentation generation

**Path-Based Control**
- Flexible path specification: Document entire project (root) or specific subdirectories
- Automatic root detection: Uses git repository root to determine scope
- Smart task generation: Root paths get full docs, subdirectories get module docs only

**Update Mode**
- Automatic detection: Recognizes existing documentation files
- Content preservation: Maintains user modifications when updating
- Incremental improvements: Add new sections without losing existing content
- Safe regeneration: Can safely re-run command to update stale docs

**Bottom-Up Strategy**
- Self-contained modules first: Each module gets complete documentation (API.md + README.md)
- Project-level aggregation: README, Architecture, Examples synthesize from completed modules
- No premature aggregation: Project docs wait for all module docs to complete
- Conditional project docs: Only generated when running from project root

**Dynamic Recognition**
- No hardcoded paths: Automatically discovers all project directories
- Intelligent type detection: Code folders get API.md + README.md, navigation folders get README.md only
- Respects project structure: Works with any directory layout

**Correct Dependencies**
- Level 1 (Module trees): Always generated, can execute in parallel
- Level 2 (Project README): Only if root, must wait for all module docs
- Level 3 (Architecture/Examples): Only if root, must wait for project README

### Usage

```bash
/workflow:docs [path] [--tool <gemini|qwen|codex>] [--cli-generate]
```

**Parameters**:

- **path**: Target directory path (optional, default: current directory)
  - If path is project root: Generate full documentation (modules + project-level docs)
  - If path is subdirectory: Generate module documentation only (API.md + README.md)
  - Path can be relative (e.g., `src/modules`) or absolute

- **--tool**: `gemini` | `qwen` | `codex` (optional, default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition (default)
  - `qwen`: Architecture analysis, system design focus
  - `codex`: Implementation validation, code quality

- **--cli-generate**: Enable CLI-based documentation generation (optional)
  - When enabled: CLI tools generate documentation content in implementation_approach
  - When disabled (default): CLI tools only used for analysis in pre_analysis
  - Requires MODE=write in CLI commands for file generation

## Workflow

### Planning Phases

```
/workflow:docs [path] [--tool] [--cli-generate]
    ↓
Phase 1: Initialize Session → Create session dir, detect root status, record cli_generate flag
    ↓
Phase 2: Analyze Structure → Run get_modules_by_depth.sh, classify folders
    ↓
Phase 3: Detect Update Mode → Check existing docs, determine create/update
    ↓
Phase 4: Decompose Tasks → Generate Level 1-3 tasks based on root status
    ↓
Phase 5: Generate Task JSONs → Build IMPL-*.json with flow_control
                                  - cli_generate=false: CLI in pre_analysis (MODE=analysis)
                                  - cli_generate=true: CLI in implementation_approach (MODE=write)
    ↓
✅ Planning Complete → Show TodoWrite status
```

### Phase 1: Initialize Session

```bash
# Parse arguments
path="${1:-.}"  # Target path (default: current directory)
tool="gemini"   # gemini|qwen|codex (default: gemini)
cli_generate=false  # CLI-based generation flag

# Parse options
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) tool="$2"; shift 2 ;;
    --cli-generate) cli_generate=true; shift ;;
    *) shift ;;
  esac
done

# Detect project root and determine if target is root
project_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
target_path=$(cd "$path" && pwd)
is_root=false
[[ "$target_path" == "$project_root" ]] && is_root=true

# Create session structure
timestamp=$(date +%Y%m%d-%H%M%S)
session_dir=".workflow/WFS-docs-${timestamp}"
mkdir -p "${session_dir}"/{.task,.process,.summaries}
touch ".workflow/.active-WFS-docs-${timestamp}"

# Record configuration
echo "path=$path" >> "${session_dir}/.process/config.txt"
echo "target_path=$target_path" >> "${session_dir}/.process/config.txt"
echo "is_root=$is_root" >> "${session_dir}/.process/config.txt"
echo "tool=$tool" >> "${session_dir}/.process/config.txt"
echo "cli_generate=$cli_generate" >> "${session_dir}/.process/config.txt"
```

### Phase 2: Analyze Structure

```bash
# Step 1: Discover module hierarchy
module_data=$(~/.claude/scripts/get_modules_by_depth.sh)
# Format: depth:N|path:<PATH>|files:N|size:N|has_claude:yes/no

# Step 2: Classify each folder by type
mkdir -p "${session_dir}/.process"
> "${session_dir}/.process/folder-analysis.txt"

while IFS='|' read -r depth_info path_info files_info size_info claude_info; do
  folder_path=$(echo "$path_info" | cut -d':' -f2-)
  depth=$(echo "$depth_info" | cut -d':' -f2)

  # Count code files (maxdepth 1)
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

# Step 3: Group folders by top-level directories
awk -F'|' '{
  split($1, parts, "/");
  if (length(parts) >= 2) {
    top_dir = parts[1] "/" parts[2];
    print top_dir;
  }
}' "${session_dir}/.process/folder-analysis.txt" | sort -u > "${session_dir}/.process/top-level-dirs.txt"
```

### Phase 3: Detect Update Mode

```bash
# Detect existing documentation
existing_docs=$(find "$target_path" -name "API.md" -o -name "README.md" -o -name "ARCHITECTURE.md" -o -name "EXAMPLES.md" 2>/dev/null | grep -v ".workflow" | wc -l)

# List existing documentation for update mode
if [[ $existing_docs -gt 0 ]]; then
    echo "Update mode: Found $existing_docs existing documentation files"
    find "$target_path" -name "API.md" -o -name "README.md" -o -name "ARCHITECTURE.md" -o -name "EXAMPLES.md" 2>/dev/null | grep -v ".workflow" > "${session_dir}/.process/existing-docs.txt"
    echo "mode=update" >> "${session_dir}/.process/config.txt"
else
    echo "mode=create" >> "${session_dir}/.process/config.txt"
fi

# Record strategy
cat > "${session_dir}/.process/strategy.md" <<EOF
**Path**: ${target_path}
**Is Root**: ${is_root}
**Tool**: ${tool}
**CLI Generate**: ${cli_generate}
**Mode**: $(grep 'mode=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)
**Existing Docs**: ${existing_docs} files
EOF
```

### Phase 4: Decompose Tasks

**Decomposition Strategy**:

**Level 1: Module Tree Tasks** (Always generated)
- For each top-level directory in `top-level-dirs.txt`, create one "tree" task
- Each tree task recursively handles all subfolders within that directory
- Task generates both API.md and README.md based on folder type analysis
- These tasks are ALWAYS created regardless of root status

**Level 2-3: Project-Level Docs** (Only if is_root=true)
- **Level 2: Project README** (Depends on all Level 1 tasks)
  - MUST wait for all module trees to complete
  - Aggregates information from all module documents
  - Creates navigation structure
- **Level 3: Architecture & Examples** (Depends on Level 2)
  - Architecture document synthesizes from all module docs + project README
  - Examples document uses project README as foundation

**Implementation**:

```bash
# Read root status from config
is_root=$(grep 'is_root=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)

# Generate Level 1 tasks (always)
task_count=0
while read -r top_dir; do
  task_count=$((task_count + 1))
  # Create IMPL-00${task_count}.json for module tree
done < "${session_dir}/.process/top-level-dirs.txt"

# Generate Level 2-3 tasks (only if root)
if [[ "$is_root" == "true" ]]; then
  # Create IMPL-00$((task_count+1)).json for Project README
  # Create IMPL-00$((task_count+2)).json for ARCHITECTURE.md
  # Create IMPL-00$((task_count+3)).json for EXAMPLES.md
  # Create IMPL-00$((task_count+4)).json for HTTP API (optional)
fi
```

### Phase 5: Generate Task JSONs

Each task follows the 5-field schema with detailed flow_control:

```bash
# Read cli_generate flag from config
cli_generate=$(grep 'cli_generate=' "${session_dir}/.process/config.txt" | cut -d'=' -f2)

# Build tool-specific command at planning time
if [[ "$tool" == "codex" ]]; then
    cmd="codex -C ${dir} --full-auto exec \"...\""
else
    # Determine MODE and placement based on cli_generate flag
    if [[ "$cli_generate" == "true" ]]; then
        # CLI generates docs: MODE=write, place in implementation_approach
        mode="write"
        placement="implementation_approach"
    else
        # CLI for analysis only: MODE=analysis, place in pre_analysis
        mode="analysis"
        placement="pre_analysis"
    fi

    cmd="bash(cd ${dir} && ~/.claude/scripts/${tool}-wrapper -p \"...MODE: ${mode}...\")"
fi

# Summary:
# - cli_generate=false (default): CLI in pre_analysis (MODE=analysis), agent writes docs
# - cli_generate=true: CLI in implementation_approach (MODE=write), CLI writes docs
```

## Task Architecture

### Task Hierarchy

```
┌─────────────────────────────────────────────┐
│ Level 1: Module Tree Tasks (Parallel)      │
│ - IMPL-001: src/modules/                   │
│ - IMPL-002: src/utils/                     │
│ - IMPL-003: lib/                           │
│ Output: modules/*/{API.md,README.md}       │
└──────────────┬──────────────────────────────┘
               │ (depends_on)
               ↓
┌──────────────────────────────────────────────┐
│ Level 2: Project README (Sequential)        │ (Only if is_root=true)
│ - IMPL-004: Project README                  │
│ Output: README.md                           │
└──────────────┬───────────────────────────────┘
               │ (depends_on)
               ↓
┌──────────────────────────────────────────────┐
│ Level 3: Architecture & Examples (Parallel) │ (Only if is_root=true)
│ - IMPL-005: ARCHITECTURE.md                 │
│ - IMPL-006: EXAMPLES.md                     │
│ - IMPL-007: HTTP API docs (optional)        │
└──────────────────────────────────────────────┘
```

### Task Examples

**Example 1: Root Directory (Full Documentation)**
```
Path: /d/Claude_dms3 (project root)
Tasks: IMPL-001~003 (modules) + IMPL-004~007 (project-level)

IMPL-001: Document tree 'src/modules/' (Level 1)
IMPL-002: Document tree 'src/utils/' (Level 1)
IMPL-003: Document tree 'lib/' (Level 1)
IMPL-004: Project README.md (Level 2, depends_on: [001,002,003])
IMPL-005: ARCHITECTURE.md (Level 3, depends_on: [004])
IMPL-006: EXAMPLES.md (Level 3, depends_on: [004])
```

**Example 2: Subdirectory (Module Documentation Only)**
```
Path: /d/Claude_dms3/src/modules (subdirectory)
Tasks: IMPL-001 only (module docs)

IMPL-001: Document tree 'src/modules/' (Level 1 only)
# No Level 2-3 tasks generated (not root)
```

### Dependency Rules

1. **Level 1 tasks**: No dependencies, can execute in parallel
2. **Level 2 tasks**: Depend on ALL Level 1 tasks completing
3. **Level 3 tasks**: Depend on Level 2 task completing, can parallelize within level
4. **Update mode**: All tasks include `load_existing_docs` step to preserve content

## Execution

### Execution Flow

```
┌──────────────────────────────────────────┐
│ Planning Phase                           │
│ /workflow:docs [path] [--tool]          │
└───────────────┬──────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────┐
│ Level 1: Module Trees (Parallel)         │
│ /workflow:execute IMPL-001                │
│ /workflow:execute IMPL-002                │
│ /workflow:execute IMPL-003                │
└───────────────┬───────────────────────────┘
                │ (all complete)
                ↓
┌───────────────────────────────────────────┐
│ Level 2: Project README (Sequential)     │ (Only if root)
│ /workflow:execute IMPL-004                │
└───────────────┬───────────────────────────┘
                │ (complete)
                ↓
┌───────────────────────────────────────────┐
│ Level 3: Architecture & Examples          │ (Only if root)
│ /workflow:execute IMPL-005                │
│ /workflow:execute IMPL-006                │
│ /workflow:execute IMPL-007 (optional)     │
└───────────────────────────────────────────┘
```

### Command Examples

**Root Directory (Full Documentation)**:
```bash
# Level 1 - Module documentation (parallel)
/workflow:execute IMPL-001
/workflow:execute IMPL-002
/workflow:execute IMPL-003

# Level 2 - Project README (after Level 1)
/workflow:execute IMPL-004

# Level 3 - Architecture & Examples (after Level 2)
/workflow:execute IMPL-005
/workflow:execute IMPL-006
/workflow:execute IMPL-007  # if HTTP API present
```

**Subdirectory (Module Only)**:
```bash
# Only Level 1 task generated
/workflow:execute IMPL-001
```

### Progress Tracking

**TodoWrite Status**:

Planning Phase:
```
✅ Session initialization (completed)
⏳ IMPL-001: Document tree 'src/modules/' (pending)
⏳ IMPL-002: Document tree 'src/utils/' (pending)
⏳ IMPL-003: Document tree 'lib/' (pending)
⏳ IMPL-004: Project README (pending, depends on IMPL-001~003)
⏳ IMPL-005: Architecture Documentation (pending, depends on IMPL-004)
⏳ IMPL-006: Examples Documentation (pending, depends on IMPL-004)
```

Execution Phase:
```
✅ Session initialization
🔄 IMPL-001: Document tree 'src/modules/' (in_progress)
⏳ IMPL-002: Document tree 'src/utils/'
⏳ IMPL-003: Document tree 'lib/'
...
```

## Output

### Session Structure

```
.workflow/
├── .active-WFS-docs-20240120-143022
└── WFS-docs-20240120-143022/
    ├── IMPL_PLAN.md              # Implementation plan
    ├── TODO_LIST.md              # Progress tracker
    ├── .process/
    │   ├── config.txt            # Path, root status, tool, mode
    │   ├── strategy.md           # Doc strategy summary
    │   ├── folder-analysis.txt   # Folder type classification
    │   ├── top-level-dirs.txt    # Top-level directory list
    │   └── existing-docs.txt     # Existing documentation files
    └── .task/
        ├── IMPL-001.json         # Module tree task
        ├── IMPL-002.json         # Module tree task
        ├── IMPL-003.json         # Module tree task
        ├── IMPL-004.json         # Project README (if root)
        ├── IMPL-005.json         # Architecture (if root)
        └── IMPL-006.json         # Examples (if root)
```

### Generated Documentation

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

### IMPL_PLAN.md Format

```markdown
# Documentation Implementation Plan

**Session**: WFS-docs-[timestamp]
**Path**: [target_path]
**Is Root**: [true|false]
**Tool**: [gemini|qwen|codex]
**CLI Generate**: [true|false]
**Mode**: [create|update]
**Strategy**: Bottom-up, layered approach

## CLI Generation Mode

**CLI Generate Flag**: [true|false]

- **false (default)**: CLI tools used for analysis in `pre_analysis`, agent generates docs in `implementation_approach`
- **true**: CLI tools generate documentation files directly in `implementation_approach` with MODE=write

## Task Breakdown

### Level 1: Module Tree Tasks (Always Generated)
- **IMPL-001**: Document tree 'src/modules/'
  - Output: modules/*/{API.md,README.md}
  - Templates: api.txt (Part A), module-readme.txt, folder-navigation.txt
  - Update mode: Preserves existing content
  - CLI placement: [pre_analysis | implementation_approach] based on cli_generate flag

### Level 2: Project README (Only if is_root=true)
- **IMPL-004**: Generate Project README
  - Output: README.md
  - Template: project-readme.txt
  - Dependencies: IMPL-001, IMPL-002, IMPL-003
  - CLI placement: [pre_analysis | implementation_approach] based on cli_generate flag

### Level 3: Architecture & Examples (Only if is_root=true)
- **IMPL-005**: Generate Architecture Documentation
- **IMPL-006**: Generate Examples Documentation
- **IMPL-007**: Generate HTTP API Documentation (Optional)
- CLI placement: [pre_analysis | implementation_approach] based on cli_generate flag

## Execution Order
1. Level 1 (Parallel): IMPL-001, IMPL-002, IMPL-003
2. Level 2 (After Level 1): IMPL-004 (if root)
3. Level 3 (After Level 2): IMPL-005, IMPL-006, IMPL-007 (if root)
```

## Reference

### Task JSON Templates

#### 1. Module Tree Task (Level 1)

**Default Mode (--cli-generate not specified)**:
```json
{
  "id": "IMPL-001",
  "title": "Document Module Tree: 'src/modules/'",
  "status": "pending",
  "meta": {
    "type": "docs-tree",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "api + module-readme + folder-navigation",
    "cli_generate": false
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
      "Documents follow their respective templates"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(find src/modules -name 'API.md' -o -name 'README.md' 2>/dev/null | xargs cat 2>/dev/null || echo 'No existing docs')",
        "output_to": "existing_module_docs",
        "note": "Update mode: preserve existing content"
      },
      {
        "step": "load_folder_analysis",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders"
      },
      {
        "step": "analyze_module_tree_content",
        "command": "bash(cd src/modules && ~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document module tree\\nTASK: Analyze module structure and generate documentation outline\\nMODE: analysis\\nCONTEXT: @{**/*} [target_folders] [existing_module_docs]\\nEXPECTED: Documentation content outline\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api.txt) | Analyze structure only\")",
        "output_to": "tree_documentation",
        "note": "CLI for analysis only, agent generates final docs"
      }
    ],
    "implementation_approach": {
      "logic_flow": [
        "Parse [target_folders] to get list of folders and their types",
        "Parse [tree_documentation] for structure outline",
        "For each folder in tree:",
        "  if type == 'code': Generate API.md + README.md using [tree_documentation]",
        "  elif type == 'navigation': Generate README.md only"
      ]
    },
    "target_files": [
      ".workflow/docs/modules/*/API.md",
      ".workflow/docs/modules/*/README.md"
    ]
  }
}
```

**CLI Generate Mode (--cli-generate specified)**:
```json
{
  "id": "IMPL-001",
  "title": "Document Module Tree: 'src/modules/'",
  "status": "pending",
  "meta": {
    "type": "docs-tree",
    "agent": "@doc-generator",
    "tool": "gemini",
    "template": "api + module-readme + folder-navigation",
    "cli_generate": true
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
      "Documents follow their respective templates"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_docs",
        "command": "bash(find src/modules -name 'API.md' -o -name 'README.md' 2>/dev/null | xargs cat 2>/dev/null || echo 'No existing docs')",
        "output_to": "existing_module_docs",
        "note": "Update mode: preserve existing content"
      },
      {
        "step": "load_folder_analysis",
        "command": "bash(grep '^src/modules' ${session_dir}/.process/folder-analysis.txt)",
        "output_to": "target_folders"
      }
    ],
    "implementation_approach": {
      "logic_flow": [
        "Parse [target_folders] to get list of folders and their types",
        "For each folder in tree:",
        "  if type == 'code': Call CLI to generate API.md + README.md",
        "  elif type == 'navigation': Call CLI to generate README.md only"
      ],
      "cli_generation": [
        {
          "step": "generate_module_tree_docs",
          "command": "bash(cd src/modules && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p \"PURPOSE: Document module tree\\nTASK: Generate complete documentation files for each folder\\nMODE: write\\nCONTEXT: @{**/*} [target_folders] [existing_module_docs]\\nEXPECTED: Generated API.md and README.md files\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api.txt) | Update existing docs, preserve modifications\")",
          "output_to": "generated_docs",
          "note": "CLI generates documentation files with MODE=write"
        }
      ]
    },
    "target_files": [
      ".workflow/docs/modules/*/API.md",
      ".workflow/docs/modules/*/README.md"
    ]
  }
}
```

#### 2. Project README Task (Level 2)

**Note**: Like Level 1 tasks, this task also has two modes based on `--cli-generate` flag:
- **Default mode**: CLI analysis in `pre_analysis`, agent generates docs
- **CLI generate mode**: CLI generation in `implementation_approach` with MODE=write

**Default Mode Example**:
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
      "Generate navigation links to all modules"
    ],
    "focus_paths": ["."]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_project_readme",
        "command": "bash(cat .workflow/docs/README.md 2>/dev/null || echo 'No existing README')",
        "output_to": "existing_readme"
      },
      {
        "step": "load_all_module_docs",
        "command": "bash(find .workflow/docs/modules -name 'README.md' -o -name 'API.md' | xargs cat)",
        "output_to": "all_module_docs"
      },
      {
        "step": "analyze_project_structure",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Generate project overview\\nTASK: Extract project structure from module docs\\nMODE: analysis\\nCONTEXT: [all_module_docs] [existing_readme]\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-readme.txt) | Preserve user modifications\")",
        "output_to": "project_overview"
      }
    ],
    "target_files": [".workflow/docs/README.md"]
  }
}
```

#### 3. Architecture Documentation Task (Level 3)

**Note**: Level 3 tasks also support both modes based on `--cli-generate` flag.

**Default Mode Example**:
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
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_architecture",
        "command": "bash(cat .workflow/docs/ARCHITECTURE.md 2>/dev/null || echo 'No existing ARCHITECTURE')",
        "output_to": "existing_architecture"
      },
      {
        "step": "load_all_docs",
        "command": "bash(cat .workflow/docs/README.md && find .workflow/docs/modules -name '*.md' | xargs cat)",
        "output_to": "all_docs"
      },
      {
        "step": "synthesize_architecture",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Synthesize architecture\\nCONTEXT: [all_docs] [existing_architecture]\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-architecture.txt)\")",
        "output_to": "architecture_content"
      }
    ],
    "target_files": [".workflow/docs/ARCHITECTURE.md"]
  }
}
```

#### 4. Examples Documentation Task (Level 3)

**Note**: Same dual-mode support as other tasks.

**Default Mode Example**:
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
        "step": "generate_examples_content",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Generate usage examples\\nCONTEXT: [project_readme] [existing_examples]\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/project-examples.txt)\")",
        "output_to": "examples_content"
      }
    ],
    "target_files": [".workflow/docs/EXAMPLES.md"]
  }
}
```

#### 5. HTTP API Documentation Task (Level 3, Optional)

**Note**: Same dual-mode support as other tasks.

**Default Mode Example**:
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
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_existing_api_docs",
        "command": "bash(cat .workflow/docs/api/README.md 2>/dev/null || echo 'No existing API docs')",
        "output_to": "existing_api_docs"
      },
      {
        "step": "discover_api_endpoints",
        "command": "mcp__code-index__search_code_advanced(pattern='router\\.|@(Get|Post)', file_pattern='*.{ts,js}')",
        "output_to": "endpoint_discovery"
      },
      {
        "step": "analyze_api_structure",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Document HTTP API\\nCONTEXT: @{src/api/**/*} [existing_api_docs]\\nRULES: $(cat ~/.claude/workflows/cli-templates/prompts/documentation/api.txt) | Use Part B: HTTP API\")",
        "output_to": "api_analysis"
      }
    ],
    "target_files": [".workflow/docs/api/README.md"]
  }
}
```

### Template Reference

**5 Specialized Templates**:
- **api.txt**: Unified template for Code API (Part A) and HTTP API (Part B)
- **module-readme.txt**: Module purpose, usage, dependencies
- **folder-navigation.txt**: Navigation README for folders with only subdirectories
- **project-readme.txt**: Project overview, getting started, module navigation
- **project-architecture.txt**: System structure, module map, design patterns
- **project-examples.txt**: End-to-end usage examples

### Error Handling

- **No modules found**: Create only IMPL-001 (system overview)
- **Invalid path**: Show error and exit
- **Active session exists**: Prompt to complete or pause
- **Tool unavailable**: Fall back to gemini

### Next Steps

```bash
# 1. Review planning output
cat .workflow/WFS-docs-*/IMPL_PLAN.md
cat .workflow/WFS-docs-*/TODO_LIST.md

# 2. Execute tasks (respects dependencies)
/workflow:execute IMPL-001
/workflow:execute IMPL-002
/workflow:execute IMPL-003
# ... then Level 2 and 3 if root

# 3. Review generated documentation
ls -lah .workflow/docs/
cat .workflow/docs/README.md
```
