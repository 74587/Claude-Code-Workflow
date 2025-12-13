# Intelligent Tools Selection Strategy

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Tool Specifications](#tool-specifications)
3. [Prompt Template](#prompt-template)
4. [CLI Execution](#cli-execution)
5. [Configuration](#configuration)
6. [Best Practices](#best-practices)

---

## Quick Reference

### Universal Prompt Template

```
PURPOSE: [objective + why + success criteria]
TASK: • [step 1] • [step 2] • [step 3]
MODE: [analysis|write|auto]
CONTEXT: @**/* | Memory: [session/tech/module context]
EXPECTED: [format + quality + structure]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints] | MODE=[permission]
```

### Tool Selection

| Task Type | Tool | Fallback |
|-----------|------|----------|
| Analysis/Documentation | Gemini | Qwen |
| Implementation/Testing | Codex | - |

### CCW Command Syntax

```bash
ccw cli exec "<prompt>" --tool <gemini|qwen|codex> --mode <analysis|write|auto>
ccw cli exec "<prompt>" --tool gemini --cd <path> --includeDirs <dirs>
ccw cli exec "<prompt>" --resume [id]  # Resume previous session
```

### CLI Subcommands

| Command | Description |
|---------|-------------|
| `ccw cli status` | Check CLI tools availability |
| `ccw cli exec "<prompt>"` | Execute a CLI tool |
| `ccw cli exec "<prompt>" --resume [id]` | Resume a previous session |
| `ccw cli history` | Show execution history |
| `ccw cli detail <id>` | Show execution detail |

### Core Principles

- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli exec` for consistent parameter handling
- **One template required** - ALWAYS reference exactly ONE template in RULES (use universal fallback if no specific match)
- **Write protection** - Require EXPLICIT `--mode write` or `--mode auto`
- **No escape characters** - NEVER use `\$`, `\"`, `\'` in CLI commands

---

## Tool Specifications

### MODE Options

| Mode | Permission | Use For | Specification |
|------|------------|---------|---------------|
| `analysis` | Read-only (default) | Code review, architecture analysis, pattern discovery | Auto for Gemini/Qwen |
| `write` | Create/Modify/Delete | Documentation, code creation, file modifications | Requires `--mode write` |
| `auto` | Full operations | Feature implementation, bug fixes, autonomous development | Codex only, requires `--mode auto` |

### Gemini & Qwen

**Via CCW**: `ccw cli exec "<prompt>" --tool gemini` or `--tool qwen`

**Characteristics**:
- Large context window, pattern recognition
- Best for: Analysis, documentation, code exploration, architecture review
- Default MODE: `analysis` (read-only)
- Priority: Prefer Gemini; use Qwen as fallback

**Models** (override via `--model`):
- Gemini: `gemini-2.5-pro`
- Qwen: `coder-model`, `vision-model`

**Error Handling**: HTTP 429 may show error but still return results - check if results exist

### Codex

**Via CCW**: `ccw cli exec "<prompt>" --tool codex --mode auto`

**Characteristics**:
- Autonomous development, mathematical reasoning
- Best for: Implementation, testing, automation
- No default MODE - must explicitly specify `--mode write` or `--mode auto`

**Models**: `gpt-5.2`

### Session Resume

**Resume via `--resume` parameter**:

```bash
ccw cli exec "Continue analyzing" --resume              # Resume last session
ccw cli exec "Fix issues found" --resume <id>           # Resume specific session
```

| Value | Description |
|-------|-------------|
| `--resume` (empty) | Resume most recent session |
| `--resume <id>` | Resume specific execution ID |

**Context Assembly** (automatic):
```
=== PREVIOUS CONVERSATION ===
USER PROMPT: [Previous prompt]
ASSISTANT RESPONSE: [Previous output]
=== CONTINUATION ===
[Your new prompt]
```

**Tool Behavior**: Codex uses native `codex resume`; Gemini/Qwen assembles context as single prompt

---

## Prompt Template

### Template Structure

Every command MUST include these fields:

| Field | Purpose | Example |
|-------|---------|---------|
| **PURPOSE** | Goal, why needed, success criteria | "Analyze auth module for security vulnerabilities" |
| **TASK** | Actionable steps (• bullet format) | "• Review patterns • Identify risks • Document findings" |
| **MODE** | Permission level | `analysis` / `write` / `auto` |
| **CONTEXT** | File patterns + Memory context | `@src/**/* | Memory: Previous refactoring (abc123)` |
| **EXPECTED** | Deliverable format, quality criteria | "Security report with risk levels and recommendations" |
| **RULES** | **Template (REQUIRED)** + constraints | `$(cat ~/.claude/.../analysis/02-analyze-code-patterns.txt) | Focus on auth | analysis=READ-ONLY` |

### CONTEXT Configuration

**Format**: `CONTEXT: [file patterns] | Memory: [memory context]`

#### File Patterns

| Pattern | Scope |
|---------|-------|
| `@**/*` | All files (default) |
| `@src/**/*.ts` | TypeScript in src |
| `@../shared/**/*` | Sibling directory (requires `--includeDirs`) |
| `@CLAUDE.md` | Specific file |

#### Memory Context

Include when building on previous work:

```bash
# Cross-task reference
Memory: Building on auth refactoring (commit abc123), implementing refresh tokens

# Cross-module integration
Memory: Integration with auth module, using shared error patterns from @shared/utils/errors.ts
```

**Memory Sources**:
- **Related Tasks**: Previous refactoring, extensions, conflict resolution
- **Tech Stack Patterns**: Framework conventions, security guidelines
- **Cross-Module References**: Integration points, shared utilities, type dependencies

#### Pattern Discovery Workflow

For complex requirements, discover files BEFORE CLI execution:

```bash
# Step 1: Discover files
rg "export.*Component" --files-with-matches --type ts

# Step 2: Build CONTEXT
CONTEXT: @components/Auth.tsx @types/auth.d.ts | Memory: Previous type refactoring

# Step 3: Execute CLI
ccw cli exec "..." --tool gemini --cd src
```

### RULES Configuration

**Format**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]`

**⚠️ MANDATORY**: Exactly ONE template reference is REQUIRED. Select from Task-Template Matrix or use universal fallback:
- `universal/00-universal-rigorous-style.txt` - For precision-critical tasks (default fallback)
- `universal/00-universal-creative-style.txt` - For exploratory tasks

**Command Substitution Rules**:
- Use `$(cat ...)` directly - do NOT read template content first
- NEVER use escape characters: `\$`, `\"`, `\'`
- Tilde expands correctly in prompt context

**Examples**:
```bash
# Specific template (preferred)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on auth | analysis=READ-ONLY

# Universal fallback (when no specific template matches)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/universal/00-universal-rigorous-style.txt) | Focus on security patterns | analysis=READ-ONLY
```

### Template System

**Base Path**: `~/.claude/workflows/cli-templates/prompts/`

**Naming Convention**:
- `00-*` - Universal fallbacks (when no specific match)
- `01-*` - Universal, high-frequency
- `02-*` - Common specialized
- `03-*` - Domain-specific

**Universal Templates**:

| Template | Use For |
|----------|---------|
| `universal/00-universal-rigorous-style.txt` | Precision-critical, systematic methodology |
| `universal/00-universal-creative-style.txt` | Exploratory, innovative solutions |

**Task-Template Matrix**:

| Task Type | Template |
|-----------|----------|
| **Analysis** | |
| Execution Tracing | `analysis/01-trace-code-execution.txt` |
| Bug Diagnosis | `analysis/01-diagnose-bug-root-cause.txt` |
| Code Patterns | `analysis/02-analyze-code-patterns.txt` |
| Document Analysis | `analysis/02-analyze-technical-document.txt` |
| Architecture Review | `analysis/02-review-architecture.txt` |
| Code Review | `analysis/02-review-code-quality.txt` |
| Performance | `analysis/03-analyze-performance.txt` |
| Security | `analysis/03-assess-security-risks.txt` |
| **Planning** | |
| Architecture | `planning/01-plan-architecture-design.txt` |
| Task Breakdown | `planning/02-breakdown-task-steps.txt` |
| Component Design | `planning/02-design-component-spec.txt` |
| Migration | `planning/03-plan-migration-strategy.txt` |
| **Development** | |
| Feature | `development/02-implement-feature.txt` |
| Refactoring | `development/02-refactor-codebase.txt` |
| Tests | `development/02-generate-tests.txt` |
| UI Component | `development/02-implement-component-ui.txt` |
| Debugging | `development/03-debug-runtime-issues.txt` |

---

## CLI Execution

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--tool <tool>` | gemini, qwen, codex | gemini |
| `--mode <mode>` | analysis, write, auto | analysis |
| `--model <model>` | Model override | auto-select |
| `--cd <path>` | Working directory | current |
| `--includeDirs <dirs>` | Additional directories (comma-separated) | none |
| `--timeout <ms>` | Timeout in milliseconds | 300000 |
| `--resume [id]` | Resume previous session | - |
| `--no-stream` | Disable streaming | false |

### Directory Configuration

#### Working Directory (`--cd`)

When using `--cd`:
- `@**/*` = Files within working directory tree only
- CANNOT reference parent/sibling via @ alone
- Must use `--includeDirs` for external directories

#### Include Directories (`--includeDirs`)

**TWO-STEP requirement for external files**:
1. Add `--includeDirs` parameter
2. Reference in CONTEXT with @ patterns

```bash
# Single directory
ccw cli exec "CONTEXT: @**/* @../shared/**/*" --cd src/auth --includeDirs ../shared

# Multiple directories
ccw cli exec "..." --cd src/auth --includeDirs ../shared,../types,../utils
```

**Rule**: If CONTEXT contains `@../dir/**/*`, MUST include `--includeDirs ../dir`

**Benefits**: Excludes unrelated directories, reduces token usage

### CCW Parameter Mapping

CCW automatically maps to tool-specific syntax:

| CCW Parameter | Gemini/Qwen | Codex |
|---------------|-------------|-------|
| `--cd <path>` | `cd <path> &&` | `-C <path>` |
| `--includeDirs <dirs>` | `--include-directories` | `--add-dir` (per dir) |
| `--mode write` | `--approval-mode yolo` | `-s danger-full-access` |
| `--mode auto` | N/A | `-s danger-full-access` |

### Command Examples

```bash
# Analysis (default)
ccw cli exec "
PURPOSE: Analyze authentication
TASK: • Review patterns • Identify risks
MODE: analysis
CONTEXT: @**/* @../shared/**/*
EXPECTED: Analysis report
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | analysis=READ-ONLY
" --tool gemini --cd src/auth --includeDirs ../shared

# Write mode
ccw cli exec "
PURPOSE: Generate API docs
TASK: • Create docs • Add examples
MODE: write
CONTEXT: @src/api/**/*
EXPECTED: Complete documentation
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | write=CREATE/MODIFY/DELETE
" --tool gemini --mode write

# Auto mode (Codex)
ccw cli exec "
PURPOSE: Implement auth module
TASK: • Create service • Add validation • Setup JWT
MODE: auto
CONTEXT: @**/* | Memory: Following project security patterns
EXPECTED: Complete module with tests
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | auto=FULL
" --tool codex --mode auto

# Fallback strategy
ccw cli exec "<prompt>" --tool gemini    # Primary
ccw cli exec "<prompt>" --tool qwen      # Fallback
```

---

## Configuration

### Timeout Allocation

**Minimum**: 5 minutes (300000ms)

| Complexity | Range | Examples |
|------------|-------|----------|
| Simple | 5-10min (300000-600000ms) | Analysis, search |
| Medium | 10-20min (600000-1200000ms) | Refactoring, documentation |
| Complex | 20-60min (1200000-3600000ms) | Implementation, migration |
| Heavy | 60-120min (3600000-7200000ms) | Large codebase, multi-file |

**Codex Multiplier**: 3x allocated time (minimum 15min / 900000ms)

```bash
ccw cli exec "<prompt>" --tool gemini --timeout 600000   # 10 min
ccw cli exec "<prompt>" --tool codex --timeout 1800000   # 30 min
```

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis` (default): Read-only, safe for auto-execution
- `write`: Requires explicit `--mode write`
- `auto`: Requires explicit `--mode auto`
- **Exception**: User provides clear instructions like "modify", "create", "implement"

---

## Best Practices

### Workflow Principles

- **Use CCW unified interface** for all executions
- **Always include template** - Use Task-Template Matrix or universal fallback
- **Be specific** - Clear PURPOSE, TASK, EXPECTED fields
- **Include constraints** - File patterns, scope in RULES
- **Leverage memory context** when building on previous work
- **Discover patterns first** - Use rg/MCP before CLI execution
- **Default to full context** - Use `@**/*` unless specific files needed

### Workflow Integration

| Phase | Command |
|-------|---------|
| Understanding | `ccw cli exec "<prompt>" --tool gemini` |
| Architecture | `ccw cli exec "<prompt>" --tool gemini` |
| Implementation | `ccw cli exec "<prompt>" --tool codex --mode auto` |
| Quality | `ccw cli exec "<prompt>" --tool codex --mode write` |

### Planning Checklist

- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - `--mode analysis|write|auto`
- [ ] **Context gathered** - File references + memory (default `@**/*`)
- [ ] **Directory navigation** - `--cd` and/or `--includeDirs`
- [ ] **Tool selected** - `--tool gemini|qwen|codex`
- [ ] **Template applied (REQUIRED)** - Use specific or universal fallback template
- [ ] **Constraints specified** - Scope, requirements
- [ ] **Timeout configured** - Based on complexity
