---
name: skill-memory
description: Generate progressive project SKILL package from source code with embedded documentation generation
argument-hint: "[path] [--tool <gemini|qwen>] [--regenerate]"
---

# Memory SKILL Package Generator

## Overview

Analyzes project structure, generates documentation (if needed), and creates reusable SKILL package with **path-mirrored knowledge structure**. Embeds documentation generation logic internally instead of calling external commands.

**SKILL Package Output**: Knowledge files mirror source structure under `.claude/skills/{project_name}/knowledge/`

**Documentation Source**: All docs generated to `.workflow/docs/{project_name}/` with mirrored structure

## Path Mirroring Strategy

**Principle**: SKILL knowledge structure **mirrors** source code structure.

| Source Path | Project | SKILL Knowledge Path |
|------------|---------|---------------------|
| `my_app/src/modules/auth/` | `my_app` | `.claude/skills/my_app/knowledge/src/modules/auth/API.md` |
| `my_app/lib/core/` | `my_app` | `.claude/skills/my_app/knowledge/lib/core/README.md` |

**Benefits**:
- Easy to locate SKILL docs for any source file
- Maintains logical organization matching codebase
- Clear 1:1 mapping between code and knowledge
- Supports any project structure (src/, lib/, packages/, etc.)

## Core Concept

**SKILL Package** = SKILL.md entry + OVERVIEW.md (index) + Path-mirrored knowledge docs

```
.claude/skills/{project}/
├── SKILL.md                    # Entry point with progressive references
└── knowledge/
    ├── OVERVIEW.md             # Project overview + quickstart + module index (merged)
    └── [mirrored source structure]
        ├── src/
        │   ├── modules/
        │   │   ├── auth/
        │   │   │   ├── API.md
        │   │   │   └── README.md
        │   │   └── api/
        │   │       ├── API.md
        │   │       └── README.md
        │   └── utils/
        │       └── README.md
        └── lib/
            └── core/
                ├── API.md
                └── README.md
```

## Parameters

```bash
/memory:skill-memory [path] [--tool <gemini|qwen>] [--regenerate]
```

- **path**: Target directory (default: current directory)
  - Specifies the directory to generate SKILL package for

