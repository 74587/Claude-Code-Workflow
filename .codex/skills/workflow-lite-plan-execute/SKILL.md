---
name: workflow-lite-plan-execute
description: Lightweight planning + execution workflow. Serial CLI exploration → Search verification → Clarification → Planning → .task/*.json multi-file output → Execution via unified-execute.
allowed-tools: AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Planning Workflow

Lite Plan produces `.task/TASK-*.json` (one file per task) implementation plan via serial CLI exploration and direct planning, then hands off to unified-execute-with-file for task execution.

> **Schema**: `cat ~/.ccw/workflows/cli-templates/schemas/task-schema.json`

## Key Design Principles

1. **Serial Execution**: All phases execute serially inline, no agent delegation
2. **CLI Exploration**: Multi-angle codebase exploration via `ccw cli` calls (default gemini, fallback claude)
3. **Search Verification**: Verify CLI findings with ACE search / Grep / Glob before incorporating
4. **Multi-File Task Output**: Produces `.task/TASK-*.json` (one file per task) compatible with `collaborative-plan-with-file` and `unified-execute-with-file`
5. **Progressive Phase Loading**: Only load phase docs when about to execute

## Auto Mode

When `--yes` or `-y`:
- Auto-approve plan and use default execution settings
- Skip non-critical clarifications; still ask minimal clarifications if required for safety/correctness

## Usage (Pseudo)

This section describes the skill input shape; actual invocation depends on the host runtime.

```
$workflow-lite-plan-execute <task description>
$workflow-lite-plan-execute [FLAGS] "<task description or file path>"

# Flags
-y, --yes                              Skip confirmations (auto mode)
-e, --explore                          Force exploration phase
```

Examples:
```
$workflow-lite-plan-execute "Implement JWT authentication"
$workflow-lite-plan-execute -y "Add user profile page"
$workflow-lite-plan-execute -e "Refactor payment module"
$workflow-lite-plan-execute "docs/todo.md"
```

> **Implementation sketch**: 编排器内部使用 `$workflow-lite-plan-execute "..."` 接口调用，此为伪代码示意，非命令行语法。

## Phase Reference Documents (Read On Demand)

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | `phases/01-lite-plan.md` | Serial CLI exploration, clarification, plan generation → .task/TASK-*.json |
| 2 | `phases/02-lite-execute.md` | Handoff to unified-execute-with-file for task execution |

## Orchestrator Logic

```javascript
// Flag parsing
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')

// Task extraction rule:
// - Strip known flags: -y/--yes, -e/--explore
// - Remaining args are joined as the task description
// - Treat it as a file path ONLY if (a) exactly one arg remains AND (b) the path exists
function extractTaskDescription(args) {
  const knownFlags = new Set(['--yes', '-y', '--explore', '-e'])
  const rest = args.filter(a => !knownFlags.has(a))
  if (rest.length === 1 && file_exists(rest[0])) return rest[0]
  return rest.join(' ').trim()
}

const taskDescription = extractTaskDescription($ARGUMENTS)

// Phase 1: Lite Plan → .task/TASK-*.json
Read('phases/01-lite-plan.md')
// Execute planning phase...

// Gate: only continue when confirmed (or --yes)
if (planResult?.userSelection?.confirmation !== 'Allow' && !autoYes) {
  // Stop: user cancelled or requested modifications
  return
}

// Phase 2: Handoff to unified-execute-with-file
Read('phases/02-lite-execute.md')
// Invoke unified-execute-with-file with .task/ directory path
```

## Output Contract

Phase 1 produces `.task/TASK-*.json` (one file per task) — compatible with `collaborative-plan-with-file` and consumable by `unified-execute-with-file`.

> **Schema**: `cat ~/.ccw/workflows/cli-templates/schemas/task-schema.json`

**Output Directory**: `{projectRoot}/.workflow/.lite-plan/{session-id}/`

```
{projectRoot}/.workflow/.lite-plan/{session-id}/
├── exploration-{angle1}.md            # Per-angle CLI exploration results
├── exploration-{angle2}.md            # (1-4 files based on complexity)
├── explorations-manifest.json         # Exploration index
├── exploration-notes.md               # Synthesized exploration notes
├── requirement-analysis.json          # Complexity assessment
├── .task/                             # ⭐ Task JSON files (one per task)
│   ├── TASK-001.json                  # Individual task definition
│   ├── TASK-002.json
│   └── ...
└── plan.md                            # Human-readable summary
```

**Task JSON Format** (one file per task, following task-schema.json):

```javascript
// File: .task/TASK-001.json
{
  "id": "TASK-001",
  "title": "string",
  "description": "string",
  "type": "feature|fix|refactor|enhancement|testing|infrastructure",
  "priority": "high|medium|low",
  "effort": "small|medium|large",
  "scope": "string",
  "depends_on": ["TASK-xxx"],
  "convergence": {
    "criteria": ["string"],        // Testable conditions
    "verification": "string",      // Executable command or manual steps
    "definition_of_done": "string" // Business language
  },
  "files": [{
    "path": "string",
    "action": "modify|create|delete",
    "changes": ["string"],
    "conflict_risk": "low|medium|high"
  }],
  "source": {
    "tool": "workflow-lite-plan-execute",
    "session_id": "string",
    "original_id": "string"
  }
}
```

## TodoWrite Pattern

Initialization:
```json
[
  {"content": "Lite Plan - Planning", "status": "in_progress", "activeForm": "Planning"},
  {"content": "Execution (unified-execute)", "status": "pending", "activeForm": "Executing tasks"}
]
```

After planning completes:
```json
[
  {"content": "Lite Plan - Planning", "status": "completed", "activeForm": "Planning"},
  {"content": "Execution (unified-execute)", "status": "in_progress", "activeForm": "Executing tasks"}
]
```

## Core Rules

1. **Planning phase NEVER modifies project code** — it may write planning artifacts, but all implementation is delegated to unified-execute
2. **All phases serial, no agent delegation** — everything runs inline, no spawn_agent
3. **CLI exploration with search verification** — CLI calls produce findings, ACE/Grep/Glob verify them
4. **`.task/*.json` is the output contract** — individual task JSON files passed to unified-execute-with-file
5. **Progressive loading**: Read phase doc only when about to execute
6. **File-path detection**: Treat input as a file path only if the path exists; do not infer from file extensions

## Error Handling

| Error | Resolution |
|-------|------------|
| CLI exploration failure | Skip angle, continue with remaining; fallback gemini → claude |
| Planning phase failure | Display error, offer retry |
| .task/ directory empty | Error: planning phase did not produce output |
| Phase file not found | Error with file path for debugging |

## Related Skills

- Collaborative planning: `../collaborative-plan-with-file/SKILL.md`
- Unified execution: `../unified-execute-with-file/SKILL.md`
- Full planning workflow: `../workflow-plan-execute/SKILL.md`
