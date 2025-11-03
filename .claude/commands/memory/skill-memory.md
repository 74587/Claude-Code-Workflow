---
name: skill-memory
description: Generate SKILL package index from project documentation
argument-hint: "[path] [--tool <gemini|qwen|codex>] [--regenerate] [--mode <full|partial>] [--cli-execute]"
allowed-tools: SlashCommand(*), TodoWrite(*), Bash(*), Read(*), Write(*)
---

# Memory SKILL Package Generator

## Orchestrator Role

**This command is a pure orchestrator**: Execute documentation generation workflow, then generate SKILL.md index. Does NOT create task JSON files.

**Execution Model - Auto-Continue Workflow**:

This workflow runs **fully autonomously** once triggered. Each phase completes and automatically triggers the next phase.

1. **User triggers**: `/memory:skill-memory [path] [options]`
2. **Phase 1 executes** → Parse arguments and prepare → Auto-continues
3. **Phase 2 executes** → Call `/memory:docs` to plan documentation → Auto-continues
4. **Phase 3 executes** → Call `/workflow:execute` to generate docs → Auto-continues
5. **Phase 4 executes** → Generate SKILL.md index → Reports completion

**Auto-Continue Mechanism**:
- TodoList tracks current phase status (in_progress/completed)
- After each phase completion, check TodoList and automatically execute next pending phase
- All phases run autonomously without user interaction
- Progress updates shown at each phase for visibility
- Each phase MUST update TodoWrite before triggering next phase

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Task JSON**: This command does not create task JSON files - delegates to /memory:docs
3. **Parse Every Output**: Extract required data from each command output (session_id, task_count, file paths)
4. **Auto-Continue via TodoList**: After completing each phase:
   - Update TodoWrite to mark current phase completed
   - Mark next phase as in_progress
   - Immediately execute next phase (no waiting for user input)
   - Check TodoList to identify next pending phase automatically
5. **Track Progress**: Update TodoWrite after EVERY phase completion before starting next phase
6. **Direct Generation**: Phase 4 directly generates SKILL.md using Write tool
7. **No Manual Steps**: User should never be prompted for decisions between phases - fully autonomous execution

## 4-Phase Execution

### Phase 1: Prepare Arguments

**Goal**: Parse command arguments and check existing documentation

**Step 1: Get Target Path and Project Name**
```bash
# Get current directory (or use provided path)
bash(pwd)

# Get project name from directory
bash(basename "$(pwd)")

# Get project root
bash(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

**Output**:
- `target_path`: `/d/my_project`
- `project_name`: `my_project`
- `project_root`: `/d/my_project`

**Step 2: Set Default Parameters**
```bash
# Default values (use these unless user specifies otherwise):
# - tool: "gemini"
# - mode: "full"
# - regenerate: false (no --regenerate flag)
# - cli_execute: false (no --cli-execute flag)
```

**Step 3: Check Existing Documentation**
```bash
# Check if docs directory exists (replace project_name with actual value)
bash(test -d .workflow/docs/my_project && echo "exists" || echo "not_exists")

# Count existing documentation files
bash(find .workflow/docs/my_project -name "*.md" 2>/dev/null | wc -l || echo 0)
```

**Output**:
- `docs_exists`: `exists` or `not_exists`
- `existing_docs`: `5` (or `0` if no docs)

**Step 4: Handle --regenerate Flag (If Specified)**
```bash
# If user specified --regenerate, delete existing docs directory
bash(rm -rf .workflow/docs/my_project 2>/dev/null || true)

