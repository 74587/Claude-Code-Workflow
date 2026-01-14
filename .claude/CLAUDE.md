# Claude Instructions

- **Coding Philosophy**: @~/.claude/workflows/coding-philosophy.md

## CLI Endpoints

- **CLI Tools Usage**: @~/.claude/workflows/cli-tools-usage.md
- **CLI Endpoints Config**: @~/.claude/cli-tools.json

**Strictly follow the cli-tools.json configuration**

Available CLI endpoints are dynamically defined by the config file:
- Built-in tools and their enable/disable status
- Custom API endpoints registered via the Dashboard
- Managed through the CCW Dashboard Status page


## Tool Execution

- **Context Requirements**: @~/.claude/workflows/context-tools.md
- **File Modification**: @~/.claude/workflows/file-modification.md

### Agent Calls
- **Always use `run_in_background: false`** for Task tool agent calls: `Task({ subagent_type: "xxx", prompt: "...", run_in_background: false })` to ensure synchronous execution and immediate result visibility
- **TaskOutput usage**: Only use `TaskOutput({ task_id: "xxx", block: false })` + sleep loop to poll completion status. NEVER read intermediate output during agent/CLI execution - wait for final result only

### CLI Analysis Calls
- **Wait for results**: MUST wait for CLI analysis to complete before taking any write action. Do NOT proceed with fixes while analysis is running
- **Value every call**: Each CLI invocation is valuable and costly. NEVER waste analysis results:
  - Aggregate multiple analysis results before proposing solutions

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking over shell-based TypeScript compilation
