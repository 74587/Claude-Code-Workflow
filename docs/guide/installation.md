# Installation

Learn how to install and configure CCW on your system.

## Prerequisites

Before installing CCW, make sure you have:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **Git** for version control features

## Install CCW

### Global Installation (Recommended)

```bash
npm install -g claude-code-workflow
```

### Project-Specific Installation

```bash
# In your project directory
npm install --save-dev claude-code-workflow

# Run with npx
npx ccw [command]
```

### Using Yarn

```bash
# Global
yarn global add claude-code-workflow

# Project-specific
yarn add -D claude-code-workflow
```

## Verify Installation

```bash
ccw --version
# Output: CCW v1.0.0

ccw --help
# Shows all available commands
```

## Configuration

### CLI Tools Configuration

Create or edit `~/.claude/cli-tools.json`:

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "debug"],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

### CLAUDE.md Instructions

Create `CLAUDE.md` in your project root:

```markdown
# Project Instructions

## Coding Standards
- Use TypeScript for type safety
- Follow ESLint configuration
- Write tests for all new features

## Architecture
- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
```

## Updating CCW

```bash
# Update to the latest version
npm update -g claude-code-workflow

# Or install a specific version
npm install -g claude-code-workflow@latest
```

## Uninstallation

```bash
npm uninstall -g claude-code-workflow

# Remove configuration (optional)
rm -rf ~/.claude
```

## Troubleshooting

### Permission Issues

If you encounter permission errors:

```bash
# Use sudo (not recommended)
sudo npm install -g claude-code-workflow

# Or fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### PATH Issues

Add npm global bin to your PATH:

```bash
# For bash/zsh
echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc

# For fish
echo 'set -gx PATH (npm config get prefix)/bin $PATH' >> ~/.config/fish/config.fish
```

::: info Next Steps
After installation, check out the [First Workflow](./first-workflow.md) guide.
:::