# Verify deletion
bash(test -d .workflow/docs/my_project && echo "still_exists" || echo "deleted")
```

**Summary**:
- `PROJECT_NAME`: `my_project`
- `TARGET_PATH`: `/d/my_project`
- `DOCS_PATH`: `.workflow/docs/my_project`
- `TOOL`: `gemini` (default) or user-specified
- `MODE`: `full` (default) or user-specified
- `CLI_EXECUTE`: `false` (default) or `true` if --cli-execute flag
- `REGENERATE`: `false` (default) or `true` if --regenerate flag
- `EXISTING_DOCS`: `0` (after regenerate) or actual count

**Completion Criteria**:
- All parameters extracted and validated
- Project name and paths confirmed
- Existing docs count retrieved (or 0 after regenerate)
- Default values set for unspecified parameters

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Display preparation results → **Automatically continue to Phase 2** (no user input required)

---

### Phase 2: Call /memory:docs

**Goal**: Trigger documentation generation workflow

**Command**:
```bash
SlashCommand(command="/memory:docs [targetPath] --tool [tool] --mode [mode] [--cli-execute]")
```

**Example**:
```bash
/memory:docs /d/my_app --tool gemini --mode full
/memory:docs /d/my_app --tool gemini --mode full --cli-execute
```

**Note**: The `--regenerate` flag is handled in Phase 1 by deleting existing documentation. This command always calls `/memory:docs` without the regenerate flag, relying on docs.md's built-in update detection.

**Input**:
- `targetPath` from Phase 1
- `tool` from Phase 1
- `mode` from Phase 1
- `cli_execute` from Phase 1 (optional)

**Parse Output**:
- Extract session ID pattern: `WFS-docs-[timestamp]` (store as `docsSessionId`)
- Extract task count (store as `taskCount`)

**Completion Criteria**:
- `/memory:docs` command executed successfully
- Session ID extracted: `WFS-docs-[timestamp]`
- Task count retrieved from output
- Task files created in `.workflow/[docsSessionId]/.task/`
- workflow-session.json exists in session directory

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Display docs planning results (session ID, task count) → **Automatically continue to Phase 3** (no user input required)

---

### Phase 3: Execute Documentation Generation

**Goal**: Execute documentation generation tasks

**Command**:
```bash
SlashCommand(command="/workflow:execute")
```

**Note**: `/workflow:execute` automatically discovers active session from Phase 2

**Completion Criteria**:
- `/workflow:execute` command executed successfully
- Documentation files generated in `.workflow/docs/[projectName]/`
- All tasks marked as completed in session
- At minimum, module documentation files exist (API.md and/or README.md)
- For full mode: Project README, ARCHITECTURE, EXAMPLES files generated

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**After Phase 3**: Display execution results (file count, module count) → **Automatically continue to Phase 4** (no user input required)

---

### Phase 4: Generate SKILL.md Index

**Step 1: Read Key Files** (Use Read tool)
- `.workflow/docs/{project_name}/README.md` (required)
- `.workflow/docs/{project_name}/ARCHITECTURE.md` (optional)

**Step 2: Discover Structure**
```bash
bash(find .workflow/docs/{project_name} -name "*.md" | sed 's|.workflow/docs/{project_name}/||' | awk -F'/' '{if(NF>=2) print $1"/"$2}' | sort -u)
```

**Step 3: Generate Intelligent Description**

Extract from README + structure: Function (capabilities), Modules (names), Keywords (API/CLI/auth/etc.)

**Format**: `{Function}. Use when {trigger conditions}.`
**Example**: "Workflow management with CLI tools. Use when working with workflow orchestration or docs generation."

**Step 4: Write SKILL.md** (Use Write tool)
```bash
bash(mkdir -p .claude/skills/{project_name})
```

`.claude/skills/{project_name}/SKILL.md`:
```yaml
---
name: {project_name}
description: {intelligent description from Step 3}
version: 1.0.0
---
# {Project Name} SKILL Package

## Documentation: `../../.workflow/docs/{project_name}/`

## Progressive Loading
### Level 0: Quick Start (~2K)
- [README](../../.workflow/docs/{project_name}/README.md)
### Level 1: Core Modules (~8K)
{Module READMEs}
### Level 2: Complete (~25K)
All modules + [Architecture](../../.workflow/docs/{project_name}/ARCHITECTURE.md)
### Level 3: Deep Dive (~40K)
Everything + [Examples](../../.workflow/docs/{project_name}/EXAMPLES.md)
```

**Completion Criteria**:
- SKILL.md file created at `.claude/skills/{project_name}/SKILL.md`
- Intelligent description generated from documentation
- Progressive loading levels (0-3) properly structured
- Module index includes all documented modules
- All file references use relative paths

**TodoWrite**: Mark phase 4 completed

**After Phase 4**: Workflow complete → **Report final summary to user**

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

**Auto-Continue Logic**: After updating TodoWrite at end of each phase, immediately check for next pending task and execute it.

```javascript
// Initialize (before Phase 1)
// FIRST ACTION: Create TodoList with all 4 phases
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "in_progress", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "pending", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "pending", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})
// SECOND ACTION: Execute Phase 1 immediately

// After Phase 1 completes
// Update TodoWrite: Mark Phase 1 completed, Phase 2 in_progress
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "in_progress", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "pending", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})
// NEXT ACTION: Auto-continue to Phase 2 (execute /memory:docs command)

// After Phase 2 completes
// Update TodoWrite: Mark Phase 2 completed, Phase 3 in_progress
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "completed", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "in_progress", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "pending", "activeForm": "Generating SKILL.md"}
]})
// NEXT ACTION: Auto-continue to Phase 3 (execute /workflow:execute command)

// After Phase 3 completes
// Update TodoWrite: Mark Phase 3 completed, Phase 4 in_progress
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "completed", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "completed", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "in_progress", "activeForm": "Generating SKILL.md"}
]})
// NEXT ACTION: Auto-continue to Phase 4 (generate SKILL.md)

