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
- Archive query: jq '.archives[] | select(.session_id == "SESSION_ID")' .workflow/archives/manifest.json
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
bash(ls -1t .workflow/archives/WFS-* 2>/dev/null | head -5 | xargs -I {} basename {})
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
find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | head -1
```

### Step 2: Load Session Data
```bash
cat .workflow/active/WFS-session/workflow-session.json
```

### Step 3: Scan Task Files
```bash
find .workflow/active/WFS-session/.task/ -name "*.json" -type f 2>/dev/null
```

### Step 4: Generate Task Status
```bash
cat .workflow/active/WFS-session/.task/impl-1.json | jq -r '.status'
```

### Step 5: Count Task Progress
```bash
find .workflow/active/WFS-session/.task/ -name "*.json" -type f | wc -l
find .workflow/active/WFS-session/.summaries/ -name "*.md" -type f 2>/dev/null | wc -l
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