- **--tool**: CLI tool selection (default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition
  - `qwen`: Architecture analysis, system design focus

- **--regenerate**: Force regenerate documentation from source code (optional)
  - When enabled: Regenerates all documentation from source
  - When disabled: Uses existing docs from `.workflow/docs/{project}` if available

## Planning Workflow

### Phase 1: Initialize Session

#### Step 1: Create Session Structure
```bash
# Parse arguments and create unified workflow session
bash(
  path="${1:-.}"
  tool="gemini"
  regenerate=false
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="$2"; shift 2 ;;
      --regenerate) regenerate=true; shift ;;
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

  # Create session (following workflow-architecture.md)
  timestamp=$(date +%Y%m%d-%H%M%S)
  session="WFS-skill-${timestamp}"

  # Create unified workflow structure
  mkdir -p ".workflow/${session}"/{.task,.process}
  touch ".workflow/.active-${session}"

  # Generate workflow-session.json (unified session state)
  cat > ".workflow/${session}/workflow-session.json" <<EOF
{
  "session_id": "${session}",
  "project": "Generate SKILL package for ${project_name}",
  "type": "simple",
  "current_phase": "PLAN",
  "status": "active",
  "created": "$(date -Iseconds)",
  "config": {
    "project_name": "${project_name}",
    "target_path": "${target_path}",
    "project_root": "${project_root}",
    "tool": "${tool}",
    "regenerate": ${regenerate},
    "docs_path": ".workflow/docs/${project_name}",
    "skill_path": ".claude/skills/${project_name}"
  },
  "progress": {
    "completed_phases": [],
    "current_tasks": []
  }
}
EOF

  # Create required documents
  cat > ".workflow/${session}/IMPL_PLAN.md" <<'PLANEOF'
# SKILL Package Generation Plan

## Objective
Analyze project structure, generate/verify documentation, and create progressive SKILL package.

## Approach
1. Analyze project structure (modules, directories)
2. Generate/verify documentation in .workflow/docs/
3. Generate SKILL.md entry point
4. Create OVERVIEW.md (merged index)
5. Mirror documentation to .claude/skills/{project}/knowledge/
PLANEOF

  cat > ".workflow/${session}/TODO_LIST.md" <<'TODOEOF'
# Task Checklist

- [ ] IMPL-001: Generate/verify documentation
- [ ] IMPL-002: Generate SKILL.md entry point
- [ ] IMPL-003: Generate OVERVIEW.md
- [ ] IMPL-004: Mirror docs to SKILL knowledge/
TODOEOF

  echo "✓ Session initialized: ${session}"
  echo "✓ Project: ${project_name}"
  echo "✓ Target: ${target_path}"
  echo "✓ Tool: ${tool}, Regenerate: ${regenerate}"
)
```

**Output**:
```
✓ Session initialized: WFS-skill-20250103-143022
✓ Project: my_app
✓ Target: /d/my_app
✓ Tool: gemini, Regenerate: false
```

### Phase 2: Analyze Structure

#### Step 1: Discover and Classify Folders
```bash
# Run analysis pipeline (module discovery + folder classification)
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')
  target_path=$(jq -r '.config.target_path' .workflow/${session}/workflow-session.json)

  # Discover modules and classify folders
  cd "${target_path}"
  ~/.claude/scripts/get_modules_by_depth.sh | \
    ~/.claude/scripts/classify-folders.sh > \
    .workflow/${session}/.process/folder-analysis.txt

  # Count results
  total=$(wc -l < .workflow/${session}/.process/folder-analysis.txt)
  code_count=$(grep '|code|' .workflow/${session}/.process/folder-analysis.txt | wc -l)
  nav_count=$(grep '|navigation|' .workflow/${session}/.process/folder-analysis.txt | wc -l)

  echo "📊 Folder Analysis Complete:"
  echo "  - Total folders: $total"
  echo "  - Code folders: $code_count (will get API.md + README.md)"
  echo "  - Navigation folders: $nav_count (will get README.md only)"
)
```

**Output** (folder-analysis.txt):
```
./src/modules/auth|code|code:5|dirs:2
./src/modules/api|code|code:3|dirs:0
./src/utils|navigation|code:0|dirs:4
./lib/core|code|code:8|dirs:1
```

#### Step 2: Extract Top-Level Directories
```bash
# Group folders by top-level directory
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')

  awk -F'|' '{
    path = $1
    gsub(/^\.\//, "", path)
    split(path, parts, "/")
    if (length(parts) >= 2) print parts[1] "/" parts[2]
    else if (length(parts) == 1 && parts[1] != ".") print parts[1]
  }' .workflow/${session}/.process/folder-analysis.txt | \
    sort -u > .workflow/${session}/.process/top-level-dirs.txt

  echo "📁 Top-level directories:"
  cat .workflow/${session}/.process/top-level-dirs.txt
)
```

**Output** (top-level-dirs.txt):
```
src/modules
src/utils
lib/core
```

#### Step 3: Update Session with Analysis Statistics
```bash
# Calculate statistics and update workflow-session.json
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')

  total=$(wc -l < .workflow/${session}/.process/folder-analysis.txt)
  code_count=$(grep '|code|' .workflow/${session}/.process/folder-analysis.txt | wc -l)
  nav_count=$(grep '|navigation|' .workflow/${session}/.process/folder-analysis.txt | wc -l)
  top_dirs=$(wc -l < .workflow/${session}/.process/top-level-dirs.txt)

  # Update workflow-session.json with analysis results
  jq ".config.analysis = {
    \"total_folders\": $total,
    \"code_folders\": $code_count,
    \"navigation_folders\": $nav_count,
    \"top_level_dirs\": $top_dirs
  }" .workflow/${session}/workflow-session.json > temp.json && \
    mv temp.json .workflow/${session}/workflow-session.json
)
```

### Phase 3: Check/Generate Documentation

#### Step 1: Check Existing Documentation
```bash
# Check if documentation exists in .workflow/docs/{project_name}/
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')
  docs_path=$(jq -r '.config.docs_path' .workflow/${session}/workflow-session.json)
  regenerate=$(jq -r '.config.regenerate' .workflow/${session}/workflow-session.json)

  if [[ -d "${docs_path}" ]]; then
    doc_count=$(find ${docs_path} -name "*.md" 2>/dev/null | wc -l)
    echo "📄 Found ${doc_count} existing documentation files"

    if [[ "${regenerate}" == "true" ]]; then
      echo "⚠️  --regenerate flag set, will regenerate all documentation"
      needs_generation=true
    else
      echo "✓ Using existing documentation"
      needs_generation=false
    fi
  else
    echo "📄 No existing documentation found, will generate"
    needs_generation=true
  fi

  # Update workflow-session.json
  jq ".config.docs_status = \"$(if [[ ${needs_generation} == true ]]; then echo 'needs_generation'; else echo 'ready'; fi)\" | \
      .config.existing_docs = ${doc_count:-0}" \
    .workflow/${session}/workflow-session.json > temp.json && \
    mv temp.json .workflow/${session}/workflow-session.json

  echo "${needs_generation}"
)
```

**Output**:
```
📄 Found 15 existing documentation files
✓ Using existing documentation
false
```

#### Step 2: Generate Documentation (If Needed)
```bash
# Generate documentation if needed
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')
  needs_generation=$(jq -r '.config.docs_status == "needs_generation"' .workflow/${session}/workflow-session.json)

  if [[ "${needs_generation}" == "true" ]]; then
    echo "🔧 Generating documentation..."

    # Generate task JSON for documentation generation
    # This will be IMPL-001: Generate Documentation
    # See Task Templates section for full JSON structure

    echo "✓ Documentation generation task created (IMPL-001)"
  else
    echo "✓ Skipping documentation generation (using existing docs)"
  fi
)
```

### Phase 4: Generate SKILL Package Tasks

#### Step 1: Determine Task List
```bash
# Determine which tasks to create based on docs_status
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')
  docs_status=$(jq -r '.config.docs_status' .workflow/${session}/workflow-session.json)

  if [[ "${docs_status}" == "needs_generation" ]]; then
    echo "📋 Task list:"
    echo "  - IMPL-001: Generate documentation"
    echo "  - IMPL-002: Generate SKILL.md entry point"
    echo "  - IMPL-003: Generate OVERVIEW.md"
    echo "  - IMPL-004: Mirror docs to SKILL knowledge/"
    task_ids=("IMPL-001" "IMPL-002" "IMPL-003" "IMPL-004")
  else
    echo "📋 Task list (docs exist):"
    echo "  - IMPL-001: Generate SKILL.md entry point"
    echo "  - IMPL-002: Generate OVERVIEW.md"
    echo "  - IMPL-003: Mirror docs to SKILL knowledge/"
    task_ids=("IMPL-001" "IMPL-002" "IMPL-003")
  fi

  # Update workflow-session.json with task list
  task_json=$(printf '%s\n' "${task_ids[@]}" | jq -R . | jq -s .)
  jq ".progress.current_tasks = ${task_json}" \
    .workflow/${session}/workflow-session.json > temp.json && \
    mv temp.json .workflow/${session}/workflow-session.json
)
```

#### Step 2: Generate Task JSONs
```bash
# Generate task JSON files based on docs_status
# See Task Templates section for full JSON structures
bash(
  session=$(ls -t .workflow/.active-* 2>/dev/null | head -1 | sed 's/.*active-//')
  docs_status=$(jq -r '.config.docs_status' .workflow/${session}/workflow-session.json)

  # Create tasks based on docs_status
  # If docs need generation: IMPL-001 (docs) + IMPL-002 (SKILL.md) + IMPL-003 (OVERVIEW) + IMPL-004 (mirror)
  # If docs exist: IMPL-001 (SKILL.md) + IMPL-002 (OVERVIEW) + IMPL-003 (mirror)

  echo "✅ Tasks generated successfully"
)
```

## Task Templates

### Task 1: Generate Documentation (If Needed)

**Condition**: Only created when `docs_status == "needs_generation"`

**Goal**: Generate module and project documentation to .workflow/docs/{project}/ with path mirroring

```json
{
  "id": "IMPL-001",
  "title": "Generate Project Documentation",
  "status": "pending",
  "meta": {
    "type": "docs",
    "agent": "@doc-generator",
    "tool": "gemini"
  },
  "context": {
    "requirements": [
      "Analyze source code structure",
      "Generate module docs (API.md + README.md for code folders, README.md for navigation)",
      "Generate project docs (README.md, ARCHITECTURE.md, EXAMPLES.md)",
      "Output to .workflow/docs/${project_name}/ with mirrored structure"
    ],
    "focus_paths": ["all analyzed folders from folder-analysis.txt"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_session_config",
        "action": "Load session configuration",
        "command": "bash(cat $(ls -t .workflow/.active-* | head -1 | sed 's/.active-//')/workflow-session.json)",
        "output_to": "session_config"
      },
      {
        "step": "load_folder_analysis",
        "action": "Load folder analysis results",
        "command": "bash(session=$(ls -t .workflow/.active-* | head -1 | sed 's/.*active-//'); cat .workflow/${session}/.process/folder-analysis.txt)",
        "output_to": "folder_analysis"
      },
      {
        "step": "load_top_level_dirs",
        "action": "Load top-level directories",
        "command": "bash(session=$(ls -t .workflow/.active-* | head -1 | sed 's/.*active-//'); cat .workflow/${session}/.process/top-level-dirs.txt)",
        "output_to": "top_level_dirs"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate module documentation",
        "description": "For each folder in [folder_analysis], generate docs to .workflow/docs/${project_name}/ with mirrored paths",
        "modification_points": [
          "Parse [folder_analysis] to get folder types",
          "For each code folder: generate API.md + README.md",
          "For each navigation folder: generate README.md only",
          "Mirror source structure to .workflow/docs/${project_name}/"
        ],
        "logic_flow": [
          "Parse [folder_analysis] to extract folders and types",
          "For folder './src/modules/auth|code|...':",
          "  - Create .workflow/docs/${project_name}/src/modules/auth/",
          "  - Generate API.md (public API documentation)",
          "  - Generate README.md (module overview)",
          "For folder './src/utils|navigation|...':",
          "  - Create .workflow/docs/${project_name}/src/utils/",
          "  - Generate README.md (directory guide)"
        ],
        "depends_on": [],
        "output": "module_docs"
      },
      {
        "step": 2,
        "title": "Generate project documentation",
        "description": "Generate README.md, ARCHITECTURE.md, EXAMPLES.md at project root",
        "modification_points": [
          "Synthesize from [module_docs]",
          "Generate README.md (project overview)",
          "Generate ARCHITECTURE.md (system design)",
          "Generate EXAMPLES.md (usage examples)"
        ],
        "logic_flow": [
          "Read all module docs from step 1",
          "Generate .workflow/docs/${project_name}/README.md (overview)",
          "Generate .workflow/docs/${project_name}/ARCHITECTURE.md (design)",
          "Generate .workflow/docs/${project_name}/EXAMPLES.md (examples)"
        ],
        "depends_on": [1],
        "output": "project_docs"
      }
    ],
    "target_files": [
      ".workflow/docs/${project_name}/**/API.md",
      ".workflow/docs/${project_name}/**/README.md",
      ".workflow/docs/${project_name}/ARCHITECTURE.md",
      ".workflow/docs/${project_name}/EXAMPLES.md"
    ]
  }
}
```

### Task 2 (or IMPL-001 if docs exist): Generate SKILL.md Entry Point

**Goal**: Create SKILL.md with YAML frontmatter and progressive references

**Task ID**: IMPL-002 (if docs generated) or IMPL-001 (if docs exist)

```json
{
  "id": "IMPL-002",
  "title": "Generate SKILL.md Entry Point",
  "status": "pending",
  "depends_on": ["IMPL-001"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator"
  },
  "context": {
    "requirements": [
      "Create SKILL.md with YAML frontmatter",
      "Add progressive loading guide",
      "Reference OVERVIEW.md for project overview",
      "Reference mirrored module paths"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_session_config",
        "action": "Load session configuration",
        "command": "bash(cat $(ls -t .workflow/.active-* | head -1 | sed 's/.active-//')/workflow-session.json)",
        "output_to": "session_config"
      },
      {
        "step": "load_project_readme",
        "action": "Load project README for description",
        "command": "bash(docs_path=$(jq -r '.config.docs_path' <<< '[session_config]'); cat ${docs_path}/README.md 2>/dev/null || echo 'No README')",
        "output_to": "project_readme"
      },
      {
        "step": "load_top_level_dirs",
        "action": "Load top-level directories",
        "command": "bash(session=$(ls -t .workflow/.active-* | head -1 | sed 's/.*active-//'); cat .workflow/${session}/.process/top-level-dirs.txt)",
        "output_to": "top_level_dirs"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate SKILL.md",
        "description": "Create SKILL.md entry point with YAML frontmatter and progressive references",
        "modification_points": [
          "Extract project_name and skill_path from [session_config]",
          "Parse [project_readme] for project description",
          "Parse [top_level_dirs] for available modules",
          "Create ${skill_path}/SKILL.md with YAML frontmatter",
          "Add progressive loading guide (Level 0-3)",
          "Reference OVERVIEW.md for minimal context",
          "List available modules with mirrored paths"
        ],
        "logic_flow": [
          "Parse [session_config] to get skill_path and project_name",
          "Generate SKILL.md with structure:",
          "  - YAML frontmatter (name, description from [project_readme])",
          "  - Progressive loading guide",
          "  - Level 0: [OVERVIEW.md](knowledge/OVERVIEW.md#project-overview)",
          "  - Level 1-3: Module references with mirrored paths from [top_level_dirs]",
          "Write to skill_path/SKILL.md"
        ],
        "depends_on": [],
        "output": "skill_entry"
      }
    ],
    "target_files": ["${skill_path}/SKILL.md"]
  }
}
```

### Task 3 (or IMPL-002): Generate OVERVIEW.md (Merged Index)

**Goal**: Merge project README + EXAMPLES + module index into single OVERVIEW.md

**Task ID**: IMPL-003 (if docs generated) or IMPL-002 (if docs exist)

```json
{
  "id": "IMPL-003",
  "title": "Generate OVERVIEW.md (Merged Index)",
  "status": "pending",
  "depends_on": ["IMPL-002"],
  "meta": {
    "type": "docs",
    "agent": "@doc-generator"
  },
  "context": {
    "requirements": [
      "Merge README.md, EXAMPLES.md, and module index into OVERVIEW.md",
      "Include project overview, quickstart, and module list",
      "Add statistics and token estimates"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_session_config",
        "action": "Load session configuration",
        "command": "bash(cat $(ls -t .workflow/.active-* | head -1 | sed 's/.active-//')/workflow-session.json)",
        "output_to": "session_config"
      },
      {
        "step": "load_project_docs",
        "action": "Load project README, ARCHITECTURE, EXAMPLES",
        "command": "bash(docs_path=$(jq -r '.config.docs_path' <<< '[session_config]'); cat ${docs_path}/README.md ${docs_path}/ARCHITECTURE.md ${docs_path}/EXAMPLES.md 2>/dev/null || echo 'No project docs')",
        "output_to": "project_docs"
      },
      {
        "step": "load_module_list",
        "action": "Load module list for index",
        "command": "bash(docs_path=$(jq -r '.config.docs_path' <<< '[session_config]'); find ${docs_path} -name 'README.md' ! -path \"${docs_path}/README.md\" ! -path \"${docs_path}/ARCHITECTURE.md\" ! -path \"${docs_path}/EXAMPLES.md\" | sort)",
        "output_to": "module_files"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate OVERVIEW.md",
        "description": "Merge project docs and module index into single OVERVIEW.md",
        "modification_points": [
          "Extract project overview from [project_docs]",
          "Extract quickstart from [project_docs]",
          "Build module index from [module_files] with mirrored paths",
          "Calculate statistics (total modules, files, estimated tokens)",
          "Merge into OVERVIEW.md structure"
        ],
        "logic_flow": [
          "Parse [project_docs] to extract sections",
          "Parse [module_files] to build module index:",
          "  - .workflow/docs/my_app/src/modules/auth/README.md → src/modules/auth",
          "Build OVERVIEW.md with sections:",
          "  # Project Overview (from README)",
          "  # Quick Start (from EXAMPLES)",
          "  # Architecture (from ARCHITECTURE)",
          "  # Module Index (from module_files with links)",
          "  # Statistics (files, modules, tokens, timestamp)",
          "Write to ${skill_path}/knowledge/OVERVIEW.md"
        ],
        "depends_on": [],
        "output": "overview_doc"
      }
    ],
    "target_files": ["${skill_path}/knowledge/OVERVIEW.md"]
  }
}
```

### Task 4 (or IMPL-003): Mirror Documentation to SKILL Knowledge

**Goal**: Copy documentation from .workflow/docs/ to .claude/skills/{project}/knowledge/ with path mirroring

**Task ID**: IMPL-004 (if docs generated) or IMPL-003 (if docs exist)

```json
{
  "id": "IMPL-004",
  "title": "Mirror Documentation to SKILL Knowledge",
  "status": "pending",
  "depends_on": ["IMPL-003"],
  "meta": {
    "type": "file-operation",
    "agent": "@doc-generator"
  },
  "context": {
    "requirements": [
      "Copy docs from .workflow/docs/${project_name}/ to ${skill_path}/knowledge/",
      "Maintain exact directory structure (path mirroring)",
      "Exclude project-level docs (README, ARCHITECTURE, EXAMPLES) - already in OVERVIEW.md"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_session_config",
        "action": "Load session configuration",
        "command": "bash(cat $(ls -t .workflow/.active-* | head -1 | sed 's/.active-//')/workflow-session.json)",
        "output_to": "session_config"
      },
      {
        "step": "list_module_docs",
        "action": "List all module documentation files",
        "command": "bash(docs_path=$(jq -r '.config.docs_path' <<< '[session_config]'); find ${docs_path} -name '*.md' ! -path \"${docs_path}/README.md\" ! -path \"${docs_path}/ARCHITECTURE.md\" ! -path \"${docs_path}/EXAMPLES.md\" | sort)",
        "output_to": "doc_files"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Mirror documentation files",
        "description": "Copy module docs to SKILL knowledge/ with path mirroring",
        "modification_points": [
          "Parse [doc_files] to get source file paths",
          "For each file, compute mirrored destination path",
          "Create destination directories if needed",
          "Copy files maintaining structure"
        ],
        "logic_flow": [
          "Parse [session_config] to get docs_path and skill_path",
          "For each file in [doc_files]:",
          "  - Source: .workflow/docs/my_app/src/modules/auth/API.md",
          "  - Destination: .claude/skills/my_app/knowledge/src/modules/auth/API.md",
          "  - Create parent directory if not exists",
          "  - Copy file to destination",
          "Report total files copied"
        ],
        "depends_on": [],
        "output": "mirrored_knowledge"
      }
    ],
    "target_files": ["${skill_path}/knowledge/**/*.md"]
  }
}
```

## Session Structure

Following unified workflow architecture from `workflow-architecture.md`:

```
.workflow/
├── .active-WFS-skill-20250103-143022        # Active session marker
└── WFS-skill-20250103-143022/
    ├── workflow-session.json                # Unified session state (REQUIRED)
    ├── IMPL_PLAN.md                         # Implementation plan (REQUIRED)
    ├── TODO_LIST.md                         # Progress tracker (REQUIRED)
    ├── .process/                            # Analysis artifacts (created on-demand)
    │   ├── folder-analysis.txt              # Folder classification results
    │   └── top-level-dirs.txt               # Top-level directory list
    └── .task/                               # Task definitions (REQUIRED)
        ├── IMPL-001.json                    # Documentation generation (if needed)
        ├── IMPL-002.json                    # SKILL.md generation
        ├── IMPL-003.json                    # OVERVIEW.md generation
        └── IMPL-004.json                    # Mirror documentation
```

**Workflow Session Structure** (workflow-session.json):
```json
{
  "session_id": "WFS-skill-20250103-143022",
  "project": "Generate SKILL package for my_app",
  "type": "simple",
  "current_phase": "PLAN",
  "status": "active",
  "created": "2025-01-03T14:30:22+08:00",
  "config": {
    "project_name": "my_app",
    "target_path": "/home/user/projects/my_app",
    "project_root": "/home/user/projects",
    "tool": "gemini",
    "regenerate": false,
    "docs_path": ".workflow/docs/my_app",
    "skill_path": ".claude/skills/my_app",
    "docs_status": "ready",
    "existing_docs": 15,
    "analysis": {
      "total_folders": 15,
      "code_folders": 8,
      "navigation_folders": 7,
      "top_level_dirs": 3
    }
  },
  "progress": {
    "completed_phases": [],
    "current_tasks": ["IMPL-001", "IMPL-002", "IMPL-003"]
  }
}
```

## Generated SKILL Package

**Structure mirrors project source directories**:

```
.claude/skills/
└── {project_name}/                    # Project-specific root (e.g., my_app/)
    ├── SKILL.md                       # Entry point (IMPL-002 or IMPL-001)
    └── knowledge/
        ├── OVERVIEW.md                # Merged index (IMPL-003 or IMPL-002)
        └── [mirrored structure]       # Mirrored docs (IMPL-004 or IMPL-003)
            ├── src/
            │   ├── modules/
            │   │   ├── auth/
            │   │   │   ├── API.md
            │   │   │   └── README.md
            │   │   └── api/
            │   │       ├── API.md
            │   │       └── README.md
            │   └── utils/
            │       └── README.md
            └── lib/
                └── core/
                    ├── API.md
                    └── README.md
```

## Execution

```bash
# Plan SKILL package generation
/memory:skill-memory [path] [--tool gemini|qwen] [--regenerate]

# Execute tasks
/workflow:execute
```

**Common Usage**:
- `/memory:skill-memory` - Auto-detect project, use existing docs or generate if needed
- `/memory:skill-memory --regenerate` - Force regenerate all documentation
- `/memory:skill-memory --tool qwen` - Use qwen instead of gemini

## Examples

### Example 1: First-time SKILL Package Generation (No Existing Docs)

```bash
# Step 1: Plan (this command)
/memory:skill-memory

# Output:
# ✓ Session initialized: WFS-skill-20250103-143022
# ✓ Project: my_app
# 📊 Folder Analysis Complete:
#   - Total folders: 15
#   - Code folders: 8
#   - Navigation folders: 7
# 📄 No existing documentation found, will generate
# 🔧 Generating documentation...
# ✓ Documentation generation task created (IMPL-001)
# 📋 Task list:
#   - IMPL-001: Generate documentation
#   - IMPL-002: Generate SKILL.md entry point
#   - IMPL-003: Generate OVERVIEW.md
#   - IMPL-004: Mirror docs to SKILL knowledge/
# ✅ Tasks generated successfully

# Step 2: Execute
/workflow:execute
```

### Example 2: SKILL Package from Existing Documentation

```bash
# Step 1: Plan (this command)
/memory:skill-memory

# Output:
# ✓ Session initialized: WFS-skill-20250103-143022
# ✓ Project: my_app
# 📊 Folder Analysis Complete:
#   - Total folders: 15
#   - Code folders: 8
# 📄 Found 15 existing documentation files
# ✓ Using existing documentation
# 📋 Task list (docs exist):
#   - IMPL-001: Generate SKILL.md entry point
#   - IMPL-002: Generate OVERVIEW.md
#   - IMPL-003: Mirror docs to SKILL knowledge/
# ✅ Tasks generated successfully

# Step 2: Execute
/workflow:execute
```

### Example 3: Force Regenerate Documentation

```bash
# Step 1: Plan with regenerate flag
/memory:skill-memory --regenerate

# Output:
# ✓ Session initialized: WFS-skill-20250103-143500
# ✓ Project: my_app
# 📊 Folder Analysis Complete:
#   - Total folders: 15
# 📄 Found 15 existing documentation files
# ⚠️  --regenerate flag set, will regenerate all documentation
# 🔧 Generating documentation...
# ✓ Documentation generation task created (IMPL-001)
# 📋 Task list:
#   - IMPL-001: Generate documentation
#   - IMPL-002: Generate SKILL.md entry point
#   - IMPL-003: Generate OVERVIEW.md
#   - IMPL-004: Mirror docs to SKILL knowledge/

# Step 2: Execute
/workflow:execute
```

## Key Features

- ✅ Path mirroring for intuitive navigation
- ✅ Embedded documentation generation (no external command dependencies)
- ✅ Progressive SKILL loading (Level 0-3)
- ✅ Merged OVERVIEW.md for quick reference
- ✅ Smart folder classification (code vs navigation)
- ✅ Reuses existing docs or regenerates on demand
- ✅ workflow-session.json for session state
- ✅ Compatible with workflow-architecture.md conventions
