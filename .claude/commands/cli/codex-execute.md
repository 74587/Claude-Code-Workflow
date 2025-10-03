---
name: codex-execute
description: Automated task decomposition and execution with Codex using resume mechanism
usage: /cli:codex-execute [--verify-git] <task-description|task-id>
argument-hint: "[--verify-git] task description or task-id"
examples:
  - /cli:codex-execute "implement user authentication system"
  - /cli:codex-execute --verify-git "refactor API layer"
  - /cli:codex-execute IMPL-001
allowed-tools: SlashCommand(*), Bash(*), TodoWrite(*), Read(*), Glob(*)
---

# CLI Codex Execute Command (/cli:codex-execute)

## Purpose

Automated task decomposition and sequential execution with Codex, using `codex exec "..." resume --last` mechanism for continuity between subtasks.

**Input**: User description or task ID (automatically loads from `.task/[ID].json` if applicable)
**Reference**: @~/.claude/workflows/intelligent-tools-strategy.md for Codex details

## Core Workflow

```
Task Input → Decompose into Subtasks → TodoWrite Tracking →
For Each Subtask:
  1. Execute with Codex
  2. [Optional] Git verification
  3. Mark complete in TodoWrite
  4. Resume next subtask with `codex resume --last`
→ Final Summary
```

## Parameters

- `<input>` (Required): Task description or task ID (e.g., "implement auth" or "IMPL-001")
  - If input matches task ID format, loads from `.task/[ID].json`
  - Otherwise, uses input as task description
- `--verify-git` (Optional): Verify git status after each subtask completion

## Execution Flow

### Phase 1: Input Processing & Decomposition

1. **Parse Input**:
   - Check if input matches task ID pattern (e.g., `IMPL-001`, `TASK-123`)
   - If yes: Load from `.task/[ID].json` and extract requirements
   - If no: Use input as task description directly

2. **Analyze & Decompose**:
   - Analyze task complexity and scope
   - Break down into 3-8 subtasks
   - Create TodoWrite tracker with all subtasks
   - Display decomposition for user review

**Decomposition Criteria**:
- Each subtask: 5-15 minutes completable
- Clear, testable outcomes
- Explicit dependencies
- Focused file scope (1-5 files per subtask)

### Phase 2: Sequential Execution

**For First Subtask**:
```bash
# Initial execution (no resume needed)
codex -C [dir] --full-auto exec "
PURPOSE: [task goal]
TASK: [subtask 1 description]
CONTEXT: @{relevant_files} @{CLAUDE.md}
EXPECTED: [specific deliverables]
RULES: [constraints]
Subtask 1 of N: [subtask title]
" --skip-git-repo-check -s danger-full-access
```

**For Subsequent Subtasks** (using resume --last):
```bash
# Resume previous session for context continuity
codex exec "
CONTINUE TO NEXT SUBTASK:
Subtask N of M: [subtask title]

PURPOSE: [continuation goal]
TASK: [subtask N description]
CONTEXT: Previous work completed, now focus on @{new_relevant_files}
EXPECTED: [specific deliverables]
RULES: Build on previous subtask, maintain consistency
" resume --last --skip-git-repo-check -s danger-full-access
```

### Phase 3: Verification (if --verify-git enabled)

After each subtask completion:
```bash
# Check git status
git status --short

# Verify expected changes
git diff --stat

# Optional: Check for untracked files that should be committed
git ls-files --others --exclude-standard
```

**Verification Checks**:
- Files modified match subtask scope
- No unexpected changes in unrelated files
- No merge conflicts or errors
- Code compiles/runs (if applicable)

### Phase 4: TodoWrite Tracking

**Initial Setup**:
```javascript
TodoWrite({
  todos: [
    { content: "Subtask 1: [description]", status: "in_progress", activeForm: "Executing subtask 1" },
    { content: "Subtask 2: [description]", status: "pending", activeForm: "Executing subtask 2" },
    { content: "Subtask 3: [description]", status: "pending", activeForm: "Executing subtask 3" },
    // ... more subtasks
    { content: "Final verification and summary", status: "pending", activeForm: "Verifying and summarizing" }
  ]
})
```

**After Each Subtask**:
```javascript
TodoWrite({
  todos: [
    { content: "Subtask 1: [description]", status: "completed", activeForm: "Executing subtask 1" },
    { content: "Subtask 2: [description]", status: "in_progress", activeForm: "Executing subtask 2" },
    // ... update status
  ]
})
```

## Codex Resume Mechanism

