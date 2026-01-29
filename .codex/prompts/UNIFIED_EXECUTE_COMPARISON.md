# Unified-Execute-With-File: Claude vs Codex Versions

## Overview

Two complementary implementations of the universal execution engine:

| Aspect | Claude CLI Command | Codex Prompt |
|--------|-------------------|--------------|
| **Location** | `.claude/commands/workflow/` | `.codex/prompts/` |
| **Format** | YAML frontmatter + Markdown | Simple Markdown + Variables |
| **Execution** | `/workflow:unified-execute-with-file` | Direct Codex execution |
| **Lines** | 807 (optimized) | 722 (adapted) |
| **Parameters** | CLI flags (`-y`, `-p`, `-m`) | Substitution variables (`$PLAN_PATH`, etc) |

---

## Format Differences

### Claude Version (CLI Command)

**Header (YAML)**:
```yaml
---
name: unified-execute-with-file
description: Universal execution engine...
argument-hint: "[-y|--yes] [-p|--plan <path>] [-m|--mode sequential|parallel]"
allowed-tools: TodoWrite(*), Task(*), ...
---
```

**Parameters**: CLI-style flags with short forms
```bash
/workflow:unified-execute-with-file -y -p PLAN_PATH -m parallel
```

### Codex Version (Prompt)

**Header (Simple)**:
```yaml
---
description: Universal execution engine...
argument-hint: "PLAN_PATH=\"<path>\" [EXECUTION_MODE=\"sequential|parallel\"]"
---
```

**Parameters**: Variable substitution with named arguments
```
PLAN_PATH=".workflow/IMPL_PLAN.md"
EXECUTION_MODE="parallel"
AUTO_CONFIRM="yes"
```

---

## Functional Equivalence

### Core Features (Identical)

Both versions support:
- ✅ Format-agnostic plan parsing (IMPL_PLAN.md, synthesis.json, conclusions.json)
- ✅ Multi-agent orchestration (code-developer, test-fix-agent, doc-generator, etc)
- ✅ Automatic dependency resolution with topological sort
- ✅ Parallel execution with wave-based grouping (max 3 tasks/wave)
- ✅ Unified event logging (execution-events.md as SINGLE SOURCE OF TRUTH)
- ✅ Knowledge chain: agents read all previous executions
- ✅ Incremental execution with resume capability
- ✅ Error handling: retry/skip/abort logic
- ✅ Session management and folder organization

### Session Structure (Identical)

Both create:
```
.workflow/.execution/{executionId}/
├── execution.md              # Execution plan and status
└── execution-events.md       # Unified execution log (SINGLE SOURCE OF TRUTH)
```

---

## Key Adaptations

### Claude CLI Version

**Optimizations**:
- Direct access to Claude Code tools (TodoWrite, Task, AskUserQuestion)
- CLI tool integration (`ccw cli`)
- Background agent execution with run_in_background flag
- Direct file system operations via Bash

**Structure**:
- Comprehensive Implementation Details section
- Explicit allowed-tools configuration
- Integration with workflow command system

### Codex Version

**Adaptations**:
- Simplified execution context (no direct tool access)
- Variable substitution for parameter passing
- Streamlined phase explanations
- Focused on core logic and flow
- Self-contained event logging

**Benefits**:
- Works with Codex's execution model
- Simpler parameter interface
- 85 fewer lines while maintaining all core functionality

---

## Parameter Mapping

| Concept | Claude | Codex |
|---------|--------|-------|
| Plan path | `-p path/to/plan.md` | `PLAN_PATH="path/to/plan.md"` |
| Execution mode | `-m sequential\|parallel` | `EXECUTION_MODE="sequential\|parallel"` |
| Auto-confirm | `-y, --yes` | `AUTO_CONFIRM="yes"` |
| Context focus | `"execution context"` | `EXECUTION_CONTEXT="focus area"` |

---

## Recommended Usage

### Use Claude Version When:
- Using Claude Code CLI environment
- Need direct integration with workflow system
- Want full tool access (TodoWrite, Task, AskUserQuestion)
- Prefer CLI flag syntax
- Building multi-command workflows

### Use Codex Version When:
- Executing within Codex directly
- Need simpler execution model
- Prefer variable substitution
- Want standalone execution
- Integrating with Codex command chains

---

## Event Logging (Unified)

Both versions produce identical execution-events.md format:

```markdown
## Task {id} - {STATUS} {emoji}

**Timestamp**: {ISO8601}
**Duration**: {ms}
**Agent**: {agent_type}

### Execution Summary
{summary}

### Generated Artifacts
- `path/to/file` (size)

### Notes for Next Agent
- Key decisions
- Issues identified
- Ready for: NEXT_TASK_ID

---
```

---

## Migration Path

If switching between Claude and Codex versions:

1. **Same session ID format**: Both use `.workflow/.execution/{executionId}/`
2. **Same event log structure**: execution-events.md is 100% compatible
3. **Same artifact locations**: Files generated at project paths (e.g., `src/types/auth.ts`)
4. **Same agent selection**: Both use identical selectBestAgent() strategy
5. **Same parallelization rules**: Identical wave grouping and file conflict detection

You can:
- Start execution with Claude, resume with Codex
- Start with Codex, continue with Claude
- Mix both in multi-step workflows

---

## Statistics

| Metric | Claude | Codex |
|--------|--------|-------|
| **Lines** | 807 | 722 |
| **Size** | 25 KB | 22 KB |
| **Phases** | 4 full phases | 4 phases (adapted) |
| **Agent types** | 6+ supported | 6+ supported |
| **Parallelization** | Max 3 tasks/wave | Max 3 tasks/wave |
| **Error handling** | retry/skip/abort | retry/skip/abort |

---

## Implementation Timeline

1. **Initial Claude version**: Full unified-execute-with-file.md (1094 lines)
2. **Claude optimization**: Consolidated duplicates (807 lines, -26%)
3. **Codex adaptation**: Format-adapted version (722 lines)

Both versions represent same core logic with format-specific optimizations.

