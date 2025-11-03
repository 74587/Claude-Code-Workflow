---
name: skill-memory
description: Generate progressive project SKILL package from documentation with path mirroring
argument-hint: "[path] [--tool <gemini|qwen>] [--regenerate] [--skip-docs]"
---

# Memory SKILL Package Generator

## Overview

Lightweight planner that analyzes documentation structure, decomposes SKILL package work into tasks, and generates execution plans. Transforms project documentation into reusable SKILL package with **mirrored source structure**.

**SKILL Package Output**: All knowledge files are placed in `.claude/skills/{project_name}/knowledge/` directory with **mirrored project structure**. For example:
- Project: `my_app`
- Source: `my_app/src/modules/auth/` → SKILL: `.claude/skills/my_app/knowledge/src/modules/auth/API.md`
- Source: `my_app/lib/core/` → SKILL: `.claude/skills/my_app/knowledge/lib/core/README.md`

## Path Mirroring Strategy

**Principle**: SKILL knowledge structure **mirrors** source code structure under project-specific directory.

| Source Path | Project Name | SKILL Knowledge Path |
|------------|--------------|---------------------|
| `my_app/src/modules/auth/` | `my_app` | `.claude/skills/my_app/knowledge/src/modules/auth/API.md` |
| `my_app/lib/core/` | `my_app` | `.claude/skills/my_app/knowledge/lib/core/README.md` |
| `another_project/src/api/` | `another_project` | `.claude/skills/another_project/knowledge/src/api/API.md` |

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
    ├── OVERVIEW.md             # Project overview + quickstart + module index (合并)
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
/memory:skill-memory [path] [--tool <gemini|qwen>] [--regenerate] [--skip-docs]
```

- **path**: Target directory (default: current directory)
  - Specifies the directory to generate SKILL package for

- **--tool**: CLI tool selection (default: gemini)
  - `gemini`: Comprehensive documentation, pattern recognition
  - `qwen`: Architecture analysis, system design focus

- **--regenerate**: Force regenerate docs from source code (optional)
  - When enabled: Runs `/memory:docs --mode full` first
  - When disabled: Uses existing docs from `.workflow/docs/{project}`

- **--skip-docs**: Skip documentation generation phase (optional)
  - Uses existing docs in `.workflow/docs/{project}` directly
  - Fails if no existing docs found

## Planning Workflow

### Phase 1: Initialize Session

#### Step 1: Create Session and Generate Config
```bash
# Parse arguments
bash(
  path="${1:-.}"
  tool="gemini"
  regenerate=false
  skip_docs=false
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="$2"; shift 2 ;;
      --regenerate) regenerate=true; shift ;;
      --skip-docs) skip_docs=true; shift ;;
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

  # Paths
  docs_path=".workflow/docs/${project_name}"
  skill_path=".claude/skills/${project_name}"

  # Create session
  timestamp=$(date +%Y%m%d-%H%M%S)
  session="WFS-skill-${timestamp}"
  mkdir -p ".workflow/${session}"/{.task,.process,.summaries}
  touch ".workflow/.active-${session}"

  # Generate config
  cat > ".workflow/${session}/.process/config.json" <<EOF
{
  "session_id": "${session}",
  "timestamp": "$(date -Iseconds)",
  "path": "${path}",
  "target_path": "${target_path}",
  "project_root": "${project_root}",
  "project_name": "${project_name}",
  "tool": "${tool}",
  "regenerate": ${regenerate},
  "skip_docs": ${skip_docs},
  "docs_path": "${docs_path}",
  "skill_path": "${skill_path}"
}
EOF

  echo "✓ Session initialized: ${session}"
  echo "✓ Project: ${project_name}"
  echo "✓ Tool: ${tool}"
  echo "✓ Regenerate: ${regenerate}, Skip docs: ${skip_docs}"
)
```

**Output**:
```
✓ Session initialized: WFS-skill-20240120-143022
✓ Project: my_app
✓ Tool: gemini
✓ Regenerate: false, Skip docs: false
```

### Phase 2: Documentation Check

**Goal**: Verify documentation exists or trigger generation

#### Step 1: Check Existing Documentation
```bash
# Check if documentation exists
bash(
  project_name=$(jq -r '.project_name' .workflow/WFS-skill-20240120/.process/config.json)
  docs_path=".workflow/docs/${project_name}"

  if [[ -d "${docs_path}" ]]; then
    doc_count=$(find "${docs_path}" -name "*.md" 2>/dev/null | wc -l)
    echo "${doc_count}"
  else
    echo "0"
  fi
)
```

**Output**: `15` (existing docs found) or `0` (no docs)

#### Step 2: Trigger Documentation Generation (if needed)
```bash
# Generate docs if needed
bash(
  skip_docs=$(jq -r '.skip_docs' .workflow/WFS-skill-20240120/.process/config.json)
  regenerate=$(jq -r '.regenerate' .workflow/WFS-skill-20240120/.process/config.json)
  doc_count=$(jq -r '.existing_docs // 0' .workflow/WFS-skill-20240120/.process/config.json)

  if [[ "$skip_docs" == "true" ]]; then
    if [[ $doc_count -eq 0 ]]; then
      echo "❌ Error: --skip-docs specified but no documentation found"
      exit 1
    else
      echo "📄 Using existing documentation (${doc_count} files)"
    fi
  elif [[ "$regenerate" == "true" ]] || [[ $doc_count -eq 0 ]]; then
    echo "📝 Generating documentation..."
    # Will trigger /memory:docs via SlashCommand
  else
    echo "📄 Using existing documentation (${doc_count} files)"
  fi
)

