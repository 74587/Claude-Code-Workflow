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

### CLI Tool Calls (ccw cli)
- **Default: `run_in_background: true`** - Unless otherwise specified, always use background execution for CLI calls:
  ```
  Bash({ command: "ccw cli -p '...' --tool gemini", run_in_background: true })
  ```
- **After CLI call**: Stop output immediately - let CLI execute in background. **DO NOT use TaskOutput polling** - wait for hook callback to receive results

### CLI Analysis Calls
- **Wait for results**: MUST wait for CLI analysis to complete before taking any write action. Do NOT proceed with fixes while analysis is running
- **Value every call**: Each CLI invocation is valuable and costly. NEVER waste analysis results:
  - Aggregate multiple analysis results before proposing solutions

### CLI Auto-Invoke Triggers

**Proactive CLI invocation scenarios** - Auto-invoke `ccw cli` for external analysis in these cases:

| Trigger Condition | Recommended Mode | Description |
|-------------------|------------------|-------------|
| **Bug fix fails after 1+ attempts** | `--mode analysis --rule analysis-diagnose-bug-root-cause` | Invoke CLI for root cause analysis when self-repair attempts fail |
| **Unclear task description** | `--mode analysis --rule planning-breakdown-task-steps` | Invoke CLI for task decomposition when requirements are ambiguous |
| **Quick planning needed** | `--mode analysis --rule planning-plan-architecture-design` | Invoke CLI for architecture design on complex feature requests |
| **Uncertain code patterns** | `--mode analysis --rule analysis-analyze-code-patterns` | Invoke CLI to analyze existing code style/patterns when uncertain |
| **Security/performance critical paths** | `--mode analysis --rule analysis-assess-security-risks` | Proactively request review for security or performance-sensitive code |

**Execution principles**:
- When trigger conditions are met, invoke CLI **without user confirmation**
- Wait for results before determining next steps
- Tool fallback chain: `gemini` → `qwen` → `codex`

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking over shell-based TypeScript compilation
