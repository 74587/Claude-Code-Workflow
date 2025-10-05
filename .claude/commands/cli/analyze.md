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

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` first
3. Detect analysis type and select template
4. Build and execute command
5. Return results

## Enhancement Integration

**When `--enhance` flag present**: Execute `/enhance-prompt "[analysis-target]"` first, then use enhanced output (INTENT/CONTEXT/ACTION) to build the analysis command.


## Command Template

**Gemini/Qwen**:
```bash
cd [dir] && ~/.claude/scripts/[gemini|qwen]-wrapper -p "
PURPOSE: [analysis goal]
TASK: [specific task]
CONTEXT: @{[file-patterns]} @{CLAUDE.md}
EXPECTED: [output format]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
"
```

**Codex**:
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [analysis goal]
TASK: [specific task]
CONTEXT: @{[file-patterns]} @{CLAUDE.md}
EXPECTED: [output format]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access

# With image attachment (e.g., UI screenshots, diagrams)
codex -C [dir] -i screenshot.png --full-auto exec "..." --skip-git-repo-check -s danger-full-access
```

## Examples

```bash
/cli:analyze "authentication patterns"              # Gemini (default)
/cli:analyze --tool qwen "component architecture"   # Qwen architecture
/cli:analyze --tool codex "performance bottlenecks" # Codex deep analysis
/cli:analyze --enhance "fix auth issues"            # Enhanced prompt first
```

## File Pattern Logic

### Auto-Detection from Keywords
- "auth" → `@{**/*auth*,**/*user*}`
- "component" → `@{src/components/**/*,**/*.component.*}`
- "API" → `@{**/api/**/*,**/routes/**/*}`
- "test" → `@{**/*.test.*,**/*.spec.*}`
- "config" → `@{*.config.*,**/config/**/*}`
- Generic → `@{src/**/*}`

### Common File Patterns
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- JavaScript: `@{*.js,*.jsx}`
- With docs: `@{CLAUDE.md,**/*CLAUDE.md}`
- Tests: `@{**/*.test.*,**/*.spec.*}`

### Complex Pattern Discovery
For complex file pattern requirements, use semantic discovery BEFORE CLI execution:

**Workflow**: Discover → Extract precise paths → Build CONTEXT field

```bash
# Step 1: Discover files semantically
rg "export.*Component" --files-with-matches --type ts
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")

# Step 2: Build precise CONTEXT from discovery results
CONTEXT: @{src/components/Auth.tsx,src/types/auth.d.ts,src/hooks/useAuth.ts}

# Step 3: Execute CLI with precise file references
cd src && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication components
TASK: Review auth component patterns and props interfaces
MODE: analysis
CONTEXT: @{components/Auth.tsx,types/auth.d.ts,hooks/useAuth.ts}
EXPECTED: Pattern analysis and improvement suggestions
RULES: Focus on type safety and component composition
"
```

## Session Integration

- **Active Session**: Save results to `.workflow/WFS-[id]/.chat/analysis-[timestamp].md`
- **No Session**: Return results directly to user

