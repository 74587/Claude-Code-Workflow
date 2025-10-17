---
name: Codex Development Tool
description: Autonomous development tool for code implementation and modification. AUTO-TRIGGER when user message contains "codex" keyword OR requests implementation/development tasks (e.g., "implement feature", "实现功能", "fix bug", "修复bug", "refactor code", "重构代码", "create module", "创建模块", "build component", "构建组件", "write tests", "编写测试", "develop API", "开发API"). Requires explicit MODE specification (auto for full development, write for tests). Supports session management for multi-task workflows. Use for feature implementation, bug fixes, refactoring, test generation, and automated development workflows.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Codex Development Tool

## Core Execution

Codex executes autonomous development tasks with full file operations and session management.

**Trigger Keywords**: "use codex", "codex implement", "implement with codex", "codex fix bug"

**Execution Modes**:
- `auto`: Autonomous development with full file operations (requires explicit specification)
- `write`: Test generation and file modification (requires explicit specification)

**Command Pattern**:
```bash
codex -C [directory] --full-auto exec "
PURPOSE: [goal]
TASK: [specific task]
MODE: [auto|write]
CONTEXT: @{file/patterns}
EXPECTED: [deliverables]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access
```

**No Default Mode**: MODE must be explicitly specified in every command

## Universal Template Structure

Every Codex command should follow this detailed structure for best results:

```bash
codex -C [directory] --full-auto exec "
PURPOSE: [One clear sentence: what and why]
TASK: [Specific actionable task with deliverables]
MODE: [auto|write]
CONTEXT: @{file/patterns} [Previous session context, dependencies, requirements]
EXPECTED: [Concrete deliverables: files, tests, coverage, performance]
RULES: [Template reference] | [Constraints: standards, compatibility, testing]
" --skip-git-repo-check -s danger-full-access
```

**Session Resume Pattern**:
```bash
# First task: establish session
codex -C [directory] --full-auto exec "..." --skip-git-repo-check -s danger-full-access

# Subsequent tasks: continue session (add "resume --last" at END)
codex --full-auto exec "..." resume --last --skip-git-repo-check -s danger-full-access
```

### Template Field Guidelines

**PURPOSE**:
- One sentence combining goal + business driver
- Examples: "Implement auth system for enterprise SaaS", "Fix performance issue to meet SLA <200ms"

**TASK**:
- Break down into numbered sub-tasks with specific deliverables
- Include technical details: "Create JWT auth with RS256, 15min access token, 7d refresh token"
- Specify what to build, test, and document

**CONTEXT**:
- File patterns: `@{src/models/**/*.ts,src/services/**/*.ts}`
- Tech stack: "Express 4.18, PostgreSQL 14, Redis 7, TypeScript strict mode"
- Requirements: "Support 100k users, comply with OWASP guidelines"
- Session memory: "Previous auth implementation from current session"

**EXPECTED**:
- Numbered, concrete deliverables: "1) auth.service.ts, 2) auth.controller.ts, 3) auth.test.ts (>90% coverage)"
- Specific file names with purposes
- Test coverage requirements: ">90% coverage including security scenarios"
- Performance targets: "p95 <200ms", "Support 1000 req/min"
- Documentation requirements: "Update API.md with endpoints"

**RULES**:
- Template reference: `$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)`
- Multiple constraints separated by `|`: "Follow OWASP | Use bcrypt salt 12 | Rate limit 5/15min | Include audit logs"
- Compatibility: "Maintain backward compatibility", "Ensure zero downtime"
- Testing strategy: "Test all error cases", "Mock external dependencies", "Load test with Artillery"
- Security requirements: "Validate all inputs", "Parameterized queries only", "Log security events"

## Command Structure

### Universal Template
Every Codex command follows this structure:

```bash
codex -C [directory] --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
MODE: [auto|write]
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" --skip-git-repo-check -s danger-full-access
```

**Parameter Position**: `--skip-git-repo-check -s danger-full-access` must be placed at command END

## Execution Modes

### Auto Mode (Full Development)
⚠️ Autonomous development with full file operations (requires explicit MODE=auto):

```bash
codex -C [directory] --full-auto exec "
PURPOSE: [development goal]
TASK: [implementation task]
MODE: auto
CONTEXT: @{file/patterns} [session memory]
EXPECTED: [deliverables]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access
```

**When to use**:
- Feature implementation
- Bug fixes requiring code changes
- Refactoring tasks
- Complex algorithm implementation

### Write Mode (Test Generation)
⚠️ Test generation and file modification (requires explicit MODE=write):

```bash
codex -C [directory] --full-auto exec "
PURPOSE: [test goal]
TASK: [test generation task]
MODE: write
CONTEXT: @{file/patterns}
EXPECTED: [test deliverables]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access
```

**When to use**:
- Test generation
- Test coverage improvement
- Documentation updates

**No Default Mode**: MODE must be explicitly specified in every command

## Session Management

Codex supports session continuity for multi-task workflows. See [session-management.md](session-management.md) for detailed patterns.

### Session Resume Patterns

**First Task** (establish session):
```bash
codex -C project --full-auto exec "
PURPOSE: [initial task]
TASK: [first implementation]
MODE: auto
CONTEXT: @{relevant/files}
EXPECTED: [deliverables]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access
```