**Why `codex resume --last`?**
- Maintains conversation context across subtasks
- Codex remembers previous decisions and patterns
- Reduces context repetition
- Ensures consistency in implementation style

**How It Works**:
1. First subtask creates new Codex session
2. After completion, session is saved
3. Subsequent subtasks use `codex resume --last` to continue
4. Each subtask builds on previous context
5. Final subtask completes full task

**Image Support**:
```bash
# First subtask with design reference
codex -C [dir] -i design.png --full-auto exec "..." --skip-git-repo-check -s danger-full-access

# Resume for next subtask (image context preserved)
codex exec "CONTINUE TO NEXT SUBTASK: ..." resume --last --skip-git-repo-check -s danger-full-access
```

## Error Handling

**Subtask Failure**:
1. Mark subtask as blocked in TodoWrite
2. Report error details to user
3. Pause execution for manual intervention
4. User can choose to:
   - Retry current subtask
   - Continue to next subtask
   - Abort entire task

**Git Verification Failure** (if --verify-git):
1. Show unexpected changes
2. Pause execution
3. Request user decision:
   - Continue anyway
   - Rollback and retry
   - Manual fix

**Codex Session Lost**:
1. Detect if `codex exec "..." resume --last` fails
2. Attempt retry with fresh session
3. Report to user if manual intervention needed

## Output Format

**During Execution**:
```
📋 Task Decomposition:
  1. [Subtask 1 description]
  2. [Subtask 2 description]
  ...

▶️  Executing Subtask 1/N: [title]
  Codex session started...
  [Codex output]
  ✅ Subtask 1 completed

🔍 Git Verification:
  M  src/file1.ts
  A  src/file2.ts
  ✅ Changes verified

▶️  Executing Subtask 2/N: [title]
  Resuming Codex session...
  [Codex output]
  ✅ Subtask 2 completed
...

✅ All Subtasks Completed
📊 Summary: [file references, changes, next steps]
```

**Final Summary**:
```markdown
# Task Execution Summary: [Task Description]

## Subtasks Completed
1. ✅ [Subtask 1]: [files modified]
2. ✅ [Subtask 2]: [files modified]
...

## Files Modified
- src/file1.ts:10-50 - [changes]
- src/file2.ts - [changes]

## Git Status
- N files modified
- M files added
- No conflicts

## Next Steps
- [Suggested follow-up actions]
```

## Examples

**Example 1: Simple Task**
```bash
/cli:codex-execute "implement user authentication system"

# Decomposes into:
# 1. Create user model and database schema
# 2. Implement JWT token generation
# 3. Create authentication middleware
# 4. Add login/logout endpoints
# 5. Write tests for auth flow
```

**Example 2: With Git Verification**
```bash
/cli:codex-execute --verify-git "refactor API layer to use dependency injection"

# After each subtask, verifies:
# - Only expected files modified
# - No breaking changes in unrelated code
# - Tests still pass
```

**Example 3: With Task ID**
```bash
/cli:codex-execute IMPL-001

# Loads task from .task/IMPL-001.json
# Decomposes based on task requirements
```

## Best Practices

1. **Subtask Granularity**: Keep subtasks small and focused
2. **Clear Boundaries**: Each subtask should have well-defined input/output
3. **Git Hygiene**: Use `--verify-git` for critical refactoring
4. **Context Continuity**: Let `codex resume --last` maintain context
5. **Recovery Points**: TodoWrite provides clear progress tracking
6. **Image References**: Attach design files for UI tasks

## Input Processing

**Automatic Detection**:
- Input matches task ID pattern → Load from `.task/[ID].json`
- Otherwise → Use as task description

**Task JSON Structure** (when loading from file):
```json
{
  "task_id": "IMPL-001",
  "title": "Implement user authentication",
  "description": "Create JWT-based auth system",
  "acceptance_criteria": [...],
  "scope": {...},
  "brainstorming_refs": [...]
}
```

**Save Results**:
- Execution log: `.chat/codex-execute-[timestamp].md` (if workflow active)
- Summary: `.summaries/[TASK-ID]-summary.md` (if task ID provided)
- TodoWrite tracking embedded in session

## Notes

**vs. `/cli:execute`**:
- `/cli:execute`: Single-shot execution with Gemini/Qwen/Codex
- `/cli:codex-execute`: Multi-stage Codex execution with automatic task decomposition and resume mechanism

**Input Flexibility**: Accepts both freeform descriptions and task IDs (auto-detects and loads JSON)

**Context Window**: `codex exec "..." resume --last` maintains conversation history, ensuring consistency across subtasks without redundant context injection.
