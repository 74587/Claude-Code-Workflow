# Meta-Skill Template Update Summary

## Update Overview

Successfully updated all 17 meta-skill workflow templates with proper execution configuration and context passing.

## Critical Correction: CLI Tools vs Slash Commands

**IMPORTANT**: ALL workflow commands (`/workflow:*`) must use `slash-command` type.

### Slash Command (workflow commands)
- **Type**: `slash-command`
- **Commands**: ALL `/workflow:*` commands
  - Planning: plan, lite-plan, multi-cli-plan, tdd-plan
  - Execution: execute, lite-execute
  - Testing: test-fix-gen, test-cycle-execute, tdd-verify
  - Review: review-session-cycle, review-cycle-fix, review-module-cycle
  - Bug fixes: lite-fix, debug-with-file
  - Exploration: brainstorm-with-file, brainstorm:auto-parallel, analyze-with-file
- **Modes**:
  - `mainprocess`: Blocking, main process execution
  - `async`: Background execution via `ccw cli --tool claude --mode write`

### CLI Tools (for pure analysis/generation)
- **Type**: `cli-tools`
- **When to use**: Only when there's NO specific workflow command
- **Purpose**: Dynamic prompt generation based on task content
- **Tools**: gemini (analysis), qwen (code generation), codex (review)
- **Examples**:
  - "Analyze this architecture design and suggest improvements"
  - "Generate unit tests for module X with 90% coverage"
  - "Review code for security vulnerabilities"

## Key Changes

### 1. Schema Enhancement

All templates now include:
- **`execution`** configuration:
  - Type: Always `slash-command` for workflow commands
  - Mode: `mainprocess` (blocking) or `async` (background)
- **`contextHint`** field: Natural language instructions for context passing
- **`unit`** field: Groups commands into minimum execution units
- **`args`** field: Command arguments with `{{goal}}` and `{{prev}}` placeholders

### 2. Execution Patterns

**Planning (mainprocess)**:
- Interactive planning needs main process
- Examples: plan, lite-plan, tdd-plan, multi-cli-plan

**Execution (async)**:
- Long-running tasks need background
- Examples: execute, lite-execute, test-cycle-execute

**Review/Verify (mainprocess)**:
- Needs immediate feedback
- Examples: plan-verify, review-session-cycle, tdd-verify

**Fix (mainprocess/async)**:
- Simple fixes: mainprocess
- Complex fixes: async
- Examples: lite-fix (mainprocess), review-cycle-fix (mainprocess)

### 3. Minimum Execution Units

Preserved atomic command groups from ccw-coordinator.md:

| Unit | Commands | Purpose |
|------|----------|---------|
| `quick-implementation` | lite-plan → lite-execute | Lightweight implementation |
| `verified-planning-execution` | plan → plan-verify → execute | Full planning with verification |
| `bug-fix` | lite-fix → lite-execute | Bug diagnosis and fix |
| `test-validation` | test-fix-gen → test-cycle-execute | Test generation and validation |
| `code-review` | review-session-cycle → review-cycle-fix | Code review and fixes |
| `tdd-planning-execution` | tdd-plan → execute | Test-driven development |
| `multi-cli-planning` | multi-cli-plan → lite-execute | Multi-perspective planning |
| `issue-workflow` | issue:plan → issue:queue → issue:execute | Issue lifecycle |
| `rapid-to-issue` | lite-plan → convert-to-plan → queue → execute | Bridge lite to issue |
| `brainstorm-to-issue` | from-brainstorm → queue → execute | Bridge brainstorm to issue |

## Updated Templates

### Simple Workflows (Level 1-2)

1. **lite-lite-lite.json** - Ultra-lightweight direct execution
2. **bugfix-hotfix.json** - Urgent production fix (single async step)
3. **rapid.json** - Quick implementation with optional testing
4. **bugfix.json** - Bug fix with diagnosis and testing
5. **test-fix.json** - Fix failing tests workflow
6. **docs.json** - Documentation generation

### Complex Workflows (Level 3-4)

7. **tdd.json** - Test-driven development with verification
8. **coupled.json** - Full workflow with review and testing
9. **review.json** - Standalone code review workflow
10. **multi-cli-plan.json** - Multi-perspective planning
11. **full.json** - Comprehensive workflow with brainstorm

### Exploration Workflows

12. **brainstorm.json** - Multi-perspective ideation
13. **debug.json** - Hypothesis-driven debugging
14. **analyze.json** - Collaborative analysis

### Issue Workflows

15. **issue.json** - Full issue lifecycle
16. **rapid-to-issue.json** - Bridge lite plan to issue
17. **brainstorm-to-issue.json** - Bridge brainstorm to issue

## Design Principles Applied

1. **Slash Commands Only**: All workflow commands use `slash-command` type
2. **Minimum Execution Units**: Preserved atomic command groups
3. **Context Flow**: `contextHint` provides natural language guidance
4. **Execution Modes**:
   - `mainprocess`: Interactive, needs user feedback
   - `async`: Long-running, background execution

## CLI Tools Usage (Future Extension)

The `cli-tools` type is reserved for pure analysis/generation tasks WITHOUT specific workflow commands:

```json
{
  "name": "custom-analysis",
  "steps": [
    {
      "execution": {
        "type": "cli-tools",
        "mode": "mainprocess",
        "tool": "gemini",
        "cliMode": "analysis",
        "rule": "analysis-analyze-technical-document"
      },
      "contextHint": "Analyze architecture design and provide recommendations"
    }
  ]
}
```

**Note**: This is for future extension only. Current templates use slash commands exclusively.

## Files Modified

```
.claude/skills/meta-skill/templates/
├── rapid.json                 ✓ Updated (slash-command only)
├── coupled.json              ✓ Updated (slash-command only)
├── bugfix.json               ✓ Fixed (removed cli-tools)
├── bugfix-hotfix.json        ✓ Updated (slash-command only)
├── tdd.json                  ✓ Fixed (removed cli-tools)
├── test-fix.json             ✓ Updated (slash-command only)
├── review.json               ✓ Fixed (removed cli-tools)
├── brainstorm.json           ✓ Fixed (removed cli-tools)
├── debug.json                ✓ Fixed (removed cli-tools)
├── analyze.json              ✓ Fixed (removed cli-tools)
├── issue.json                ✓ Updated (slash-command only)
├── multi-cli-plan.json       ✓ Fixed (removed cli-tools)
├── docs.json                 ✓ Updated (slash-command only)
├── full.json                 ✓ Fixed (removed cli-tools)
├── rapid-to-issue.json       ✓ Updated (slash-command only)
├── brainstorm-to-issue.json  ✓ Updated (slash-command only)
├── lite-lite-lite.json       ✓ Updated (slash-command only)
├── coupled-enhanced.json     ✗ Removed (experimental)
└── rapid-cli.json            ✗ Removed (experimental)
```

## Result

All 17 templates now correctly use:
- ✅ `slash-command` type exclusively
- ✅ Flexible `mainprocess`/`async` modes
- ✅ Context passing via `contextHint`
- ✅ Minimum execution unit preservation
- ✅ Consistent execution patterns

## Next Steps

The meta-skill workflow coordinator can now:
1. Discover templates dynamically via Glob
2. Parse execution configuration from each step
3. Execute slash commands with mainprocess/async modes
4. Pass context between steps using contextHint
5. Maintain minimum execution unit integrity
6. (Future) Support cli-tools for custom analysis tasks