**Subsequent Tasks** (continue session):
```bash
codex --full-auto exec "
PURPOSE: [next task]
TASK: [related implementation]
MODE: auto
CONTEXT: Previous implementation from current session
EXPECTED: [deliverables]
RULES: [constraints]
" resume --last --skip-git-repo-check -s danger-full-access
```

**Parameter Position**: `resume --last` must be placed AFTER the prompt string at command END

### Auto-Resume Decision Rules

**Use `resume --last` when**:
- Current task extends previous Codex task in conversation
- Current task requires context from previous implementation
- Multi-step workflow (implement → enhance → test)
- Session memory indicates recent Codex execution

**Do NOT use `resume --last` when**:
- First Codex task in conversation
- New independent task unrelated to previous work
- Switching to different module/feature area
- No recent Codex task in conversation memory

### Interactive Session Resume

```bash
# Resume with session picker
codex resume

# Resume most recent session directly
codex resume --last
```

### Image Attachment Support

```bash
# Attach images for UI/design implementation
codex -i screenshot.png -C project --full-auto exec "
PURPOSE: Implement UI from design
TASK: Create component matching screenshot
MODE: auto
CONTEXT: @{src/components/**}
EXPECTED: React component matching design
RULES: Follow design system
" --skip-git-repo-check -s danger-full-access
```

## File Pattern Reference

Common patterns for CONTEXT field:

```bash
@{**/*}                    # All files
@{src/**/*}                # Source files
@{*.ts,*.tsx}              # TypeScript files
@{src/**/*.test.*}         # Test files
@{CLAUDE.md,**/*CLAUDE.md} # Documentation
```

## Template System

Templates are located in `~/.claude/workflows/cli-templates/prompts/`

### Available Templates

**Development Templates**:
- `development/feature.txt` - Feature implementation
- `development/refactor.txt` - Refactoring tasks
- `development/testing.txt` - Test generation

**Analysis Templates** (for planning):
- `analysis/pattern.txt` - Code pattern analysis
- `analysis/architecture.txt` - System architecture review
- `analysis/security.txt` - Security assessment

### Using Templates in RULES Field

```bash
# Single template
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow security best practices

# Multiple templates
RULES: $(cat template1.txt) $(cat template2.txt) | Maintain backward compatibility

# No template
RULES: Use Jest, follow existing patterns, 80%+ coverage
```

## Directory Context Configuration

Codex uses `-C` parameter for directory context:

```bash
# Focused on specific directory
codex -C src/auth --full-auto exec "..." --skip-git-repo-check -s danger-full-access

# Relative path
codex -C ../project --full-auto exec "..." --skip-git-repo-check -s danger-full-access

# Absolute path
codex -C /full/path/to/project --full-auto exec "..." --skip-git-repo-check -s danger-full-access
```

## Execution Configuration

### Timeout Allocation (Dynamic + Multiplier)
Codex uses 1.5x of base timeout due to development complexity:

- **Simple** (test generation): 30-60min (1800000-3600000ms)
- **Medium** (feature implementation): 60-90min (3600000-5400000ms)
- **Complex** (multi-module refactor): 90-180min (5400000-10800000ms)

Auto-detect from PURPOSE and TASK fields.

### Permission Framework
- ⚠️ **No Default Mode**: MODE must be explicitly specified
- 🔒 **Write Protection**: Requires explicit user instruction
- ✅ **Auto Mode**: Full file operations when MODE=auto specified
- ✅ **Write Mode**: Test generation when MODE=write specified

## Examples

Production-ready examples organized by scenario type:

- **[Feature Implementation](feature-examples.md)** - RESTful APIs and multi-task authentication systems with session resume patterns
- **[Bug Fix & Refactoring](bugfix-refactor-examples.md)** - Performance investigation workflows and large-scale DDD refactoring
- **[Advanced Development](advanced-examples.md)** - Graph algorithms, UI implementation from designs, and security-focused features
- **[Session Management](session-management.md)** - Interactive resume patterns and multi-phase development workflows

Each example follows the Universal Template Structure with detailed session continuity patterns.

## Best Practices

### Implementation Phase
- Always specify MODE (auto/write)
- Use `-C` for directory context
- Include file patterns in CONTEXT
- Reference templates in RULES
- Use session management for multi-step tasks

### Testing Phase
- Use MODE=write for test generation
- Reference implementation in CONTEXT
- Specify coverage requirements in RULES
- Use existing test patterns

### Multi-Task Workflows
- First task: establish session
- Subsequent tasks: use `resume --last`
- Maintain context continuity
- Keep related tasks in same session

## Error Handling

**If timeout occurs**:
- Reduce task scope
- Split into smaller subtasks
- Use session management for continuity

**If implementation blocked**:
- Check CONTEXT includes necessary files
- Verify MODE is specified
- Review RULES for conflicts

**If tests fail**:
- Use MODE=write to generate test fixes
- Reference failing tests in CONTEXT
- Specify fix requirements in RULES

**If session lost**:
- Use `codex resume` to restore session
- Reference previous work in CONTEXT
- Include session memory in prompt

## Security Considerations

### Permission Requirements
- `-s danger-full-access`: Full file system access
- `--skip-git-repo-check`: Skip git validation
- `--full-auto`: Autonomous execution mode

### Safety Guidelines
- Review generated code before committing
- Verify test coverage meets requirements
- Check for security vulnerabilities
- Validate backward compatibility

### Best Practices
- Use MODE=write for non-destructive operations
- Review RULES for security constraints
- Include security templates when relevant
- Test in isolated environment first
