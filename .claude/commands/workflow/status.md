---
name: workflow:status
description: Generate on-demand views for project overview and workflow tasks with optional task-id filtering for detailed view
argument-hint: "[optional: --project|task-id|--validate]"
---

# Workflow Status Command (/workflow:status)

## Overview
Generates on-demand views from project and session data. Supports two modes:
1. **Project Overview** (`--project`): Shows completed features and project statistics
2. **Workflow Tasks** (default): Shows current session task progress

No synchronization needed - all views are calculated from current JSON state.

## Usage
```bash
/workflow:status                    # Show current workflow session overview
/workflow:status --project          # Show project-level feature registry
/workflow:status impl-1             # Show specific task details
/workflow:status --validate         # Validate workflow integrity
```

## Implementation Flow

### Mode Selection

**Check for --project flag**:
- If `--project` flag present → Execute **Project Overview Mode**
- Otherwise → Execute **Workflow Session Mode** (default)

## Project Overview Mode

### Step 1: Check Project State
```bash
bash(test -f .workflow/project.json && echo "EXISTS" || echo "NOT_FOUND")
```

**If NOT_FOUND**:
```
No project state found.
Run /workflow:session:start to initialize project.
```

### Step 2: Read Project Data
```bash
bash(cat .workflow/project.json)
```

### Step 3: Parse and Display

**Data Processing**:
```javascript
const projectData = JSON.parse(Read('.workflow/project.json'));
const features = projectData.features || [];
const stats = projectData.statistics || {};
const overview = projectData.overview || null;

// Sort features by implementation date (newest first)
const sortedFeatures = features.sort((a, b) =>
  new Date(b.implemented_at) - new Date(a.implemented_at)
);
```

**Output Format** (with extended overview):
```
## Project: ${projectData.project_name}
Initialized: ${projectData.initialized_at}

${overview ? `
### Overview
${overview.description}

**Technology Stack**:
${overview.technology_stack.languages.map(l => `- ${l.name}${l.primary ? ' (primary)' : ''}: ${l.file_count} files`).join('\n')}
Frameworks: ${overview.technology_stack.frameworks.join(', ')}

**Architecture**:
Style: ${overview.architecture.style}
Patterns: ${overview.architecture.patterns.join(', ')}

**Key Components** (${overview.key_components.length}):
${overview.key_components.map(c => `- ${c.name} (${c.path})\n  ${c.description}`).join('\n')}

**Metrics**:
- Files: ${overview.metrics.total_files}
- Lines of Code: ${overview.metrics.lines_of_code}
- Complexity: ${overview.metrics.complexity}

---
` : ''}

### Completed Features (${stats.total_features})

${sortedFeatures.map(f => `
- ${f.title} (${f.timeline?.implemented_at || f.implemented_at})
  ${f.description}
  Tags: ${f.tags?.join(', ') || 'none'}
  Session: ${f.traceability?.session_id || f.session_id}
  Archive: ${f.traceability?.archive_path || 'unknown'}
  ${f.traceability?.commit_hash ? `Commit: ${f.traceability.commit_hash}` : ''}
`).join('\n')}

### Project Statistics
- Total Features: ${stats.total_features}
- Total Sessions: ${stats.total_sessions}
- Last Updated: ${stats.last_updated}

### Quick Access
- View session details: /workflow:status
- Archive query: jq '.archives[] | select(.session_id == "SESSION_ID")' .workflow/.archives/manifest.json
- Documentation: .workflow/docs/${projectData.project_name}/

### Query Commands
# Find by tag
cat .workflow/project.json | jq '.features[] | select(.tags[] == "auth")'

# View archive
cat ${feature.traceability.archive_path}/IMPL_PLAN.md

# List all tags
cat .workflow/project.json | jq -r '.features[].tags[]' | sort -u
```

**Empty State**:
```
## Project: ${projectData.project_name}
Initialized: ${projectData.initialized_at}

No features completed yet.

Complete your first workflow session to add features:
1. /workflow:plan "feature description"
2. /workflow:execute
3. /workflow:session:complete
```

### Step 4: Show Recent Sessions (Optional)

```bash
# List 5 most recent archived sessions
bash(ls -1t .workflow/.archives/WFS-* 2>/dev/null | head -5 | xargs -I {} basename {})
```

**Output**:
```
### Recent Sessions
- WFS-auth-system (archived)
- WFS-payment-flow (archived)
- WFS-user-dashboard (archived)

Use /workflow:session:complete to archive current session.
```

## Workflow Session Mode (Default)

### Step 1: Find Active Session
```bash
find .workflow/ -name ".active-*" -type f 2>/dev/null | head -1
```

### Step 2: Load Session Data
```bash
cat .workflow/WFS-session/workflow-session.json
```

### Step 3: Scan Task Files
```bash
find .workflow/WFS-session/.task/ -name "*.json" -type f 2>/dev/null
```

### Step 4: Generate Task Status
```bash
cat .workflow/WFS-session/.task/impl-1.json | jq -r '.status'
```

