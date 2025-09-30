---
name: analyze
description: Quick codebase analysis using CLI tools (codex/gemini/qwen)
usage: /cli:analyze [--tool <codex|gemini|qwen>] [--enhance] <analysis-target>
argument-hint: "[--tool codex|gemini|qwen] [--enhance] analysis target"
examples:
  - /cli:analyze "authentication patterns"
  - /cli:analyze --tool qwen "API security"
  - /cli:analyze --tool codex --enhance "performance bottlenecks"
allowed-tools: SlashCommand(*), Bash(*), TodoWrite(*), Read(*), Glob(*)
---

# CLI Analyze Command (/cli:analyze)

## Purpose

Execute CLI tool analysis on codebase patterns, architecture, or code quality.

**Supported Tools**: codex, gemini (default), qwen

## Execution Flow

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[analysis-target]"` and use enhanced output
3. Parse analysis target (original or enhanced)
4. Detect analysis type (pattern/architecture/security/quality)
5. Build command for selected tool with template
6. Execute analysis
7. Return results

## Core Rules

1. **Tool Selection**: Use `--tool` value or default to gemini
2. **Enhance First (if flagged)**: Execute `/enhance-prompt` before analysis when `--enhance` present
3. **Execute Immediately**: Build and run command without preliminary analysis
4. **Template Selection**: Auto-select template based on keywords
5. **Context Inclusion**: Always include CLAUDE.md in context
6. **Direct Output**: Return tool output directly to user

## Tool Selection

| Tool | Wrapper | Best For | Permissions |
|------|---------|----------|-------------|
| **gemini** (default) | `~/.claude/scripts/gemini-wrapper` | Analysis, exploration, documentation | Read-only |
| **qwen** | `~/.claude/scripts/qwen-wrapper` | Architecture, code generation | Read-only for analyze |
| **codex** | `codex --full-auto exec` | Development analysis, deep inspection | `-s danger-full-access --skip-git-repo-check` |

## Enhancement Integration

**When `--enhance` flag present**:
```bash
# Step 1: Enhance the prompt
SlashCommand(command="/enhance-prompt \"[analysis-target]\"")

# Step 2: Use enhanced output as analysis target
# Enhanced output provides:
# - INTENT: Clear technical goal
# - CONTEXT: Session memory + patterns
# - ACTION: Implementation steps
# - ATTENTION: Critical constraints
```

**Example**:
```bash
# User: /gemini:analyze --enhance "fix auth issues"

# Step 1: Enhance
/enhance-prompt "fix auth issues"
# Returns:
# INTENT: Debug authentication failures
# CONTEXT: JWT implementation in src/auth/, known token expiry issue
# ACTION: Analyze token lifecycle → verify refresh flow → check middleware
# ATTENTION: Preserve existing session management

# Step 2: Analyze with enhanced context
cd . && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Debug authentication failures (from enhanced: JWT token lifecycle)
TASK: Analyze token lifecycle, refresh flow, and middleware integration
CONTEXT: @{src/auth/**/*} @{CLAUDE.md} Session context: known token expiry issue
EXPECTED: Root cause analysis with file references
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) | Focus on JWT token handling
"
```

## Analysis Types

| Type | Keywords | Template | Context |
|------|----------|----------|---------|
| **pattern** | pattern, hooks, usage | analysis/pattern.txt | Matched files + CLAUDE.md |
| **architecture** | architecture, structure, design | analysis/architecture.txt | Full codebase + CLAUDE.md |
| **security** | security, vulnerability, auth | analysis/security.txt | Matched files + CLAUDE.md |
| **quality** | quality, test, coverage | analysis/quality.txt | Source + test files + CLAUDE.md |

## Command Templates

### Gemini (Default)
```bash
cd [target-dir] && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [analysis goal from user input]
TASK: [specific analysis task]
CONTEXT: @{[file-patterns]} @{CLAUDE.md}
EXPECTED: [expected output format]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
"
```

### Qwen
```bash
cd [target-dir] && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: [analysis goal from user input]
TASK: [specific analysis task]
CONTEXT: @{[file-patterns]} @{CLAUDE.md}
EXPECTED: [expected output format]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
"
```

### Codex
```bash
codex -C [target-dir] --full-auto exec "
PURPOSE: [analysis goal from user input]
TASK: [specific analysis task]
CONTEXT: @{[file-patterns]} @{CLAUDE.md}
EXPECTED: [expected output format]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
" --skip-git-repo-check -s danger-full-access
```

## Examples

**Pattern Analysis (Gemini - default)**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication patterns
TASK: Identify auth implementation patterns and conventions
CONTEXT: @{**/*auth*} @{CLAUDE.md}
EXPECTED: Pattern summary with file references
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on security
"
```

**Architecture Review (Qwen)**:
```bash
# User: /cli:analyze --tool qwen "component architecture"

cd . && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Review component architecture
TASK: Analyze component structure and dependencies
CONTEXT: @{src/**/*} @{CLAUDE.md}
EXPECTED: Architecture diagram and integration points
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on modularity
"
```

**Deep Inspection (Codex)**:
```bash
# User: /cli:analyze --tool codex "performance bottlenecks"

codex -C . --full-auto exec "
PURPOSE: Identify performance bottlenecks
TASK: Deep analysis of performance issues
CONTEXT: @{src/**/*} @{CLAUDE.md}
EXPECTED: Performance metrics and optimization recommendations
RULES: Focus on computational complexity and memory usage
" --skip-git-repo-check -s danger-full-access
```

## File Pattern Logic

**Keyword Matching**:
- "auth" → `@{**/*auth*}`
- "component" → `@{src/components/**/*}`
- "API" → `@{**/api/**/*}`
- "test" → `@{**/*.test.*}`
- Generic → `@{src/**/*}` or `@{**/*}`

## Session Integration

**Detect Active Session**: Check for `.workflow/.active-*` marker file

**If Session Active**:
- Save results to `.workflow/WFS-[id]/.chat/analysis-[timestamp].md`
- Include session context in analysis

**If No Session**:
- Return results directly to user

## Output Format

Return Gemini's output directly, which includes:
- File references (file:line format)
- Code snippets
- Pattern analysis
- Recommendations

## Error Handling

- **Missing Template**: Use generic analysis prompt
- **No Context**: Use `@{**/*}` as fallback
- **Command Failure**: Report error and suggest manual command