# Update config with docs status
bash(
  jq '. + {existing_docs: 15, docs_status: "ready"}' .workflow/WFS-skill-20240120/.process/config.json > .workflow/WFS-skill-20240120/.process/config.json.tmp && mv .workflow/WFS-skill-20240120/.process/config.json.tmp .workflow/WFS-skill-20240120/.process/config.json
)
```

**If documentation needed**:
```bash
# Call /memory:docs
SlashCommand("/memory:docs --mode full --tool gemini")

# Wait for docs completion (manual or via /workflow:execute)
# Then continue...
```

### Phase 3: Analyze Documentation Structure

**Goal**: Analyze existing documentation to prepare for SKILL package generation

#### Step 1: List Documentation Files
```bash
# Find all documentation files (excluding project-level files)
bash(
  docs_path=$(jq -r '.docs_path' .workflow/WFS-skill-20240120/.process/config.json)

  find "${docs_path}" -type f -name "*.md" \
    ! -path "${docs_path}/README.md" \
    ! -path "${docs_path}/ARCHITECTURE.md" \
    ! -path "${docs_path}/EXAMPLES.md" \
    ! -path "${docs_path}/api/*" \
    > .workflow/WFS-skill-20240120/.process/module-docs.txt

  cat .workflow/WFS-skill-20240120/.process/module-docs.txt
)
```

**Output** (module-docs.txt):
```
.workflow/docs/my_app/src/modules/auth/API.md
.workflow/docs/my_app/src/modules/auth/README.md
.workflow/docs/my_app/src/modules/api/API.md
.workflow/docs/my_app/src/modules/api/README.md
.workflow/docs/my_app/lib/core/API.md
.workflow/docs/my_app/lib/core/README.md
```

#### Step 2: Extract Directory Structure
```bash
# Extract unique directories from module docs
bash(
  docs_path=$(jq -r '.docs_path' .workflow/WFS-skill-20240120/.process/config.json)

  # Get unique directory paths
  cat .workflow/WFS-skill-20240120/.process/module-docs.txt | \
    xargs -n 1 dirname | \
    sort -u | \
    sed "s|^${docs_path}/||" \
    > .workflow/WFS-skill-20240120/.process/doc-dirs.txt

  cat .workflow/WFS-skill-20240120/.process/doc-dirs.txt
)
```

**Output** (doc-dirs.txt):
```
src/modules/auth
src/modules/api
lib/core
```

#### Step 3: Count Statistics
```bash
# Calculate statistics
bash(
  total_docs=$(wc -l < .workflow/WFS-skill-20240120/.process/module-docs.txt)
  total_dirs=$(wc -l < .workflow/WFS-skill-20240120/.process/doc-dirs.txt)

  echo "📊 Documentation Analysis:"
  echo "  - Module docs: ${total_docs}"
  echo "  - Directories: ${total_dirs}"
)

