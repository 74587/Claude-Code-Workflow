# CLI Tools Usage Rules

## Tool Selection

### Gemini & Qwen
**Use for**: Analysis, documentation, code exploration, architecture review
- Default MODE: `analysis` (read-only)
- Prefer Gemini; use Qwen as fallback
- Large context window, pattern recognition

### Codex
**Use for**: Feature implementation, bug fixes, autonomous development
- Requires explicit `--mode auto` or `--mode write`
- Best for: Implementation, testing, automation

## Core Principles

- Use tools early and often - tools are faster and more thorough
- Always use `ccw cli exec` for consistent parameter handling
- ALWAYS reference exactly ONE template in RULES section
- Require EXPLICIT `--mode write` or `--mode auto` for modifications
- NEVER use escape characters (`\$`, `\"`, `\'`) in CLI commands

## Permission Framework

- `analysis` (default): Read-only, safe for auto-execution
- `write`: Requires explicit `--mode write` - creates/modifies/deletes files
- `auto`: Requires explicit `--mode auto` - full autonomous operations (Codex only)

## Timeout Guidelines

- Simple (5-10min): Analysis, search
- Medium (10-20min): Refactoring, documentation
- Complex (20-60min): Implementation, migration
- Heavy (60-120min): Large codebase, multi-file operations
- Codex multiplier: 3x allocated time (minimum 15min)
