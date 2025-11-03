---
name: docs
description: Documentation planning and orchestration - creates structured documentation tasks for execution
argument-hint: "[path] [--tool <gemini|qwen|codex>] [--mode <full|partial>] [--cli-execute]"
---

# Documentation Workflow (/memory:docs)

## Overview
Lightweight planner that analyzes project structure, decomposes documentation work into tasks, and generates execution plans. Does NOT generate documentation content itself - delegates to doc-generator agent.

**Execution Strategy**:
- **Batch Processing**: Single Level 1 task handles all module trees
- **Pre-computed Analysis**: Phase 2 performs unified analysis once, stored in `.process/` for reuse
- **Efficient Data Loading**: All existing docs loaded once in Phase 2, shared across tasks

**Documentation Output**: All generated documentation is placed in `.workflow/docs/{project_name}/` directory with **mirrored project structure**. For example:
- Project: `my_app`
- Source: `my_app/src/core/` → Docs: `.workflow/docs/my_app/src/core/API.md`
- Source: `my_app/src/modules/auth/` → Docs: `.workflow/docs/my_app/src/modules/auth/API.md`

**Two Execution Modes**:
- **Default (Agent Mode)**: CLI analyzes in `pre_analysis` (MODE=analysis), agent writes docs in `implementation_approach`
- **--cli-execute (CLI Mode)**: CLI generates docs in `implementation_approach` (MODE=write), agent executes CLI commands

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
/memory:docs [path] [--tool <gemini|qwen|codex>] [--mode <full|partial>] [--cli-execute]
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

- **--cli-execute**: Enable CLI-based documentation generation (optional)
  - When enabled: CLI generates docs with MODE=write in implementation_approach, agent executes CLI commands
  - When disabled (default): CLI analyzes with MODE=analysis in pre_analysis, agent generates documentation content

## Planning Workflow

### Phase 1: Initialize Session

#### Step 1: Get Target Path and Project Name
```bash
# Get current directory as target path
bash(pwd)

# Get project name from current directory
bash(basename "$(pwd)")

# Get project root from git
bash(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Generate timestamp for session ID
bash(date +%Y%m%d-%H%M%S)
```

**Output**:
- `target_path`: `/d/Claude_dms3`
- `project_name`: `Claude_dms3`
- `project_root`: `/d/Claude_dms3`
- `timestamp`: `20240120-143022`

#### Step 2: Create Session Structure
```bash
# Create session directories (replace timestamp with actual value)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.task)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.process)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.summaries)

# Mark session as active
bash(touch .workflow/.active-WFS-docs-20240120-143022)
```

#### Step 3: Create Workflow Session Metadata
```bash
# Create workflow-session.json in session root (replace values with actual data)
bash(echo '{"session_id":"WFS-docs-20240120-143022","project":"Claude_dms3 documentation","status":"planning","timestamp":"2024-01-20T14:30:22+08:00","path":".","target_path":"/d/Claude_dms3","project_root":"/d/Claude_dms3","project_name":"Claude_dms3","mode":"full","tool":"gemini","cli_execute":false}' | jq '.' > .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**:
```
✓ Session initialized: WFS-docs-20240120-143022
✓ Target: /d/Claude_dms3
✓ Mode: full
✓ Tool: gemini, CLI execute: false
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
# Extract first path component from each line
bash(cat .workflow/WFS-docs-20240120-143022/.process/folder-analysis.txt | cut -d'|' -f1 | sed 's|^\./||' | grep -v '^$' > .workflow/WFS-docs-20240120-143022/.process/all-paths.txt)