# Update config
bash(
  jq '. + {analysis: {total_docs: "12", total_dirs: "3"}}' .workflow/WFS-skill-20240120/.process/config.json > .workflow/WFS-skill-20240120/.process/config.json.tmp && mv .workflow/WFS-skill-20240120/.process/config.json.tmp .workflow/WFS-skill-20240120/.process/config.json
)
```

### Phase 4: Generate Tasks

**Goal**: Create task JSONs for SKILL package generation

**Task Structure**:
```
IMPL-001: Generate SKILL.md entry point
IMPL-002: Generate OVERVIEW.md (合并 README + EXAMPLES + module index)
IMPL-003: Mirror module documentation structure
```

#### Task 1: Generate SKILL.md Entry Point

**Goal**: Create SKILL.md with YAML frontmatter and progressive references

```json
{
  "id": "IMPL-001",
  "title": "Generate SKILL.md Entry Point",
  "status": "pending",
  "meta": {
    "type": "skill-entry",
    "agent": "@doc-generator",
    "tool": "gemini"
  },
  "context": {
    "requirements": [
      "Create SKILL.md with YAML frontmatter",
      "Add progressive loading guide",
      "Reference OVERVIEW.md for project overview",
      "Reference mirrored module paths"
    ],
    "project_name": "${project_name}",
    "skill_path": "${skill_path}"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_project_info",
        "command": "bash(cat ${docs_path}/README.md 2>/dev/null || echo 'No README')",
        "output_to": "project_readme"
      },
      {
        "step": "list_modules",
        "command": "bash(cat ${session_dir}/.process/doc-dirs.txt)",
        "output_to": "module_list"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate SKILL.md",
        "description": "Create SKILL.md entry point with YAML frontmatter and progressive references",
        "modification_points": [
          "Create ${skill_path}/SKILL.md",
          "Add YAML frontmatter (name, description)",
          "Add progressive loading guide (Level 0-3)",
          "Reference OVERVIEW.md for minimal context",
          "List available modules from [module_list]"
        ],
        "logic_flow": [
          "Parse [project_readme] for project description",
          "Parse [module_list] for available modules",
          "Generate SKILL.md with structure:",
          "  - YAML frontmatter",
          "  - Progressive loading guide",
          "  - Level 0: [OVERVIEW.md](knowledge/OVERVIEW.md)",
          "  - Level 1-3: Module references with mirrored paths"
        ],
        "depends_on": [],
        "output": "skill_entry"
      }
    ],
    "target_files": ["${skill_path}/SKILL.md"]
  }
}
```

#### Task 2: Generate OVERVIEW.md (Merged Index)

**Goal**: Merge project README + EXAMPLES + module index into single OVERVIEW.md

```json
{
  "id": "IMPL-002",
  "title": "Generate OVERVIEW.md (Merged Index)",
  "status": "pending",
  "meta": {
    "type": "skill-overview",
    "agent": "@doc-generator",
    "tool": "gemini"
  },
  "context": {
    "requirements": [
      "Merge README.md, EXAMPLES.md, and module index into OVERVIEW.md",
      "Include project overview, quickstart, and module list",
      "Add statistics and token estimates"
    ],
    "docs_path": "${docs_path}",
    "skill_path": "${skill_path}"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_readme",
        "command": "bash(cat ${docs_path}/README.md 2>/dev/null || echo 'No README')",
        "output_to": "readme_content"
      },
      {
        "step": "load_examples",
        "command": "bash(cat ${docs_path}/EXAMPLES.md 2>/dev/null || echo 'No examples')",
        "output_to": "examples_content"
      },
      {
        "step": "load_architecture",
        "command": "bash(cat ${docs_path}/ARCHITECTURE.md 2>/dev/null || echo 'No architecture')",
        "output_to": "architecture_content"
      },
      {
        "step": "load_module_list",
        "command": "bash(cat ${session_dir}/.process/doc-dirs.txt)",
        "output_to": "module_dirs"
      },
      {
        "step": "calculate_stats",
        "command": "bash(find ${docs_path} -name '*.md' | wc -l; find ${docs_path} -name '*.md' -exec wc -c {} + | tail -1 | awk '{print int($1/4)}')",
        "output_to": "stats"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate OVERVIEW.md",
        "description": "Merge project overview, quickstart, architecture, and module index into single OVERVIEW.md",
        "modification_points": [
          "Parse [readme_content], [examples_content], [architecture_content]",
          "Parse [module_dirs] for module list",
          "Calculate [stats] for token estimates",
          "Create ${skill_path}/knowledge/OVERVIEW.md with sections:",
          "  1. Project Overview (from README)",
          "  2. Quick Start (from EXAMPLES)",
          "  3. Architecture (from ARCHITECTURE)",
          "  4. Module Index (from module_dirs with links)",
          "  5. Statistics (files, tokens, generated date)"
        ],
        "logic_flow": [
          "Create directory: ${skill_path}/knowledge/",
          "Merge content sections:",
          "  # Project Overview",
          "  [readme_content summary]",
          "  ",
          "  ## Quick Start",
          "  [examples_content key examples]",
          "  ",
          "  ## Architecture",
          "  [architecture_content summary]",
          "  ",
          "  ## Module Index",
          "  [For each dir in module_dirs:",
          "   - [module_name](src/modules/auth/README.md)]",
          "  ",
          "  ## Statistics",
          "  - Modules: X",
          "  - Files: Y",
          "  - Estimated Tokens: Z"
        ],
        "depends_on": [],
        "output": "overview_doc"
      }
    ],
    "target_files": ["${skill_path}/knowledge/OVERVIEW.md"]
  }
}
```

#### Task 3: Mirror Module Documentation

**Goal**: Copy all module documentation with mirrored path structure

```json
{
  "id": "IMPL-003",
  "title": "Mirror Module Documentation Structure",
  "status": "pending",
  "depends_on": ["IMPL-001", "IMPL-002"],
  "meta": {
    "type": "skill-mirror",
    "agent": "@doc-generator",
    "tool": "gemini"
  },
  "context": {
    "requirements": [
      "Mirror all module documentation from ${docs_path} to ${skill_path}/knowledge/",
      "Preserve directory structure exactly",
      "Copy API.md and README.md files",
      "Maintain path mapping (src/modules/auth/ → knowledge/src/modules/auth/)"
    ],
    "docs_path": "${docs_path}",
    "skill_path": "${skill_path}"
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_module_docs",
        "command": "bash(cat ${session_dir}/.process/module-docs.txt)",
        "output_to": "all_module_docs"
      },
      {
        "step": "load_doc_dirs",
        "command": "bash(cat ${session_dir}/.process/doc-dirs.txt)",
        "output_to": "doc_directories"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Mirror documentation structure",
        "description": "Copy all module documentation with exact path mirroring",
        "modification_points": [
          "Parse [all_module_docs] for file list",
          "Parse [doc_directories] for directory structure",
          "For each file in ${docs_path}:",
          "  - Extract relative path from ${docs_path}",
          "  - Create mirrored directory in ${skill_path}/knowledge/",
          "  - Copy file to mirrored location",
          "Example: ${docs_path}/src/modules/auth/API.md",
          "      → ${skill_path}/knowledge/src/modules/auth/API.md"
        ],
        "logic_flow": [
          "Create base directory: ${skill_path}/knowledge/",
          "For each directory in [doc_directories]:",
          "  - Create ${skill_path}/knowledge/{dir}/",
          "For each file in [all_module_docs]:",
          "  - Get relative_path from ${docs_path}",
          "  - Copy to ${skill_path}/knowledge/{relative_path}",
          "Verify all files copied successfully"
        ],
        "depends_on": [],
        "output": "mirrored_docs"
      }
    ],
    "target_files": ["${skill_path}/knowledge/**/*.md"]
  }
}
```

## Session Structure

```
.workflow/
├── .active-WFS-skill-20240120-143022        # Active session marker
└── WFS-skill-20240120-143022/
    ├── IMPL_PLAN.md                         # Implementation plan
    ├── TODO_LIST.md                         # Progress tracker
    ├── .process/
    │   ├── config.json                      # Session config
    │   ├── module-docs.txt                  # Module documentation paths
    │   └── doc-dirs.txt                     # Documentation directories
    └── .task/
        ├── IMPL-001.json                    # SKILL.md generation
        ├── IMPL-002.json                    # OVERVIEW.md generation
        └── IMPL-003.json                    # Mirror documentation
