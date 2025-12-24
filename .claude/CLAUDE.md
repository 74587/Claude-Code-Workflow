# Claude Instructions

- **CLI Tools Usage**: @~/.claude/workflows/cli-tools-usage.md
- **Coding Philosophy**: @~/.claude/workflows/coding-philosophy.md
- **Context Requirements**: @~/.claude/workflows/context-tools.md
- **File Modification**: @~/.claude/workflows/file-modification.md
- **CLI Endpoints Config**: @.claude/cli-tools.json

## CLI Endpoints

**Strictly follow the @.claude/cli-tools.json configuration**

Available CLI endpoints are dynamically defined by the config file:
- Built-in tools and their enable/disable status
- Custom API endpoints registered via the Dashboard
- Managed through the CCW Dashboard Status page

## Agent Execution

- **Always use `run_in_background = false`** for Task tool agent calls to ensure synchronous execution and immediate result visibility

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking over shell-based TypeScript compilation
- Usage: `mcp__ide__getDiagnostics({ uri: "file:///path/to/file.ts" })` for specific file or omit uri for all files
- Benefits: Works across platforms, no shell environment issues, real-time IDE integration