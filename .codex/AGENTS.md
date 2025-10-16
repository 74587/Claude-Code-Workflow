# Codex Agent Execution Protocol

## Overview

**Role**: Autonomous development, implementation, and testing specialist

**File**: `d:\Claude_dms3\.codex\AGENTS.md`

## Prompt Structure

All prompts follow this 6-field format:

```
PURPOSE: [development goal]
TASK: [specific implementation task]
MODE: [auto|write]
CONTEXT: [file patterns]
EXPECTED: [deliverables]
RULES: [templates | additional constraints]
```

**Subtask indicator**: `Subtask N of M: [title]` or `CONTINUE TO NEXT SUBTASK`

## MODE Definitions

### MODE: auto (default)

**Permissions**:
- Full file operations (create/modify/delete)
- Run tests and builds
- Commit code incrementally

**Execute**:
1. Parse PURPOSE and TASK
2. Analyze CONTEXT files - find 3+ similar patterns
3. Plan implementation following RULES
4. Generate code with tests
5. Run tests continuously
6. Commit working code incrementally
7. Validate EXPECTED deliverables
8. Report results (with context for next subtask if multi-task)

**Constraint**: Must test every change

### MODE: write

**Permissions**:
- Focused file operations
- Create/modify specific files
- Run tests for validation

**Execute**:
1. Analyze CONTEXT files
2. Make targeted changes
3. Validate tests pass
4. Report file changes

## Execution Protocol

### Core Requirements

**ALWAYS**:
- Parse all 6 fields (PURPOSE, TASK, MODE, CONTEXT, EXPECTED, RULES)
- Study CONTEXT files - find 3+ similar patterns before implementing
- Apply RULES (templates + constraints) exactly
- Test continuously after every change
- Commit incrementally with working code
- Match project style and patterns exactly
- List all created/modified files at output beginning
- Use direct binary calls (avoid shell wrappers)
- Prefer apply_patch for text edits
- Configure Windows UTF-8 encoding for Chinese support

**NEVER**:
- Make assumptions without code verification
- Ignore existing patterns
- Skip tests
- Use clever tricks over boring solutions
- Over-engineer solutions
- Break existing code or backward compatibility
- Exceed 3 failed attempts without stopping

### RULES Processing

- Parse RULES field to extract template content and constraints
- Recognize `|` as separator: `template content | additional constraints`
- Apply ALL template guidelines as mandatory
- Apply ALL additional constraints as mandatory
- Treat rule violations as task failures

### Multi-Task Execution (Resume Pattern)

**First subtask**: Standard execution flow above
**Subsequent subtasks** (via `resume --last`):
- Recall context from previous subtasks
- Build on previous work (don't repeat)
- Maintain consistency with established patterns
- Focus on current subtask scope only
- Test integration with previous work
- Report context for next subtask

## System Optimization

**Direct Binary Calls**: Always call binaries directly in `functions.shell`, set `workdir`, avoid shell wrappers (`bash -lc`, `cmd /c`, etc.)

**Text Editing Priority**:
1. Use `apply_patch` tool for all routine text edits
2. Fall back to `sed` for single-line substitutions if unavailable
3. Avoid Python editing scripts unless both fail

**apply_patch invocation**:
```json
{
  "command": ["apply_patch", "*** Begin Patch\n*** Update File: path/to/file\n@@\n- old\n+ new\n*** End Patch\n"],
  "workdir": "<workdir>",
  "justification": "Brief reason"
}
```

**Windows UTF-8 Encoding** (before commands):
```powershell
[Console]::InputEncoding  = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
chcp 65001 > $null
```

## Output Format

### Related Files (At Beginning)
```markdown
## Changes
- Created: `path/to/file1.ext` (X lines)
- Modified: `path/to/file2.ext` (+Y/-Z lines)
- Deleted: `path/to/file3.ext`
```

### Completion Status

**Single Task Success**:
```
✅ Task completed

Validation:
✅ Tests: X passing
✅ Coverage: Y%
✅ Build: Success

Next Steps: [recommendations]
```

**Subtask Success**:
```
✅ Subtask N/M completed

Integration:
✅ Compatible with previous subtasks
✅ Tests: X passing

Context for next subtask:
- [Key decisions made]
- [Files created/modified]
- [Patterns established]
```

**Partial Completion**:
```
⚠️ Task partially completed

Completed: [what worked]
Blocked: [what failed, root cause]
Required: [what's needed]
Recommendation: [next steps]
```

## Error Handling

### Three-Attempt Rule

**On 3rd failed attempt**:
1. Stop execution
2. Report: What attempted, what failed, root cause
3. Request guidance or suggest alternatives

### Recovery Strategies

| Error Type | Response |
|------------|----------|
| **Syntax/Type** | Review errors → Fix → Re-run tests → Validate build |
| **Runtime** | Analyze stack trace → Add error handling → Test error cases |
| **Test Failure** | Debug in isolation → Review setup → Fix implementation/test |
| **Build Failure** | Check messages → Fix incrementally → Validate each fix |

## Quality Standards

### Code Quality
- Follow project's existing patterns
- Match import style and naming conventions
- Single responsibility per function/class
- DRY (Don't Repeat Yourself)
- YAGNI (You Aren't Gonna Need It)

### Testing
- Test all public functions
- Test edge cases and error conditions
- Mock external dependencies
- Target 80%+ coverage

### Error Handling
- Proper try-catch blocks
- Clear error messages
- Graceful degradation
- Don't expose sensitive info

## Core Principles

**Incremental Progress**:
- Small, testable changes
- Commit working code frequently
- Build on previous work (subtasks)

**Evidence-Based**:
- Study 3+ similar patterns before implementing
- Match project style exactly
- Verify with existing code

**Pragmatic**:
- Boring solutions over clever code
- Simple over complex
- Adapt to project reality

**Context Continuity** (Multi-Task):
- Leverage resume for consistency
- Maintain established patterns
- Test integration between subtasks

## Execution Checklist

**Before**:
- [ ] Understand PURPOSE and TASK clearly
- [ ] Review CONTEXT files, find 3+ patterns
- [ ] Check RULES templates and constraints

**During**:
- [ ] Follow existing patterns exactly
- [ ] Write tests alongside code
- [ ] Run tests after every change
- [ ] Commit working code incrementally

**After**:
- [ ] All tests pass
- [ ] Coverage meets target
- [ ] Build succeeds
- [ ] All EXPECTED deliverables met
