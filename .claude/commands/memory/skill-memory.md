---
name: skill-memory
description: Generate SKILL package index from project documentation
argument-hint: "[path] [--tool <gemini|qwen>] [--regenerate] [--mode <full|partial>]"
allowed-tools: SlashCommand(*), TodoWrite(*), Bash(*), Read(*), Write(*)
---

# Memory SKILL Package Generator

## Orchestrator Role

**This command is a pure orchestrator**: Execute documentation generation workflow, then generate SKILL.md index. Does NOT create task JSON files.

**Execution Model - 4-Phase Workflow**:

1. **User triggers**: `/memory:skill-memory [path] [options]`
2. **Phase 1**: Parse arguments and prepare → Auto-continues
3. **Phase 2**: Call `/memory:docs` to plan documentation → Auto-continues
4. **Phase 3**: Call `/workflow:execute` to generate docs → Auto-continues
5. **Phase 4**: Generate SKILL.md index → Reports completion

**Auto-Continue Mechanism**:
- TodoList tracks current phase status
- After each phase completion, automatically executes next phase
- All phases run autonomously without user interaction
- Progress updates shown at each phase

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Task JSON**: This command does not create task JSON files - delegates to /memory:docs
3. **Parse Every Output**: Extract required data from each command output
4. **Auto-Continue via TodoList**: Check TodoList status to execute next phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion
6. **Direct Generation**: Phase 4 directly generates SKILL.md using Write tool

## 4-Phase Execution

### Phase 1: Prepare Arguments

**Goal**: Parse command arguments and check existing documentation

**Actions**:
```bash
# Parse arguments
bash(
  path="${1:-.}"
  tool="gemini"
  regenerate=""
  mode="full"
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tool) tool="$2"; shift 2 ;;
      --regenerate) regenerate="--regenerate"; shift ;;
      --mode) mode="$2"; shift 2 ;;
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

  project_name=$(basename "$target_path")
  docs_path=".workflow/docs/${project_name}"

  echo "PROJECT_NAME: ${project_name}"
  echo "TARGET_PATH: ${target_path}"
  echo "DOCS_PATH: ${docs_path}"
  echo "TOOL: ${tool}"
  echo "MODE: ${mode}"
  echo "REGENERATE: ${regenerate}"
)

# Check existing documentation
bash(
  project_name="[from previous output]"
  docs_path=".workflow/docs/${project_name}"

  if [[ -d "$docs_path" ]]; then
    doc_count=$(find "$docs_path" -name "*.md" 2>/dev/null | wc -l)
    echo "EXISTING_DOCS: $doc_count"
  else
    echo "EXISTING_DOCS: 0"
  fi
)
```

**Parse Output**:
- `PROJECT_NAME`: Project name (store as `projectName`)
- `TARGET_PATH`: Full target path (store as `targetPath`)
- `DOCS_PATH`: Documentation path (store as `docsPath`)
- `TOOL`: CLI tool selection (store as `tool`)
- `MODE`: Documentation mode (store as `mode`)
- `REGENERATE`: Regenerate flag (store as `regenerateFlag`)
- `EXISTING_DOCS`: Existing doc count (store as `existingDocs`)

**Validation**:
- Target path exists
- Project name extracted

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Display preparation results, auto-continue to Phase 2

---

### Phase 2: Call /memory:docs

**Goal**: Trigger documentation generation workflow

**Command**:
```bash
SlashCommand(command="/memory:docs [targetPath] --tool [tool] --mode [mode] [regenerateFlag]")
```

**Example**:
```bash
/memory:docs /d/my_app --tool gemini --mode full
# or with regenerate:
/memory:docs /d/my_app --tool gemini --mode full --regenerate
```

**Input**:
- `targetPath` from Phase 1
- `tool` from Phase 1
- `mode` from Phase 1
- `regenerateFlag` from Phase 1

**Parse Output**:
- Extract session ID pattern: `WFS-docs-[timestamp]` (store as `docsSessionId`)
- Extract task count (store as `taskCount`)

**Validation**:
- Session ID extracted successfully
- Task files created in `.workflow/[docsSessionId]/.task/`

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Display docs planning results, auto-continue to Phase 3

---

### Phase 3: Execute Documentation Generation

**Goal**: Execute documentation generation tasks

**Command**:
```bash
SlashCommand(command="/workflow:execute")
```

**Note**: `/workflow:execute` automatically discovers active session from Phase 2

**Validation**:
- Documentation files generated in `.workflow/docs/[projectName]/`
- All tasks completed successfully

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**After Phase 3**: Display execution results, auto-continue to Phase 4

---

### Phase 4: Generate SKILL.md Index

**Goal**: Create SKILL.md at `.claude/skills/{project_name}/SKILL.md`

**Actions**:

1. **Load project README for description**:
```bash
bash(
  project_name="[from Phase 1]"
  cat .workflow/docs/${project_name}/README.md 2>/dev/null | head -50 || echo "No README found"
)
```

2. **Discover documentation structure**:
```bash
bash(
  project_name="[from Phase 1]"
  find .workflow/docs/${project_name} -name "*.md" 2>/dev/null | sort
)
```