// After Phase 4 completes
// Update TodoWrite: Mark Phase 4 completed
TodoWrite({todos: [
  {"content": "Parse arguments and prepare", "status": "completed", "activeForm": "Parsing arguments"},
  {"content": "Call /memory:docs to plan documentation", "status": "completed", "activeForm": "Calling /memory:docs"},
  {"content": "Execute documentation generation", "status": "completed", "activeForm": "Executing documentation"},
  {"content": "Generate SKILL.md index", "status": "completed", "activeForm": "Generating SKILL.md"}
]})
// FINAL ACTION: Report completion summary to user
```

## Auto-Continue Execution Flow

**Critical Implementation Rules**:

1. **No User Prompts Between Phases**: Never ask user questions or wait for input between phases
2. **Immediate Phase Transition**: After TodoWrite update, immediately execute next phase command
3. **Status-Driven Execution**: Check TodoList status after each phase:
   - If next task is "pending" → Mark it "in_progress" and execute
   - If all tasks are "completed" → Report final summary
4. **Phase Completion Pattern**:
   ```
   Phase N completes → Update TodoWrite (N=completed, N+1=in_progress) → Execute Phase N+1
   ```

**Execution Sequence**:
```
User triggers command
  ↓
[TodoWrite] Initialize 4 phases (Phase 1 = in_progress)
  ↓
[Execute] Phase 1: Parse arguments
  ↓
[TodoWrite] Phase 1 = completed, Phase 2 = in_progress
  ↓
[Execute] Phase 2: Call /memory:docs
  ↓
[TodoWrite] Phase 2 = completed, Phase 3 = in_progress
  ↓
[Execute] Phase 3: Call /workflow:execute
  ↓
[TodoWrite] Phase 3 = completed, Phase 4 = in_progress
  ↓
[Execute] Phase 4: Generate SKILL.md
  ↓
[TodoWrite] Phase 4 = completed
  ↓
[Report] Display completion summary
```

**Error Handling**:
- If any phase fails, mark it as "in_progress" (not completed)
- Report error details to user
- Do NOT auto-continue to next phase on failure

---

## Parameters

```bash
/memory:skill-memory [path] [--tool <gemini|qwen|codex>] [--regenerate] [--mode <full|partial>] [--cli-execute]
```

- **path**: Target directory (default: current directory)
- **--tool**: CLI tool for documentation (default: gemini)
  - `gemini`: Comprehensive documentation
  - `qwen`: Architecture analysis
  - `codex`: Implementation validation
- **--regenerate**: Force regenerate all documentation
  - When enabled: Deletes existing `.workflow/docs/{project_name}/` before regeneration
  - Ensures fresh documentation from source code
- **--mode**: Documentation mode (default: full)
  - `full`: Complete docs (modules + README + ARCHITECTURE + EXAMPLES)
  - `partial`: Module docs only
- **--cli-execute**: Enable CLI-based documentation generation (optional)
  - When enabled: CLI generates docs directly in implementation_approach
  - When disabled (default): Agent generates documentation content

## Examples

### Example 1: Generate SKILL Package (Default)

```bash
/memory:skill-memory
```

**Workflow**:
1. Phase 1: Detects current directory, checks existing docs
2. Phase 2: Calls `/memory:docs . --tool gemini --mode full` (Agent Mode)
3. Phase 3: Executes documentation generation via `/workflow:execute`
4. Phase 4: Generates SKILL.md at `.claude/skills/{project_name}/SKILL.md`

### Example 2: Regenerate with Qwen

```bash
/memory:skill-memory /d/my_app --tool qwen --regenerate
```

**Workflow**:
1. Phase 1: Parses target path, detects regenerate flag
2. Phase 2: Calls `/memory:docs /d/my_app --tool qwen --mode full` (regenerate handled in Phase 1)
3. Phase 3: Executes documentation regeneration
4. Phase 4: Generates updated SKILL.md

### Example 3: Partial Mode (Modules Only)

```bash
/memory:skill-memory --mode partial
```

**Workflow**:
1. Phase 1: Detects partial mode
2. Phase 2: Calls `/memory:docs . --tool gemini --mode partial` (Agent Mode)
3. Phase 3: Executes module documentation only
4. Phase 4: Generates SKILL.md with module-only index

### Example 4: CLI Execute Mode

```bash
/memory:skill-memory --cli-execute
```

**Workflow**:
1. Phase 1: Detects CLI execute mode
2. Phase 2: Calls `/memory:docs . --tool gemini --mode full --cli-execute` (CLI Mode)
3. Phase 3: Executes CLI-based documentation generation
4. Phase 4: Generates SKILL.md at `.claude/skills/{project_name}/SKILL.md`

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