### Step 5: Count Task Progress
```bash
find .workflow/WFS-session/.task/ -name "*.json" -type f | wc -l
find .workflow/WFS-session/.summaries/ -name "*.md" -type f 2>/dev/null | wc -l
```

### Step 6: Display Overview
```markdown
# Workflow Overview
**Session**: WFS-session-name
**Progress**: 3/8 tasks completed

## Active Tasks
- [IN PROGRESS] impl-1: Current task in progress
- [ ] impl-2: Next pending task

## Completed Tasks
- [COMPLETED] impl-0: Setup completed
```

## Simple Bash Commands

### Basic Operations
- **Find active session**: `find .workflow/ -name ".active-*" -type f`
- **Read session info**: `cat .workflow/session/workflow-session.json`
- **List tasks**: `find .workflow/session/.task/ -name "*.json" -type f`
- **Check task status**: `cat task.json | jq -r '.status'`
- **Count completed**: `find .summaries/ -name "*.md" -type f | wc -l`

### Task Status Check
- **pending**: Not started yet
- **active**: Currently in progress
- **completed**: Finished with summary
- **blocked**: Waiting for dependencies

### Validation Commands
```bash
# Check session exists
test -f .workflow/.active-* && echo "Session active"

# Validate task files
for f in .workflow/session/.task/*.json; do jq empty "$f" && echo "Valid: $f"; done

# Check summaries match
find .task/ -name "*.json" -type f | wc -l
find .summaries/ -name "*.md" -type f 2>/dev/null | wc -l
```

## Simple Output Format

### Default Overview
```
Session: WFS-user-auth
Status: ACTIVE
Progress: 5/12 tasks

Current: impl-3 (Building API endpoints)
Next: impl-4 (Adding authentication)
Completed: impl-1, impl-2
```

### Task Details
```
Task: impl-1
Title: Build authentication module
Status: completed
Agent: code-developer
Created: 2025-09-15
Completed: 2025-09-15
Summary: .summaries/impl-1-summary.md
```

### Validation Results
```
Session file valid
8 task files found
3 summaries found
5 tasks pending completion
```

## Project Mode Quick Commands

### Basic Operations
```bash
# Check if project initialized
bash(test -f .workflow/project.json && echo "Initialized" || echo "Not initialized")

# Read project data
bash(cat .workflow/project.json)

# Count total features
bash(cat .workflow/project.json | jq '.statistics.total_features')

# List all feature IDs
bash(cat .workflow/project.json | jq -r '.features[].id')

# Find feature by keyword
bash(cat .workflow/project.json | jq '.features[] | select(.title | test("auth"; "i"))')

# Get most recent feature
bash(cat .workflow/project.json | jq '.features | sort_by(.implemented_at) | reverse | .[0]')

# List archived sessions
bash(ls -1t .workflow/.archives/WFS-* 2>/dev/null | head -5)
```

### Output Comparison

**Project Overview** (`--project`):
```
## Project: claude_dms3
Initialized: 2025-01-18T10:00:00Z

### Overview
TypeScript workflow automation system with AI agent orchestration

**Technology Stack**:
- TypeScript (primary): 150 files
- Bash: 30 files
Frameworks: Node.js

**Architecture**:
Style: Agent-based workflow orchestration with modular command system
Patterns: Command Pattern, Agent Pattern, Template Method

**Key Components** (3):
- Workflow Planning (.claude/commands/workflow)
  Multi-phase planning workflow with brainstorming and task generation
- Agent System (.claude/agents)
  Specialized agents for code development, testing, documentation
- CLI Tool Integration (.claude/scripts)
  Gemini, Qwen, Codex wrapper scripts for AI-powered analysis

**Metrics**:
- Files: 180
- Lines of Code: 15000
- Complexity: medium

---

### Completed Features (2)

- Authentication System (2025-01-15)
  JWT-based authentication with OAuth2 support
  Tags: auth, security, api
  Session: WFS-auth-system
  Archive: .workflow/.archives/WFS-auth-system
  Commit: a1b2c3d

- Workflow Planning (2025-01-10)
  Multi-phase planning workflow with agent coordination
  Tags: workflow, planning
  Session: WFS-workflow-v2
  Archive: .workflow/.archives/WFS-workflow-v2
  Commit: e5f6g7h

### Project Statistics
- Total Features: 2
- Total Sessions: 15
- Last Updated: 2025-01-18T15:30:00Z

### Query Commands
# Find by tag
cat .workflow/project.json | jq '.features[] | select(.tags[] == "auth")'

# View archive
cat .workflow/.archives/WFS-auth-system/IMPL_PLAN.md

# List all tags
cat .workflow/project.json | jq -r '.features[].tags[]' | sort -u

# Regenerate project analysis
/workflow:init --regenerate
```

**Session Overview** (default):
```
Session: WFS-user-auth
Status: ACTIVE
Progress: 5/12 tasks

Current: impl-3 (Building API endpoints)
Next: impl-4 (Adding authentication)
Completed: impl-1, impl-2
```