3. **Extract module directories**:
```bash
bash(
  project_name="[from Phase 1]"
  find .workflow/docs/${project_name} -mindepth 1 -maxdepth 2 -type d 2>/dev/null | sed "s|.workflow/docs/${project_name}/||" | sort -u
)
```

4. **Generate SKILL.md**:

Use the `Write` tool to create `.claude/skills/{project_name}/SKILL.md` with:
- YAML frontmatter (name, description from README)
- Progressive loading guide (Level 0-3)
- Module index with relative paths to `../../.workflow/docs/{project_name}/`

**SKILL.md Structure**:
```markdown
---
name: {project_name}
description: {extracted from README}
version: 1.0.0
---

# {Project Name} SKILL Package

Progressive documentation loading guide.

## Documentation Location

All documentation: `../../.workflow/docs/{project_name}/`

## Progressive Loading Guide

### Level 0: Quick Start (Minimal Context ~2K tokens)
- [Project Overview](../../.workflow/docs/{project_name}/README.md#overview)
- [Getting Started](../../.workflow/docs/{project_name}/README.md#getting-started)

### Level 1: Core Modules (Essential Context ~8K tokens)
- [Module 1](../../.workflow/docs/{project_name}/path/to/module1/README.md)
- [Module 2](../../.workflow/docs/{project_name}/path/to/module2/README.md)

### Level 2: Complete (Full Context ~25K tokens)
- All modules + [Architecture](../../.workflow/docs/{project_name}/ARCHITECTURE.md)

### Level 3: Deep Dive (Maximum Context ~40K tokens)
- All docs + [Examples](../../.workflow/docs/{project_name}/EXAMPLES.md)

## Module Index

{Generated from discovered structure}
```

**Validation**:
- SKILL.md created at `.claude/skills/{project_name}/SKILL.md`
- File contains valid YAML frontmatter
- All links reference correct paths

**TodoWrite**: Mark phase 4 completed

**Return to User**:
```
✅ SKILL Package Generation Complete

Project: {project_name}
Documentation: .workflow/docs/{project_name}/ ({doc_count} files)
SKILL Index: .claude/skills/{project_name}/SKILL.md

Generated:
- {task_count} documentation tasks completed
- SKILL.md with progressive loading (4 levels)
- Module index with {module_count} modules

Usage:
- Load Level 0: Quick project overview (~2K tokens)
- Load Level 1: Core modules (~8K tokens)
- Load Level 2: Complete docs (~25K tokens)
- Load Level 3: Everything (~40K tokens)
```

---

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "in_progress", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "pending", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "pending", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "in_progress", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "pending", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})

// After Phase 2
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "completed", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "in_progress", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})

// After Phase 3
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "completed", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "completed", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "in_progress", "activeForm": "Generating SKILL.md"}
]})
```

## Parameters

```bash
/memory:skill-memory [path] [--tool <gemini|qwen>] [--regenerate] [--mode <full|partial>]
```

- **path**: Target directory (default: current directory)
- **--tool**: CLI tool for documentation (default: gemini)
  - `gemini`: Comprehensive documentation
  - `qwen`: Architecture analysis
- **--regenerate**: Force regenerate all documentation
- **--mode**: Documentation mode (default: full)
  - `full`: Complete docs (modules + README + ARCHITECTURE + EXAMPLES)
  - `partial`: Module docs only

## Examples

### Example 1: Generate SKILL Package (Default)

```bash
/memory:skill-memory
```

**Workflow**:
1. Phase 1: Detects current directory, checks existing docs
2. Phase 2: Calls `/memory:docs . --tool gemini --mode full`
3. Phase 3: Executes documentation generation via `/workflow:execute`
4. Phase 4: Generates SKILL.md at `.claude/skills/{project_name}/SKILL.md`

### Example 2: Regenerate with Qwen

```bash
/memory:skill-memory /d/my_app --tool qwen --regenerate
```

**Workflow**:
1. Phase 1: Parses target path, detects regenerate flag
2. Phase 2: Calls `/memory:docs /d/my_app --tool qwen --mode full --regenerate`
3. Phase 3: Executes documentation regeneration
4. Phase 4: Generates updated SKILL.md

### Example 3: Partial Mode (Modules Only)

```bash
/memory:skill-memory --mode partial
```

**Workflow**:
1. Phase 1: Detects partial mode
2. Phase 2: Calls `/memory:docs . --tool gemini --mode partial`
3. Phase 3: Executes module documentation only
4. Phase 4: Generates SKILL.md with module-only index

## Benefits

- ✅ **Pure Orchestrator**: No task JSON generation, delegates to /memory:docs
- ✅ **Auto-Continue**: Autonomous 4-phase execution
- ✅ **Simplified**: ~70% less code than previous version
- ✅ **Maintainable**: Changes to /memory:docs automatically apply
- ✅ **Direct Generation**: Phase 4 directly writes SKILL.md
- ✅ **Flexible**: Supports all /memory:docs options

## Architecture

```
skill-memory (orchestrator)
  ├─ Phase 1: Prepare (bash commands)
  ├─ Phase 2: /memory:docs (task planning)
  ├─ Phase 3: /workflow:execute (task execution)
  └─ Phase 4: Write SKILL.md (direct file generation)

No task JSON created by this command
All documentation tasks managed by /memory:docs
```