```

**Config File Structure** (config.json):
```json
{
  "session_id": "WFS-skill-20240120-143022",
  "timestamp": "2024-01-20T14:30:22+08:00",
  "path": ".",
  "target_path": "/home/user/projects/my_app",
  "project_root": "/home/user/projects",
  "project_name": "my_app",
  "tool": "gemini",
  "regenerate": false,
  "skip_docs": false,
  "docs_path": ".workflow/docs/my_app",
  "skill_path": ".claude/skills/my_app",
  "existing_docs": 15,
  "docs_status": "ready",
  "analysis": {
    "total_docs": "12",
    "total_dirs": "3"
  }
}
```

## Generated SKILL Package

**Structure mirrors project source directories**:

```
.claude/skills/
└── {project_name}/                    # Project-specific root (e.g., my_app/)
    ├── SKILL.md                       # Entry point (IMPL-001)
    └── knowledge/
        ├── OVERVIEW.md                # Merged index (IMPL-002)
        └── [mirrored structure]       # Mirrored docs (IMPL-003)
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
/memory:skill-memory [path] [--tool gemini|qwen] [--regenerate] [--skip-docs]

# Execute tasks
/workflow:execute
```

**Common Usage**:
- `/memory:skill-memory` - Auto-detect project, use existing docs
- `/memory:skill-memory --regenerate` - Force regenerate docs first
- `/memory:skill-memory --skip-docs` - Use existing docs only

## Examples

### Example 1: First-time SKILL Package Generation

```bash
# Step 1: Plan (this command)
/memory:skill-memory

