---
role: executor
prefix: IMPL
inner_loop: false
discuss_rounds: []
input_artifact_types: [plan, spec, architecture]
message_types:
  success: impl_complete
  progress: impl_progress
  error: error
---

# Executor — Phase 2-4

**Role**: Implementation worker with team interaction protocol. Supports two execution modes: direct agent implementation or CLI delegation. Coordinator assigns mode per task via `Executor:` field.

## Phase 2: Parse Task & Resolve Execution Mode

**Objective**: Load task JSON, execute pre-analysis, resolve execution mode.

### 2.1 Extract from task description

- `Task file:` → `task_file` path
- `Session:` → `session` folder
- `Executor:` → `mode` (`agent` | `gemini` | `codex` | `qwen`)

### 2.2 Load task JSON (read task_file)

```
Task JSON Fields:
├── id, title, scope, action
├── description              → Implementation goal
├── files[]                  → Target files (path, target, change)
├── implementation[]         → Step-by-step execution instructions
├── convergence.criteria[]   → Done-when checklist
├── pre_analysis[]           → Context gathering steps (optional)
│   └── { step, action, commands[], output_to, on_error }
├── reference                → Pattern reference (pattern, files[], examples)
├── risks[]                  → Risk mitigations (optional)
├── rationale                → Approach rationale (optional)
└── depends_on[]             → (handled by coordinator, not executor)
```

### 2.3 Resolve execution mode (priority order)

| Priority | Source | Resolution |
|----------|--------|------------|
| 1 | Task description `Executor:` | Coordinator assignment |
| 2 | task.meta.execution_config.method | Per-task config from planner |
| 3 | plan.json recommended_execution | Plan-level default |
| 4 | Auto-select | Low complexity → agent; Medium/High → codex |

### 2.4 Execute pre_analysis (if exists, runs locally regardless of mode)

```
For each step in task.pre_analysis[]:
  → Parse step.commands[] using command-to-tool mapping:
    "Read(path)"           → Read tool
    "bash(command)"        → Bash tool
    "Search(pattern,path)" → Grep tool
    "Glob(pattern)"        → Glob tool
  → Store output in [step.output_to] variable
  → Handle errors per step.on_error (fail | continue | skip)
```

## Phase 3: Execute Implementation

Route by resolved execution mode:

### Mode: `agent` — Direct Implementation

Executor implements directly using Edit/Write/Bash tools. Follows code-developer patterns.

```
1. Read task.files[] as target files
2. Read task.implementation[] as step-by-step instructions
3. For each implementation step:
   - Substitute [variable_name] placeholders with pre_analysis results
   - For each file in step:
     * New file → Write tool
     * Modify file → Edit tool
   - Follow task.reference (pattern, files) for consistency
4. Apply task.rationale.chosen_approach
5. Mitigate task.risks[] during implementation
```

**Quality rules** (same as code-developer):
- Verify module/package existence before referencing (use Grep/Glob)
- Incremental progress — small working changes
- Follow existing code patterns from task.reference
- No premature abstractions
- ASCII-only, GBK-compatible

### Mode: `gemini` / `codex` / `qwen` — CLI Delegation

Build structured prompt from task JSON, delegate to CLI tool.

**Build handoff prompt**:

```javascript
function buildCliHandoffPrompt(task, preAnalysisResults) {
  const context = Object.entries(preAnalysisResults)
    .map(([key, value]) => `### ${key}\n${value}`)
    .join('\n\n')

  return `
PURPOSE: ${task.title}
${task.description}

## TARGET FILES
${task.files?.map(f => `- **${f.path}** → ${f.change}`).join('\n')}

## IMPLEMENTATION STEPS
${task.implementation?.map((s, i) => `${i+1}. ${s}`).join('\n')}

${context ? `## PRE-ANALYSIS CONTEXT\n${context}` : ''}

${task.reference ? `## REFERENCE\n- Pattern: ${task.reference.pattern}\n- Files: ${task.reference.files?.join(', ')}` : ''}

${task.rationale ? `## APPROACH\n${task.rationale.chosen_approach}` : ''}

${task.risks?.length ? `## RISKS\n${task.risks.map(r => `- ${r.description} → **${r.mitigation}**`).join('\n')}` : ''}

## DONE WHEN
${task.convergence?.criteria?.map(c => `- [ ] ${c}`).join('\n')}

MODE: write
CONSTRAINTS: Only modify files listed above | Follow existing patterns
`.trim()
}
```

**CLI call**:

```
Bash({
  command: `ccw cli -p "${buildCliHandoffPrompt(task, preAnalysisResults)}"
    --tool <cli_tool> --mode write --rule development-implement-feature`,
  run_in_background: false,
  timeout: 3600000
})
```

**Resume strategy** (if task.cli_execution exists):

| Strategy | Command |
|----------|---------|
| new | `--id <session>-<task_id>` |
| resume | `--resume <parent_id>` |
| fork | `--resume <parent_id> --id <new_id>` |
| merge_fork | `--resume <id1>,<id2> --id <new_id>` |

## Phase 4: Self-Validation

| Step | Method | Pass Criteria |
|------|--------|--------------|
| Convergence check | Match task.convergence.criteria vs output | All criteria addressed |
| Syntax check | `tsc --noEmit` or language-appropriate (30s) | Exit code 0 |
| Test detection | Find test files for modified files | Tests identified |

**Report**: task ID, status, mode used, files modified, convergence results.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Agent mode: syntax errors | Retry with error context (max 3) |
| CLI mode: execution failure | Retry, or resume with --resume |
| pre_analysis failure | Follow step.on_error (fail/continue/skip) |
| CLI tool unavailable | Fallback: gemini → qwen → codex |
| Max retries exceeded | Report failure to coordinator |
