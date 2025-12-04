# CCW - Claude Code Workflow CLI

A command-line tool for viewing workflow sessions and code review results from the Claude Code Workflow system.

## Installation

```bash
# Install globally
npm install -g ccw

# Or install from local source
cd path/to/ccw
npm install
npm link
```

## Usage

### View Dashboard

```bash
# Open workflow dashboard in browser
ccw view

# Specify project path
ccw view -p /path/to/project

# Generate dashboard without opening browser
ccw view --no-browser

# Custom output path
ccw view -o report.html
```

## Features

### Workflow Dashboard
- **Active Sessions**: View all active workflow sessions with task progress
- **Archived Sessions**: Browse completed/archived sessions
- **Task Tracking**: See individual task status (pending/in_progress/completed)
- **Progress Bars**: Visual progress indicators for each session

### Review Integration
- **Code Review Findings**: View results from `review-module-cycle`
- **Severity Distribution**: Critical/High/Medium/Low finding counts
- **Dimension Analysis**: Findings by review dimension (Security, Architecture, Quality, etc.)
- **Tabbed Interface**: Switch between Workflow and Reviews tabs

## Dashboard Data Sources

The CLI reads data from the `.workflow/` directory structure:

```
.workflow/
├── active/
│   └── WFS-{session-id}/
│       ├── workflow-session.json    # Session metadata
│       ├── .task/
│       │   └── IMPL-*.json          # Task definitions
│       └── .review/
│           ├── review-progress.json # Review progress
│           └── dimensions/
│               └── *.json           # Dimension findings
└── archives/
    └── WFS-{session-id}/            # Archived sessions
```

## Bundled Templates

The CLI includes bundled dashboard templates:
- `workflow-dashboard.html` - Workflow session and task visualization
- `review-cycle-dashboard.html` - Code review findings display

No external template installation required - templates are included in the npm package.

## Requirements

- Node.js >= 16.0.0
- npm or yarn

## Integration with Claude Code Workflow

This CLI is a standalone tool that works with the Claude Code Workflow system:

1. **Install CCW CLI** (via npm)
   - `npm install -g ccw`
   - Provides `ccw view` command for dashboard viewing
   - Templates are bundled - no additional installation required

2. **Optional: Install Claude Code Workflow** (via `Install-Claude.ps1`)
   - Provides workflow commands, agents, and automation
   - CCW will automatically detect and display workflow sessions

## Options

| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Path to project directory (default: current directory) |
| `--no-browser` | Generate dashboard without opening browser |
| `-o, --output <file>` | Custom output path for HTML file |
| `-V, --version` | Display version number |
| `-h, --help` | Display help information |

## Development

```bash
# Clone and install dependencies
git clone <repo-url>
cd ccw
npm install

# Link for local testing
npm link

# Test the CLI
ccw view -p /path/to/test/project
```

## License

MIT