# Get first two path levels (e.g., src/modules)
bash(cat .workflow/WFS-docs-20240120-143022/.process/all-paths.txt | cut -d'/' -f1-2 | sort -u > .workflow/WFS-docs-20240120-143022/.process/top-level-dirs.txt)
```

**Output** (top-level-dirs.txt):
```
src/modules
src/utils
lib/core
```

#### Step 3: Load All Existing Documentation (One-time Read)
```bash
# Read project name first
bash(jq -r '.project_name' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**: `Claude_dms3`

```bash
# Load ALL existing module docs at once (replace project_name)
bash(find .workflow/docs/Claude_dms3 -type f -name '*.md' ! -path '*/README.md' ! -path '*/ARCHITECTURE.md' ! -path '*/EXAMPLES.md' ! -path '*/api/*' 2>/dev/null | xargs cat > .workflow/WFS-docs-20240120-143022/.process/all-existing-module-docs.txt 2>/dev/null || echo "No existing docs" > .workflow/WFS-docs-20240120-143022/.process/all-existing-module-docs.txt)

# Count existing module docs
bash(find .workflow/docs/Claude_dms3 -type f -name '*.md' ! -path '*/README.md' ! -path '*/ARCHITECTURE.md' ! -path '*/EXAMPLES.md' ! -path '*/api/*' 2>/dev/null | wc -l || echo 0)
```

**Output**: `8` (existing module docs) or `0` (no docs)

#### Step 4: Unified Module Analysis (CLI - One-time Call)
```bash
# Get tool from workflow session
bash(jq -r '.tool' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**: `gemini`

```bash
# Unified analysis for ALL modules (replace tool)
bash(gemini -p "
PURPOSE: Analyze all module structures for documentation planning
TASK:
• Parse folder-analysis.txt to identify all modules
• For each module, generate documentation outline
• Output structured analysis for all modules
MODE: analysis
CONTEXT: @.workflow/WFS-docs-20240120-143022/.process/folder-analysis.txt @.workflow/WFS-docs-20240120-143022/.process/all-existing-module-docs.txt
EXPECTED: Structured analysis with module paths and outlines
RULES: Output format: MODULE_PATH|outline_summary, one per line
" > .workflow/WFS-docs-20240120-143022/.process/unified-module-analysis.txt)
```

**Output** (unified-module-analysis.txt):
```
src/modules|auth module with 3 handlers, api module with 2 routes
src/utils|helper functions for validation and formatting
lib/core|core interfaces and base classes
```

#### Step 5: Generate Analysis Summary
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

# Update workflow-session.json with statistics
bash(jq '. + {analysis: {total: "15", code: "8", navigation: "7", top_level: "3"}}' .workflow/WFS-docs-20240120-143022/workflow-session.json > .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp && mv .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

### Phase 3: Detect Update Mode

#### Step 1: Get Project Name from Workflow Session
```bash
# Read project name from workflow-session.json
bash(jq -r '.project_name' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**: `Claude_dms3`

#### Step 2: Count Existing Documentation
```bash
# Count existing docs (replace project_name with actual value)
bash(find .workflow/docs/Claude_dms3 -name "*.md" 2>/dev/null | wc -l || echo 0)
```

**Output**: `5` (existing docs) or `0` (no docs)

#### Step 3: List Existing Documentation Files
```bash
# List existing docs to file (replace project_name and session)
bash(find .workflow/docs/Claude_dms3 -name "*.md" 2>/dev/null > .workflow/WFS-docs-20240120-143022/.process/existing-docs.txt || touch .workflow/WFS-docs-20240120-143022/.process/existing-docs.txt)

# Display existing docs
bash(cat .workflow/WFS-docs-20240120-143022/.process/existing-docs.txt)
```

**Output** (existing-docs.txt):
```
.workflow/docs/Claude_dms3/src/modules/auth/API.md
.workflow/docs/Claude_dms3/src/modules/auth/README.md
.workflow/docs/Claude_dms3/lib/core/README.md
.workflow/docs/Claude_dms3/README.md
```

#### Step 4: Update Workflow Session with Update Status
```bash
# If existing_count > 0, update with "update" mode (replace session and count)
bash(jq '. + {update_mode: "update", existing_docs: 5}' .workflow/WFS-docs-20240120-143022/workflow-session.json > .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp && mv .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp .workflow/WFS-docs-20240120-143022/workflow-session.json)

# Or if existing_count = 0, use "create" mode
bash(jq '. + {update_mode: "create", existing_docs: 0}' .workflow/WFS-docs-20240120-143022/workflow-session.json > .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp && mv .workflow/WFS-docs-20240120-143022/workflow-session.json.tmp .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

#### Step 5: Display Strategy Summary
```bash
# Read session metadata
bash(jq -r '.mode' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.update_mode' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.existing_docs' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.tool' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.cli_execute' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.target_path' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

### Phase 4: Decompose Tasks

#### Task Hierarchy
```
Level 1: Module Trees (always, single batch task)
  └─ IMPL-001: Document All Module Trees (batch processing)
      Includes: src/modules/, src/utils/, lib/, etc.

Level 2: Project README (mode=full only, depends on Level 1)
  └─ IMPL-002: Generate Project README

Level 3: Architecture & Examples (mode=full only, depends on Level 2)
  ├─ IMPL-003: Generate ARCHITECTURE.md + EXAMPLES.md
  └─ IMPL-004: Generate HTTP API (optional)
```

**Execution Model**: Single Level 1 task handles all module trees in batch for efficient processing.

#### Step 1: Read Top-Level Directories
```bash
# Read top-level directories list
bash(cat .workflow/WFS-docs-20240120-143022/.process/top-level-dirs.txt)
```

**Output**:
```
src/modules
src/utils
lib
```

#### Step 2: Count Directories (for reporting only)
```bash
# Count directories to document
bash(wc -l < .workflow/WFS-docs-20240120-143022/.process/top-level-dirs.txt)
```

**Output**: `3` directories (all handled by IMPL-001)

#### Step 3: Check Documentation Mode
```bash
# Check if full or partial mode
bash(jq -r '.mode' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**: `full` or `partial`

#### Step 4: Check for HTTP API Endpoints (Optional)
```bash
# Search for API endpoint patterns
bash(grep -r "router\.|@Get\|@Post" src/ 2>/dev/null && echo "API_FOUND" || echo "NO_API")
```

**Output**: `API_FOUND` or `NO_API`

**Task Generation Summary**:
- **Partial mode**: Generate only IMPL-001 (all module trees in batch)
- **Full mode without API**: Generate IMPL-001, IMPL-002, IMPL-003
- **Full mode with API**: Generate IMPL-001, IMPL-002, IMPL-003, IMPL-004

### Phase 5: Generate Task JSONs

#### Step 1: Read Configuration Values
```bash
# Read tool selection
bash(jq -r '.tool' .workflow/WFS-docs-20240120-143022/workflow-session.json)

# Read cli_execute flag
bash(jq -r '.cli_execute' .workflow/WFS-docs-20240120-143022/workflow-session.json)

# Read mode
bash(jq -r '.mode' .workflow/WFS-docs-20240120-143022/workflow-session.json)
```

**Output**:
- `tool`: `gemini`
- `cli_execute`: `false`
- `mode`: `full`

#### Step 2: Determine CLI Strategy

**If cli_execute = false (Agent Mode)**:
- MODE: `analysis`
- Placement: `pre_analysis`
- Approval flag: (none)
- Command pattern: `cd dir && gemini -p "..."`
- Agent role: Generate documentation content in implementation_approach

**If cli_execute = true (CLI Mode)**:
- MODE: `write`
- Placement: `implementation_approach`
- Approval flag: `--approval-mode yolo`
- Command pattern: `cd dir && gemini --approval-mode yolo -p "..."`
- Agent role: Execute CLI commands, validate output

**If tool = codex**:
- Command pattern: `codex -C dir --full-auto exec "..." --skip-git-repo-check -s danger-full-access`

#### Step 3: Generate Task JSON Files

Tasks are generated based on:
- Top-level directories from Phase 4
- Configuration from workflow-session.json
- Task templates (see Task Templates section below)

Each task JSON is written to `.workflow/WFS-docs-20240120-143022/.task/IMPL-XXX.json`

## Task Templates

### Level 1: Batch Module Trees Task

**Path Mapping**:
- Project: `{project_name}` (extracted from target_path)
- Sources: Multiple directories from `top-level-dirs.txt`
- Output: `.workflow/docs/{project_name}/` (mirrored structure)

**Execution Model**: Single task processes all module trees by reading pre-analyzed data from Phase 2.

**Agent Mode (cli_execute=false)**:
```json
{
  "id": "IMPL-001",
  "title": "Document All Module Trees (Batch)",
  "status": "pending",
  "meta": {
    "type": "docs-tree-batch",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_execute": false
  },
  "context": {
    "requirements": [
      "Process all top-level directories from ${session_dir}/.process/top-level-dirs.txt",
      "Generate docs to .workflow/docs/${project_name}/ (mirrored structure)",
      "For code folders: generate API.md + README.md",
      "For navigation folders: generate README.md only",
      "Use pre-analyzed data from Phase 2 (no redundant analysis)"
    ],
    "focus_paths": ["${top_level_dirs_from_file}"],
    "precomputed_data": {
      "folder_analysis": "${session_dir}/.process/folder-analysis.txt",
      "existing_docs": "${session_dir}/.process/all-existing-module-docs.txt",
      "unified_analysis": "${session_dir}/.process/unified-module-analysis.txt",
      "top_level_dirs": "${session_dir}/.process/top-level-dirs.txt"
    }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_precomputed_data",
        "action": "Load all pre-analyzed data from Phase 2",
        "commands": [
          "bash(cat ${session_dir}/.process/folder-analysis.txt)",
          "bash(cat ${session_dir}/.process/all-existing-module-docs.txt)",
          "bash(cat ${session_dir}/.process/unified-module-analysis.txt)",
          "bash(cat ${session_dir}/.process/top-level-dirs.txt)"
        ],
        "output_to": "precomputed_context",
        "note": "No redundant file reads - use Phase 2 results"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate documentation for all module trees",
        "description": "Batch process all top-level directories using pre-analyzed data",
        "modification_points": [
          "Read top-level directories from [precomputed_context]",
          "For each directory in list:",
          "  - Parse folder types from folder-analysis.txt",
          "  - Parse structure from unified-module-analysis.txt",
          "  - Map source_path to .workflow/docs/${project_name}/{source_path}",
          "  - Generate API.md for code folders",
          "  - Generate README.md for all folders",
          "Use existing docs from all-existing-module-docs.txt to preserve user modifications"
        ],
        "logic_flow": [
          "dirs = parse([precomputed_context].top_level_dirs)",
          "for dir in dirs:",
          "  folder_info = grep(dir, [precomputed_context].folder_analysis)",
          "  outline = grep(dir, [precomputed_context].unified_analysis)",
          "  if folder_info.type == 'code':",
          "    generate API.md + README.md",
          "  elif folder_info.type == 'navigation':",
          "    generate README.md only",
          "  write to .workflow/docs/${project_name}/{dir}/"
        ],
        "depends_on": [],
        "output": "all_module_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/*/API.md",
      ".workflow/docs/${project_name}/*/README.md"
    ]
  }
}
```

**CLI Execute Mode (cli_execute=true)**:
```json
{
  "id": "IMPL-001",
  "title": "Document All Module Trees (Batch)",
  "status": "pending",
  "meta": {
    "type": "docs-tree-batch",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_execute": true
  },
  "context": {
    "requirements": [
      "Process all top-level directories from ${session_dir}/.process/top-level-dirs.txt",
      "CLI generates documentation files directly to .workflow/docs/${project_name}/ (mirrored structure)",
      "Use pre-analyzed data from Phase 2 (no redundant analysis)"
    ],
    "focus_paths": ["${top_level_dirs_from_file}"],
    "precomputed_data": {
      "folder_analysis": "${session_dir}/.process/folder-analysis.txt",
      "existing_docs": "${session_dir}/.process/all-existing-module-docs.txt",
      "unified_analysis": "${session_dir}/.process/unified-module-analysis.txt",
      "top_level_dirs": "${session_dir}/.process/top-level-dirs.txt"
    }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_precomputed_data",
        "action": "Load pre-analyzed data from Phase 2",
        "commands": [
          "bash(cat ${session_dir}/.process/folder-analysis.txt)",
          "bash(cat ${session_dir}/.process/all-existing-module-docs.txt)",
          "bash(cat ${session_dir}/.process/unified-module-analysis.txt)",
          "bash(cat ${session_dir}/.process/top-level-dirs.txt)"
        ],
        "output_to": "precomputed_context",
        "note": "No redundant file reads - use Phase 2 results"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Parse directories and prepare batch",
        "description": "Read top-level directories and prepare for CLI batch execution",
        "modification_points": ["Extract directory list", "Prepare CLI command parameters"],
        "logic_flow": ["dirs = parse([precomputed_context].top_level_dirs)", "Prepare batch CLI execution"],
        "depends_on": [],
        "output": "batch_params"
      },
      {
        "step": 2,
        "title": "Batch generate documentation via CLI",
        "description": "Execute CLI commands for all directories in batch",
        "modification_points": [
          "For each directory, call CLI with MODE=write",
          "CLI generates files to .workflow/docs/${project_name}/ (mirrored paths)",
          "Use precomputed context to avoid redundant analysis"
        ],
        "logic_flow": [
          "for dir in [batch_params].dirs:",
          "  cd ${dir}",
          "  gemini --approval-mode yolo -p 'PURPOSE: Generate module docs, TASK: Create documentation, MODE: write, CONTEXT: @**/* [precomputed_context], EXPECTED: API.md and README.md, RULES: Mirror structure'",
          "  Validate generated files"
        ],
        "command": "bash(while IFS= read -r dir; do cd \"$dir\" && gemini --approval-mode yolo -p \"PURPOSE: Generate module docs\\nTASK: Create documentation files in .workflow/docs/${project_name}/$dir/\\nMODE: write\\nCONTEXT: @**/* [precomputed_context]\\nEXPECTED: API.md and README.md in mirrored structure\\nRULES: Mirror source structure, preserve existing docs\" || echo \"Failed: $dir\"; cd -; done < ${session_dir}/.process/top-level-dirs.txt)",
        "depends_on": [1],
        "output": "generated_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/*/API.md",
      ".workflow/docs/${project_name}/*/README.md"
    ]
  }
}
```

### Level 2: Project README Task

**Agent Mode**:
```json
{
  "id": "IMPL-002",
  "title": "Generate Project README",
  "status": "pending",
  "depends_on": ["IMPL-001"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_execute": false
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

**Agent Mode**:
```json
{
  "id": "IMPL-003",
  "title": "Generate Architecture & Examples Documentation",
  "status": "pending",
  "depends_on": ["IMPL-002"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_execute": false
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

**Agent Mode**:
```json
{
  "id": "IMPL-004",
  "title": "Generate HTTP API Documentation",
  "status": "pending",
  "depends_on": ["IMPL-002"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini",
    "cli_execute": false
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "discover_api_endpoints",
        "command": "bash(rg 'router\\.| @(Get|Post)' -g '*.{ts,js}')",
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
    ├── workflow-session.json                # Session metadata (all settings + stats)
    ├── IMPL_PLAN.md                         # Implementation plan
    ├── TODO_LIST.md                         # Progress tracker
    ├── .process/                            # Pre-analyzed data (Phase 2)
    │   ├── folder-analysis.txt              # Folder classification results
    │   ├── top-level-dirs.txt               # Top-level directory list
    │   ├── all-paths.txt                    # All folder paths
    │   ├── all-existing-module-docs.txt     # All existing module docs (loaded once)
    │   ├── unified-module-analysis.txt      # Unified analysis for all modules
    │   └── existing-docs.txt                # Existing documentation paths
    └── .task/                               # Task JSON files
        ├── IMPL-001.json                    # Batch module trees task (all directories)
        ├── IMPL-002.json                    # Project README (full mode)
        ├── IMPL-003.json                    # ARCHITECTURE.md + EXAMPLES.md (full mode)
        └── IMPL-004.json                    # HTTP API docs (optional)
```

**Workflow Session Structure** (workflow-session.json):
```json
{
  "session_id": "WFS-docs-20240120-143022",
  "project": "my_app documentation",
  "status": "planning",
  "timestamp": "2024-01-20T14:30:22+08:00",
  "path": ".",
  "target_path": "/home/user/projects/my_app",
  "project_root": "/home/user/projects",
  "project_name": "my_app",
  "mode": "full",
  "tool": "gemini",
  "cli_execute": false,
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
# Generate timestamp
bash(date +%Y%m%d-%H%M%S)

# Create session directories (replace timestamp)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.task)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.process)
bash(mkdir -p .workflow/WFS-docs-20240120-143022/.summaries)

# Mark as active
bash(touch .workflow/.active-WFS-docs-20240120-143022)

# Get project name
bash(basename "$(pwd)")

# Create workflow-session.json (replace values)
bash(echo '{"session_id":"WFS-docs-20240120-143022","project":"project documentation","status":"planning","timestamp":"2024-01-20T14:30:22+08:00","path":".","target_path":"/d/project","project_root":"/d/project","project_name":"project","mode":"full","tool":"gemini","cli_execute":false}' | jq '.' > .workflow/WFS-docs-20240120-143022/workflow-session.json)

# Read workflow session metadata
bash(cat .workflow/WFS-docs-20240120-143022/workflow-session.json)

# Extract session values
bash(jq -r '.tool' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.mode' .workflow/WFS-docs-20240120-143022/workflow-session.json)
bash(jq -r '.project_name' .workflow/WFS-docs-20240120-143022/workflow-session.json)

# List session tasks
bash(ls .workflow/WFS-docs-20240120-143022/.task/*.json)
```

### Analysis Commands
```bash
# Discover and classify folders
bash(~/.claude/scripts/get_modules_by_depth.sh | ~/.claude/scripts/classify-folders.sh > .workflow/WFS-docs-20240120-143022/.process/folder-analysis.txt)

# Count existing docs (replace project_name)
bash(find .workflow/docs/my_project -name "*.md" 2>/dev/null | wc -l || echo 0)

# List existing documentation (replace project_name)
bash(find .workflow/docs/my_project -name "*.md" 2>/dev/null || echo "No docs found")

# Check if docs directory exists
bash(test -d .workflow/docs/my_project && echo "exists" || echo "not exists")
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

## Execution Mode Summary

| Mode | CLI Placement | CLI MODE | Agent Role |
|------|---------------|----------|------------|
| **Agent Mode (default)** | pre_analysis (Phase 2) | analysis | Generates documentation files based on pre-analyzed data |
| **CLI Mode (--cli-execute)** | implementation_approach | write | Executes CLI commands to generate docs, validates output |

**Execution Flow**:
- **Phase 2**: Unified analysis performed once, results stored in `.process/`
- **IMPL-001**: Batch processing for all module trees using pre-analyzed data
- **IMPL-002+**: Sequential execution for project-level documentation

## Related Commands
- `/workflow:execute` - Execute documentation tasks
- `/workflow:status` - View task progress
- `/workflow:session:complete` - Mark session complete