# Output:
# ✓ Session initialized: WFS-skill-20240120-143022
# ✓ Project: my_app
# 📄 Using existing documentation (15 files)
# 📊 Documentation Analysis:
#   - Module docs: 12
#   - Directories: 3
# ✅ Tasks generated: IMPL-001, IMPL-002, IMPL-003

# Step 2: Execute
/workflow:execute

# Result: .claude/skills/my_app/ created with mirrored structure
```

### Example 2: Update Existing SKILL Package

```bash
# Regenerate docs and update SKILL
/memory:skill-memory --regenerate

# Execute
/workflow:execute
```

### Example 3: SKILL Package Only (No Docs Generation)

```bash
# Use existing docs
/memory:skill-memory --skip-docs

# Execute
/workflow:execute
```

## SKILL.md Template (Generated by IMPL-001)

```markdown
---
name: ${project_name}
description: Progressive knowledge base for ${project_name} project. Load project context at appropriate detail level based on task requirements.
---

# ${project_name} Knowledge

Progressive project knowledge with path-mirrored structure. See [OVERVIEW.md](knowledge/OVERVIEW.md) for complete module index.

## Progressive Loading Guide

### Level 0: Minimal Context (~500 tokens)

**Use for**: Quick queries, code reviews, bug fixes

**Load**: [Project Overview](knowledge/OVERVIEW.md#project-overview)

### Level 1: Standard Context (~2000 tokens)

**Use for**: Feature implementation, refactoring

**Load**: [Complete Overview](knowledge/OVERVIEW.md) (includes architecture and module index)

### Level 2: Module-Focused (~1500 tokens per module)

**Use for**: Working on specific module

**Available Modules** (see [OVERVIEW.md](knowledge/OVERVIEW.md#module-index) for full list):

- [auth module](knowledge/src/modules/auth/README.md)
- [api module](knowledge/src/modules/api/README.md)
- [core library](knowledge/lib/core/README.md)

**Example**: To work on auth module, load:
- [auth/README.md](knowledge/src/modules/auth/README.md)
- [auth/API.md](knowledge/src/modules/auth/API.md)

### Level 3: Full Context (⚠️ High token usage)

**Use for**: Architecture changes, major refactoring

**Load**: Start with OVERVIEW.md, then progressively load modules as needed.

## Path Mapping

Knowledge structure mirrors source code:
- Source: `src/modules/auth/` → Knowledge: `knowledge/src/modules/auth/`
- Source: `lib/core/` → Knowledge: `knowledge/lib/core/`

## Quick Start

1. **Understand project**: Read [OVERVIEW.md](knowledge/OVERVIEW.md)
2. **Explore modules**: See module index in OVERVIEW.md
3. **Deep dive**: Load specific module documentation using mirrored paths

## Updates

Regenerate SKILL package after major code changes:
\`\`\`bash
/memory:skill-memory --regenerate
\`\`\`

**Generated**: ${timestamp}
```

## OVERVIEW.md Template (Generated by IMPL-002)

```markdown
# ${project_name} - Project Overview

**Generated**: ${timestamp}
**Modules**: ${module_count}
**Files**: ${file_count}
**Estimated Tokens**: ${token_estimate}

---

## 📋 Project Overview

${readme_summary}

## 🚀 Quick Start

${examples_key_sections}

## 🏗️ Architecture

${architecture_summary}

## 📦 Module Index

${module_list_with_links}

### src/modules/auth
**Path**: `knowledge/src/modules/auth/`
**Files**: [README.md](src/modules/auth/README.md), [API.md](src/modules/auth/API.md)
**Description**: Authentication and authorization module

### src/modules/api
**Path**: `knowledge/src/modules/api/`
**Files**: [README.md](src/modules/api/README.md), [API.md](src/modules/api/API.md)
**Description**: REST API endpoints and handlers

### lib/core
**Path**: `knowledge/lib/core/`
**Files**: [README.md](lib/core/README.md), [API.md](lib/core/API.md)
**Description**: Core library utilities

## 📊 Statistics

- **Total Modules**: ${module_count}
- **Documentation Files**: ${file_count}
- **Estimated Total Tokens**: ${token_estimate}
- **Structure**: Path-mirrored to source code

## 🔗 Navigation

All module documentation uses mirrored source paths:
- `knowledge/src/modules/auth/` ← mirrors → `src/modules/auth/`
- `knowledge/lib/core/` ← mirrors → `lib/core/`

See [SKILL.md](../SKILL.md) for progressive loading guide.

---

**Version**: 5.0.0
**Last Updated**: ${timestamp}
```

## Design Philosophy

**Path Mirroring**:
- ✅ Knowledge structure mirrors source code exactly
- ✅ Easy to locate docs for any source file
- ✅ Maintains logical organization
- ✅ Supports any project structure

**Single Overview File**:
- ✅ OVERVIEW.md merges: README + EXAMPLES + Architecture + Module Index
- ✅ Single file for quick project understanding (~2000 tokens)
- ✅ Includes all navigation links to mirrored modules

**SKILL-Native Design**:
- ✅ SKILL.md as entry point (required by Claude Code)
- ✅ Standard Markdown links for progressive loading
- ✅ Claude loads referenced files on-demand
- ✅ Human-readable OVERVIEW.md for module discovery

**Progressive Loading**:
- Level 0: OVERVIEW.md#project-overview (~500 tokens)
- Level 1: Full OVERVIEW.md (~2000 tokens)
- Level 2: Specific modules (~1500/module)
- Level 3: Full context (load progressively as needed)

---

**Version**: 5.0.0 (Path-Mirrored)
**Last Updated**: 2025-01-03
**Dependencies**: `/memory:docs`, `/workflow:execute`, `gemini` CLI
