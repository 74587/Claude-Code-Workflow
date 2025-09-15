# Task System Core Reference

## Overview
Task commands provide single-execution workflow capabilities with full context awareness, hierarchical organization, and agent orchestration.

## Task JSON Schema
All task files use this unified 10-field structure:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending|active|completed|blocked|container",
  "type": "feature|bugfix|refactor|test|docs",
  "agent": "code-developer|planning-agent|code-review-test-agent",
  "paths": "src/auth;tests/auth;config/auth.json;src/middleware/auth.ts",

  "context": {
    "requirements": ["JWT authentication", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"],
    "inherited_from": "WFS-user-auth"
  },

  "relations": {
    "parent": null,
    "subtasks": ["impl-1.1", "impl-1.2"],
    "dependencies": ["impl-0"]
  },

  "execution": {
    "attempts": 0,
    "last_attempt": null
  },

  "implementation": {
    "preparation_complexity": "simple|moderate|complex",
    "preparation_tasks": [
      "Review existing auth patterns",
      "Check JWT library compatibility"
    ],
    "estimated_prep_time": "20min",
    "files": [
      {
        "path": "src/auth/login.ts",
        "location": {
          "function": "handleLogin",
          "lines": "75-120",
          "description": "Core login handler function"
        },
        "original_code": "// Requires gemini analysis for code extraction",
        "modifications": {
          "current_state": "Basic password validation",
          "proposed_changes": [
            "Add JWT token generation",
            "Integrate OAuth2 flow"
          ],
          "logic_flow": [
            "validateInput() ───► checkCredentials()",
            "◊─── if valid ───► generateJWT() ───► return token"
          ],
          "reason": "Meet JWT and OAuth2 requirements",
          "expected_outcome": "Flexible login system"
        }
      }
    ],
    "context_notes": {
      "dependencies": ["jsonwebtoken", "passport-oauth2"],
      "affected_modules": ["user-profile", "session-manager"],
      "risks": ["Breaking auth middleware changes"],
      "performance_considerations": "JWT adds ~5ms latency",
      "error_handling": "No sensitive data in errors"
    },
    "pre_analysis": [
      {
        "action": "analyze patterns",
        "template": "~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt",
        "method": "gemini"
      },
      {
        "action": "implement feature",
        "template": "~/.claude/workflows/cli-templates/prompts/development/feature.txt",
        "method": "codex"
      }
    ]
  }
}
```

## Implementation Field Details

### preparation_complexity Assessment
- **simple**: <30min prep, ≤3 files, single module → merge with execution
- **moderate**: Cross-module analysis, 30min-2h → consider separation
- **complex**: Architecture design, >2h, >5 modules → separate preparation

### files Array Structure
- **path**: Specific file path
- **location**: Function/class/line range
- **original_code**: Current code (or "requires gemini analysis")
- **modifications**: Detailed change specification

### context_notes Requirements
- **dependencies**: Required packages
- **affected_modules**: Impact scope
- **risks**: Specific implementation risks
- **performance_considerations**: Performance impact
- **error_handling**: Error handling requirements

### pre_analysis Options
- **manual**: User-provided details
- **auto-detected**: System-inferred
- **gemini**: Requires Gemini CLI analysis
- **codex**: Requires Codex CLI analysis

## Hierarchical System

### Task Hierarchy Rules
- **Format**: impl-N (main), impl-N.M (subtasks)
- **Maximum Depth**: 2 levels only
- **Container Tasks**: Parents with subtasks (not executable)
- **Leaf Tasks**: No subtasks (executable)

### Status Rules
- **pending**: Ready for execution
- **active**: Currently being executed
- **completed**: Successfully finished
- **blocked**: Waiting for dependencies
- **container**: Has subtasks (parent only)

## Session Integration

### Active Session Detection
```bash
# Check for active session marker
active_session=$(ls .workflow/.active-* 2>/dev/null | head -1)
```

### Workflow Context Inheritance
Tasks inherit from:
1. `workflow-session.json` - Session metadata
2. Parent task context (for subtasks)
3. `IMPL_PLAN.md` - Planning document

### File Locations
- **Task JSON**: `.workflow/WFS-[topic]/.task/impl-*.json`
- **Session State**: `.workflow/WFS-[topic]/workflow-session.json`
- **Planning Doc**: `.workflow/WFS-[topic]/IMPL_PLAN.md`
- **Progress**: `.workflow/WFS-[topic]/TODO_LIST.md`

## Agent Mapping

### Automatic Agent Selection
- **code-developer**: Implementation tasks, coding
- **planning-agent**: Design, architecture planning
- **code-review-test-agent**: Testing, validation
- **review-agent**: Code review, quality checks

### Agent Context Filtering
Each agent receives tailored context:
- **code-developer**: Complete implementation details
- **planning-agent**: High-level requirements, risks
- **test-agent**: Files to test, logic flows to validate
- **review-agent**: Quality standards, security considerations

## Paths Field Format

### Structure
Semicolon-separated list of concrete paths:
```json
"paths": "src/auth;tests/auth;config/auth.json;src/middleware/auth.ts"
```

### Selection Strategy
- **Directories**: Relevant module directories
- **Specific Files**: Explicitly mentioned files
- **No Wildcards**: Use concrete paths only
- **Focus Scope**: Only task-related paths

## Validation Rules

### Pre-execution Checks
1. Task exists and is valid JSON
2. Task status allows operation
3. Dependencies are met
4. Active workflow session exists
5. Implementation field is complete

### Hierarchy Validation
- Parent-child relationships valid
- Maximum depth not exceeded
- Container tasks have subtasks
- No circular dependencies

## Error Handling Patterns

### Common Errors
- **Task not found**: Check ID format and session
- **Invalid status**: Verify task can be operated on
- **Missing session**: Ensure active workflow exists
- **Max depth exceeded**: Restructure hierarchy
- **Missing implementation**: Complete required fields

### Recovery Strategies
- Session validation with clear guidance
- Automatic ID correction suggestions
- Implementation field completion prompts
- Hierarchy restructuring options