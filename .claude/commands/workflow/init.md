---
name: init
description: Initialize project-level state with intelligent project analysis using cli-explore-agent
argument-hint: "[--regenerate]"
examples:
  - /workflow:init
  - /workflow:init --regenerate
---

# Workflow Init Command (/workflow:init)

## Overview
Initialize `.workflow/project.json` with comprehensive project understanding by delegating analysis to **cli-explore-agent**.

**Note**: This command may be called by other workflow commands. Upon completion, return immediately to continue the calling workflow without interrupting the task flow.

## Usage
```bash
/workflow:init                 # Initialize (skip if exists)
/workflow:init --regenerate    # Force regeneration
```

## Implementation

### Step 1: Check Existing State

```bash
bash(test -f .workflow/project.json && echo "EXISTS" || echo "NOT_FOUND")
```

**If EXISTS and no --regenerate**: Exit early
```
Project already initialized at .workflow/project.json
Use /workflow:init --regenerate to rebuild
Use /workflow:status --project to view state
```

### Step 2: Get Project Metadata

```bash
bash(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
bash(git rev-parse --show-toplevel 2>/dev/null || pwd)
bash(mkdir -p .workflow)
```

### Step 3: Invoke cli-explore-agent

**For --regenerate**: Backup and preserve existing data
```bash
bash(cp .workflow/project.json .workflow/project.json.backup)
```

**Delegate analysis to agent**:

```javascript
Task(
  subagent_type="cli-explore-agent",
  description="Deep project analysis",
  prompt=`
Analyze project for workflow initialization and generate .workflow/project.json.

## Output Schema Reference
~/.claude/workflows/cli-templates/schemas/project-json-schema.json

## Task
Generate complete project.json with:
- project_name: ${projectName}
- initialized_at: current ISO timestamp
- overview: {description, technology_stack, architecture, key_components, entry_points, metrics}
- features: ${regenerate ? 'preserve from backup' : '[] (empty)'}
- statistics: ${regenerate ? 'preserve from backup' : '{total_features: 0, total_sessions: 0, last_updated}'}
- memory_resources: {skills, documentation, module_docs, gaps, last_scanned}
- _metadata: {initialized_by: "cli-explore-agent", analysis_timestamp, analysis_mode}

## Analysis Requirements

**Technology Stack**:
- Languages: File counts, mark primary
- Frameworks: From package.json, requirements.txt, go.mod, etc.
- Build tools: npm, cargo, maven, webpack, vite
- Test frameworks: jest, pytest, go test, junit

**Architecture**:
- Style: MVC, microservices, layered (from structure & imports)
- Layers: presentation, business-logic, data-access
- Patterns: singleton, factory, repository
- Key components: 5-10 modules {name, path, description, importance}

**Metrics**:
- total_files: Source files (exclude tests/configs)
- lines_of_code: Use find + wc -l
- module_count: Use ~/.claude/scripts/get_modules_by_depth.sh
- complexity: low | medium | high

**Entry Points**:
- main: index.ts, main.py, main.go
- cli_commands: package.json scripts, Makefile targets
- api_endpoints: HTTP/REST routes (if applicable)

**Memory Resources**:
- skills: Scan .claude/skills/ → [{name, type, path}]
- documentation: Scan .workflow/docs/ → [{name, path, has_readme, has_architecture}]
- module_docs: Find **/CLAUDE.md (exclude node_modules, .git)
- gaps: Identify missing resources

## Execution
1. Structural scan: get_modules_by_depth.sh, find, wc -l
2. Semantic analysis: Gemini for patterns/architecture
3. Synthesis: Merge findings
4. ${regenerate ? 'Merge with preserved features/statistics from .workflow/project.json.backup' : ''}
5. Write JSON: Write('.workflow/project.json', jsonContent)
6. Report: Return brief completion summary

Project root: ${projectRoot}
`
)
```

### Step 4: Display Summary

```javascript
const projectJson = JSON.parse(Read('.workflow/project.json'));

console.log(`
✓ Project initialized successfully

## Project Overview
Name: ${projectJson.project_name}
Description: ${projectJson.overview.description}

### Technology Stack
Languages: ${projectJson.overview.technology_stack.languages.map(l => l.name).join(', ')}
Frameworks: ${projectJson.overview.technology_stack.frameworks.join(', ')}

### Architecture
Style: ${projectJson.overview.architecture.style}
Components: ${projectJson.overview.key_components.length} core modules

### Metrics
Files: ${projectJson.overview.metrics.total_files}
LOC: ${projectJson.overview.metrics.lines_of_code}
Complexity: ${projectJson.overview.metrics.complexity}

### Memory Resources
SKILL Packages: ${projectJson.memory_resources.skills.length}
Documentation: ${projectJson.memory_resources.documentation.length}
Module Docs: ${projectJson.memory_resources.module_docs.length}
Gaps: ${projectJson.memory_resources.gaps.join(', ') || 'none'}

---
Project state: .workflow/project.json
${regenerate ? 'Backup: .workflow/project.json.backup' : ''}
`);
```

## Error Handling

**Agent Failure**: Fall back to basic initialization with placeholder overview
**Missing Tools**: Agent uses Qwen fallback or bash-only
**Empty Project**: Create minimal JSON with all gaps identified
