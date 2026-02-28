# Getting Started with CCW

Welcome to CCW (Claude Code Workspace) - an advanced AI-powered development environment that helps you write better code faster.

## What is CCW?

CCW is a comprehensive development environment that combines:

- **Main Orchestrator (`/ccw`)**: Intent-aware workflow selection and automatic command routing
- **AI-Powered CLI Tools**: Analyze, review, and implement code with multiple AI backends
- **Specialized Agents**: Code execution, TDD development, testing, debugging, and documentation
- **Workflow Orchestration**: 4-level workflow system from spec to implementation
- **Extensible Skills**: 50+ built-in skills with custom skill support
- **MCP Integration**: Model Context Protocol for enhanced tool integration

## Quick Start

### Installation

```bash
# Install CCW globally
npm install -g claude-code-workflow

# Or use with npx
npx ccw --help
```

### Your First Workflow

Create a simple workflow in under 5 minutes:

```bash
# Main orchestrator - automatically selects workflow based on intent
/ccw "Create a new project"                    # Auto-selects appropriate workflow
/ccw "Analyze the codebase structure"          # Auto-selects analysis workflow
/ccw "Add user authentication"                 # Auto-selects implementation workflow

# Auto-mode - skip confirmation
/ccw -y "Fix the login timeout issue"          # Execute without confirmation prompts

# Or use specific workflow commands
/workflow:init                                  # Initialize project state
/workflow:plan "Add OAuth2 authentication"     # Create implementation plan
/workflow:execute                               # Execute planned tasks
```

## Next Steps

- [Installation Guide](./installation.md) - Detailed installation instructions
- [First Workflow](./first-workflow.md) - 30-minute quickstart tutorial
- [CLI Tools](./cli-tools.md) - Customize your CCW setup

::: tip Need Help?
Check out our [GitHub Discussions](https://github.com/your-repo/ccw/discussions) or join our [Discord community](https://discord.gg/ccw).
:::
