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

Quick codebase analysis using CLI tools. Automatically detects analysis type and selects appropriate template.

**Supported Tools**: codex, gemini (default), qwen

## Parameters

- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini)
- `--enhance` - Use `/enhance-prompt` for context-aware enhancement
- `<analysis-target>` - Description of what to analyze

## Execution Flow

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` first to expand user intent
3. Auto-detect analysis type from keywords → select template
4. Build command with auto-detected file patterns
5. Execute and return results

## File Pattern Auto-Detection

Keywords trigger specific file patterns:
- "auth" → `@{**/*auth*,**/*user*}`
- "component" → `@{src/components/**/*,**/*.component.*}`
- "API" → `@{**/api/**/*,**/routes/**/*}`
- "test" → `@{**/*.test.*,**/*.spec.*}`
- "config" → `@{*.config.*,**/config/**/*}`
- Generic → `@{src/**/*}`

For complex patterns, use `rg` or MCP tools to discover files first, then execute CLI with precise file references.

## Examples

```bash
/cli:analyze "authentication patterns"              # Auto: gemini + auth patterns
/cli:analyze --tool qwen "component architecture"   # Qwen architecture analysis
/cli:analyze --tool codex "performance bottlenecks" # Codex deep analysis
/cli:analyze --enhance "fix auth issues"            # Enhanced prompt → analysis
```

## Notes

- Command templates, file patterns, and best practices: see intelligent-tools-strategy.md (loaded in memory)
- Active workflow session: results saved to `.workflow/WFS-[id]/.chat/`
- No session: results returned directly
