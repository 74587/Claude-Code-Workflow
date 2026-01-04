# ❓ Frequently Asked Questions (FAQ)

This document answers common questions about Claude Code Workflow (CCW).

---

## 📋 Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Usage & Workflows](#usage--workflows)
- [Commands & Syntax](#commands--syntax)
- [Sessions & Tasks](#sessions--tasks)
- [Agents & Tools](#agents--tools)
- [Memory System](#memory-system)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## 🌟 General Questions

### What is Claude Code Workflow (CCW)?

CCW is an advanced AI-powered development automation framework for Claude Code. It transforms AI development from simple prompt chaining into a robust, context-first orchestration system with structured planning, deterministic execution, and intelligent multi-model orchestration.

### How is CCW different from using Claude Code directly?

| Claude Code (Vanilla) | Claude Code with CCW |
|----------------------|---------------------|
| Manual task management | Automated workflow orchestration |
| No context preservation | Hierarchical memory system (CLAUDE.md) |
| Single conversation context | Session-based project isolation |
| Manual planning | Automated multi-phase planning |
| One model/approach | Multi-model strategy (Gemini, Qwen, Codex) |
| No quality gates | Built-in verification and review |

### Do I need external CLI tools (Gemini, Qwen, Codex)?

**No, they're optional.** CCW can work with Claude Code alone. External CLI tools enhance CCW's capabilities by:
- Providing specialized analysis (Gemini)
- Enabling autonomous development (Codex)
- Supporting architectural planning (Qwen)

But all core workflows function without them.

### Is CCW suitable for beginners?

**Yes!** CCW provides:
- Simple commands like `/workflow:plan` and `/workflow:execute`
- Interactive command guide (`CCW-help`)
- Comprehensive documentation
- Built-in examples and tutorials

Start with the [5-minute Quick Start](GETTING_STARTED.md) to get a feel for it.

### What languages/frameworks does CCW support?

CCW is **language-agnostic**. It works with any programming language or framework that Claude Code supports:
- JavaScript/TypeScript (Node.js, React, Vue, etc.)
- Python (Django, Flask, FastAPI, etc.)
- Java/Kotlin (Spring Boot, etc.)
- Go, Rust, C++, C#, Ruby, PHP, etc.

### Is CCW free?

**Yes!** CCW is open-source under the MIT License. However, you need:
- Claude Code subscription (for the base platform)
- Optional: API keys for external CLI tools (Gemini, Qwen, Codex)

---

## 🔧 Installation & Setup

### How do I install CCW?

**NPM Global Install** (Recommended):

```bash
npm install -g claude-code-workflow
```

**Verify Installation**:
```bash
ccw --version
ccw dashboard   # Start Dashboard
ccw view        # Start View interface
```

See [INSTALL.md](INSTALL.md) for detailed instructions.

### How do I verify CCW is installed correctly?

Open Claude Code and run:
```bash
/workflow:session:list
```

If the command is recognized, installation succeeded.

### Where are CCW files installed?

CCW installs to your home directory:
```
~/.claude/
├── agents/       # Agent definitions
├── commands/     # Slash commands
├── skills/       # Agent skills
└── workflows/    # Workflow documentation
```

### Can I customize CCW after installation?

**Yes!** All files in `~/.claude/` can be customized:
- Modify agent prompts in `agents/`
- Add custom commands in `commands/`
- Adjust workflow templates in `workflows/`

### How do I update CCW to the latest version?

Update via npm:
```bash
npm update -g claude-code-workflow
```

**Note**: Custom modifications in `~/.claude/` will be preserved. The npm package only updates core CCW files.

### Do I need to install CLI tools?

**Optional**. To use CLI tools:

1. **Gemini CLI**: Follow [setup instructions](https://github.com/your-repo)
2. **Qwen CLI**: Follow [setup instructions](https://github.com/your-repo)
3. **Codex CLI**: Follow [setup instructions](https://github.com/your-repo)

Then initialize with:
```bash
/cli:cli-init
```

---

## 🚀 Usage & Workflows

### What's the simplest way to use CCW?

**Two-command workflow**:
```bash
/workflow:plan "Your feature description"
/workflow:execute
```

That's it! CCW handles planning, task generation, and implementation.

### What's the difference between `/workflow:plan` and `/workflow:lite-plan`?

| `/workflow:plan` | `/workflow:lite-plan` |
|-----------------|---------------------|
| Full 5-phase planning | Lightweight interactive planning |
| Creates persistent artifacts | In-memory planning |
| Best for complex projects | Best for quick tasks |
| Includes verification phase | Streamlined flow |
| Suitable for team collaboration | Suitable for solo development |

**Use `/workflow:plan`** for: Complex features, team projects, when you need detailed documentation

**Use `/workflow:lite-plan`** for: Quick fixes, small features, rapid prototyping

### When should I use brainstorming workflows?

**Use `/workflow:brainstorm:auto-parallel` when you know WHAT to build, but NOT HOW to build it.**

**Brainstorming scenarios**:
- 🤔 **Unclear solution approach** - Multiple ways to solve the problem, need expert analysis
- 🏗️ **Architectural exploration** - Need to explore different architectural patterns
- 📋 **Requirements clarification** - High-level goal is clear, but technical details are not
- 🔀 **Multiple trade-offs** - Need to analyze pros/cons of different approaches
- 🆕 **Unfamiliar domain** - Building something new without clear implementation path

**Skip brainstorming, use `/workflow:plan` directly when**:
- ✅ **Clear implementation approach** - You already know how to build it
- ✅ **Similar to existing code** - Following established patterns in your codebase
- ✅ **Well-defined requirements** - Technical specs are clear from the start
- ✅ **Simple features** - Straightforward implementation, no architectural decisions

**Workflow comparison**:

| Know what + Know how | Know what, NOT how |
|---------------------|-------------------|
| `/workflow:plan "Add JWT auth"` | `/workflow:brainstorm:auto-parallel "Design auth system"` → `/workflow:plan` |
| Plan generates tasks directly | Brainstorm explores solutions → Plan generates tasks |

**Example**:
```bash
# When you DON'T know how to build it
/workflow:brainstorm:auto-parallel "Build real-time collaborative document editing system"
/workflow:plan
/workflow:execute
```

### How do I check the status of my workflow?

```bash
/workflow:status
```

Shows:
- Current session
- Task completion status
- Currently executing task
- Next steps

### Can I run multiple workflows simultaneously?

**Yes!** CCW supports parallel sessions:

```bash
# Session 1: Authentication
/workflow:session:start "User Authentication"
/workflow:plan "JWT-based authentication"

# Session 2: Payment
/workflow:session:start "Payment Integration"
/workflow:plan "Stripe payment integration"

# Execute each session independently
/workflow:execute --session WFS-user-authentication
/workflow:execute --session WFS-payment-integration
```

### How do I resume a paused workflow?

```bash
/workflow:session:resume
```

Automatically detects and resumes the most recent paused session.

---

## 💬 Commands & Syntax

### Where can I find all available commands?

See [COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) for a complete list.

Or use the interactive guide:
```bash
CCW-help
```

### What's the difference between `/cli:*` and `/workflow:*` commands?

**`/cli:*` commands**:
- CLI tool configuration
- Example: `/cli:cli-init` (initialize Gemini/Qwen configurations)

**`/workflow:*` commands**:
- Multi-phase orchestration
- Session-based
- Complex development workflows
- Examples: `/workflow:plan`, `/workflow:lite-plan`, `/workflow:lite-fix`

> **Note**: Most CLI commands have been replaced by **semantic invocation**. Simply describe your needs in natural language, and Claude will automatically use the appropriate tools.

### How do I use command flags?

Most commands support flags for customization:

```bash
# Basic usage
/workflow:plan "Feature description"

# With CLI execution flag
/workflow:plan --cli-execute "Feature description"

# With multiple flags
/workflow:ui-design:explore-auto --prompt "Login page" --style-variants 3 --layout-variants 2
```

### Can I use natural language instead of commands?

**Yes!** Claude understands semantic invocation:

Instead of using specific commands, you can say:
```
"Use Gemini to analyze the authentication module architecture"
```

Claude will automatically select and execute the appropriate CLI tools (Gemini/Qwen/Codex) with optimized templates.

### What does the `-e` or `--enhance` flag do?

The `-e` flag triggers the **prompt-enhancer** skill in natural conversation:

```
User: "Analyze authentication module -e"
```

Claude will expand and enhance your request for better results.

---

## 📦 Sessions & Tasks

### What is a workflow session?

A workflow session is an **isolated workspace** for a specific feature or project. It contains:
- Task definitions (JSON files)
- Brainstorming artifacts
- Generated plans
- Chat logs
- Session state

**Location**: `.workflow/active/WFS-<session-name>/`

### How are sessions created?

Sessions are created automatically when you run:
```bash
/workflow:session:start "Feature name"
/workflow:plan "Feature description"
/workflow:brainstorm:auto-parallel "Topic"
```

### How do I list all sessions?

```bash
/workflow:session:list
```

Shows all sessions with their status (active, paused, completed).

### What happens when I complete a session?

```bash
/workflow:session:complete
```

CCW will:
1. Archive session to `.workflow/archives/`
2. Remove active flag
3. Generate lessons learned
4. Update session manifest

### What are tasks in CCW?

Tasks are **atomic units of work** stored as JSON files in `.task/` directory:

```
.workflow/active/WFS-feature/.task/
├── IMPL-1.json       # Main task
├── IMPL-1.1.json     # Subtask
└── IMPL-2.json       # Another task
```

Each task contains:
- Title and description
- Requirements and acceptance criteria
- Context and focus paths
- Implementation approach
- Status (pending, in_progress, completed)

### How deep can task hierarchies go?

**Maximum 2 levels**:
- `IMPL-1` - Main task
- `IMPL-1.1`, `IMPL-1.2` - Subtasks
- No further nesting (no `IMPL-1.1.1`)

### Can I manually edit task JSON files?

**Yes**, but:
- ⚠️ JSON files are the source of truth
- ⚠️ Markdown documents are read-only views
- ✅ Edit JSON directly for fine-grained control
- ✅ Validate JSON syntax after editing
- ✅ Use `/workflow:status` to regenerate views

---

## 🤖 Agents & Tools

### What agents are available in CCW?

| Agent | Purpose |
|-------|---------|
| `@code-developer` | Code implementation |
| `@test-fix-agent` | Test generation and fixing |
| `@ui-design-agent` | UI design and prototyping |
| `@action-planning-agent` | Task planning and decomposition |
| `@cli-execution-agent` | Autonomous CLI task handling |
| `@cli-explore-agent` | Codebase exploration |
| `@context-search-agent` | Context gathering |
| `@doc-generator` | Documentation generation |
| `@memory-bridge` | Memory system updates |

See [ARCHITECTURE.md](ARCHITECTURE.md#multi-agent-system) for details.

### How do agents get selected for tasks?

**Automatic selection** based on task type defined in JSON:

```json
{
  "meta": {
    "agent": "code-developer"
  }
}
```

CCW automatically invokes the appropriate agent during `/workflow:execute`.

### What's the difference between Gemini, Qwen, and Codex?

| Tool | Strengths | Best For |
|------|-----------|----------|
| **Gemini** | Deep analysis, pattern recognition | Code exploration, architecture analysis |
| **Qwen** | System design, planning | Architectural planning, system design |
| **Codex** | Autonomous implementation | Feature development, bug fixes |

CCW auto-selects the best tool for each task, but you can override with `--tool` flag.

### Can I create custom agents?

**Yes!** Create a new file in `.claude/agents/`:

```markdown
# My Custom Agent

## Role
Agent description

## Tools Available
- Tool 1
- Tool 2

## Prompt
Agent instructions...
```

Then reference it in task JSON:
```json
{
  "meta": {
    "agent": "my-custom-agent"
  }
}
```

---

## 💾 Memory System

### What is the CLAUDE.md memory system?

A **hierarchical documentation system** that maintains project knowledge across 4 layers:

```
CLAUDE.md (Project root)
└── src/CLAUDE.md (Source layer)
    └── auth/CLAUDE.md (Module layer)
        └── jwt/CLAUDE.md (Component layer)
```

Each layer provides context at the appropriate abstraction level.

### When should I update memory?

**Update memory when**:
- After completing a feature
- After refactoring modules
- After changing architecture
- Before starting complex tasks
- Weekly maintenance

### What's the difference between memory update commands?

| Command | Scope | When to Use |
|---------|-------|-------------|
| `/memory:update-full` | Entire project | Major changes, first-time setup, monthly maintenance |
| `/memory:update-related` | Changed modules only | Daily development, after feature completion |
| `/memory:load` | Task-specific, no files | Quick context for immediate task |

### How long does memory update take?

- **`/memory:update-full`**: 5-20 minutes (depends on project size)
- **`/memory:update-related`**: 1-5 minutes (only changed modules)
- **`/memory:load`**: <1 minute (no file updates)

### Do I need to update memory manually?

**Recommended but not required**. Benefits of regular updates:
- ✅ Higher quality AI outputs
- ✅ Accurate pattern recognition
- ✅ Better context understanding
- ✅ Reduced hallucinations

Without updates:
- ⚠️ AI may reference outdated code
- ⚠️ Incorrect architectural assumptions
- ⚠️ Lower output quality

### Can I exclude files from memory?

**Yes!** Use ignore files:
- `.geminiignore` - For Gemini CLI
- `.qwenignore` - For Qwen CLI
- `.gitignore` - Automatically respected

Example `.geminiignore`:
```
node_modules/
dist/
*.log
*.test.js
```

---

## 🔧 Troubleshooting

### "No active session found" error

**Cause**: No workflow session is currently active.

**Solution**:
```bash
# Option 1: Start new session
/workflow:session:start "Feature name"

# Option 2: Resume existing session
/workflow:session:resume
```

### Command execution fails or hangs

**Troubleshooting steps**:

1. **Check status**:
   ```bash
   /workflow:status
   ```

2. **Review logs**:
   ```bash
   # Session logs location
   .workflow/active/WFS-<session>/.chat/
   ```

3. **Simplify task**:
   Break complex requests into smaller tasks

4. **Check CLI tools**:
   Ensure external tools (if used) are properly configured

### Task execution produces errors

**Common causes**:

1. **Outdated memory**: Run `/memory:update-related`
2. **Insufficient context**: Add more details to task requirements
3. **Tool misconfiguration**: Check CLI tool setup with `/cli:cli-init`

### Memory update fails

**Solutions**:

1. **Check file permissions**: Ensure write access to project
2. **Try different tool**:
   ```bash
   /memory:update-full --tool qwen
   ```
3. **Update incrementally**:
   ```bash
   /memory:update-related
   ```

### Workflow gets stuck in a phase

**Steps**:

1. **Check current phase**:
   ```bash
   /workflow:status
   ```

2. **Review session JSON**:
   ```bash
   cat .workflow/active/WFS-<session>/workflow-session.json
   ```

3. **Manually advance** (if needed):
   Edit session JSON to update phase

4. **Restart session**:
   ```bash
   /workflow:session:complete
   /workflow:session:start "New attempt"
   ```

### CLI tools not working

**Checklist**:

1. ✅ Tools installed correctly?
2. ✅ API keys configured?
3. ✅ `.gemini/` or `.qwen/` directories exist?
4. ✅ Configuration files valid?

**Re-initialize**:
```bash
/cli:cli-init --tool gemini
```

### Performance is slow

**Optimization tips**:

1. **Use incremental updates**:
   ```bash
   /memory:update-related  # Instead of update-full
   ```

2. **Exclude unnecessary files**:
   Add to `.geminiignore` or `.qwenignore`

3. **Break down large tasks**:
   Smaller tasks = faster execution

4. **Use lite workflows**:
   ```bash
   /workflow:lite-plan  # Instead of full workflow:plan
   ```

---

## 🚀 Advanced Topics

### How does CCW handle dependencies between tasks?

Tasks can reference dependencies in their JSON:

```json
{
  "id": "IMPL-2",
  "dependencies": ["IMPL-1"],
  "context": {
    "inherited_from": "IMPL-1"
  }
}
```

CCW ensures dependencies are completed before dependent tasks execute.

### Can I integrate CCW with CI/CD pipelines?

**Yes!** CCW can be used in automated workflows:

1. **Generate tests**:
   ```bash
   /workflow:test-gen WFS-feature
   /workflow:execute
   ```

2. **Run verification**:
   ```bash
   /workflow:action-plan-verify
   ```

3. **Automated reviews**:
   ```bash
   /workflow:review --type security
   ```

### How do I create custom workflows?

Combine existing commands:

```bash
# Custom TDD workflow
/workflow:tdd-plan "Feature"
/workflow:execute
/workflow:tdd-verify
/workflow:review --type quality
```

Or create custom command in `.claude/commands/`.

### What's the JSON-first architecture?

**Principle**: JSON files are the **single source of truth** for all task state.

- ✅ JSON files contain actual state
- ❌ Markdown documents are **read-only** generated views
- ✅ Edit JSON to change state
- ❌ Never edit markdown documents

**Benefits**:
- No synchronization complexity
- Programmatic access
- Clear data model
- Deterministic state

### How does context flow between agents?

Agents share context through:

1. **Session JSON**: Shared session state
2. **Task JSON**: Task-specific context
3. **CLAUDE.md**: Project knowledge base
4. **Flow Control**: Pre-analysis and implementation approach

### Can I use CCW for non-code projects?

**Yes!** CCW can manage any structured project:
- Documentation writing
- Content creation
- Data analysis
- Research projects
- Process automation

### How do I migrate from one CCW version to another?

1. **Backup customizations**: Save `.claude/` modifications
2. **Run installation**: Install new version
3. **Restore customizations**: Reapply your changes
4. **Check changelog**: Review breaking changes in [CHANGELOG.md](CHANGELOG.md)
5. **Test workflows**: Verify existing workflows work

### Where can I get more help?

- 📖 **Documentation**: [README.md](README.md), [GETTING_STARTED.md](GETTING_STARTED.md)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/catlog22/Claude-Code-Workflow/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues)
- 🤖 **Command Guide**: `CCW-help` within Claude Code
- 📚 **Examples**: [EXAMPLES.md](EXAMPLES.md)

---

## 📚 Additional Resources

- [Getting Started Guide](GETTING_STARTED.md) - 5-minute tutorial
- [Architecture Overview](ARCHITECTURE.md) - System design
- [Command Reference](COMMAND_REFERENCE.md) - All commands
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Examples](EXAMPLES.md) - Real-world use cases
- [Changelog](CHANGELOG.md) - Version history

---

**Last Updated**: 2025-11-20
**Version**: 5.8.1

**Didn't find your question?** Ask in [GitHub Discussions](https://github.com/catlog22/Claude-Code-Workflow/discussions)!
