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
Initializes `.workflow/project.json` with comprehensive project understanding by leveraging **cli-explore-agent** for intelligent analysis and **memory discovery** for SKILL package indexing.

**Key Features**:
- **Intelligent Project Analysis**: Uses cli-explore-agent's Deep Scan mode
- **Technology Stack Detection**: Identifies languages, frameworks, build tools
- **Architecture Overview**: Discovers patterns, layers, key components
- **Memory Discovery**: Scans and indexes available SKILL packages
- **Smart Recommendations**: Suggests memory commands based on project state
- **One-time Initialization**: Skips if project.json exists (unless --regenerate)

## Usage
```bash
/workflow:init                 # Initialize project state (skip if exists)
/workflow:init --regenerate    # Force regeneration of project.json
```

## Implementation Flow

### Step 1: Check Existing State

```bash
# Check if project.json already exists
bash(test -f .workflow/project.json && echo "EXISTS" || echo "NOT_FOUND")
```

**If EXISTS and no --regenerate flag**:
```
Project already initialized at .workflow/project.json
Use /workflow:init --regenerate to rebuild project analysis
Use /workflow:status --project to view current state
```

**If NOT_FOUND or --regenerate flag**: Proceed to initialization

### Step 2: Project Discovery

```bash
# Get project name and root
bash(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
bash(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Create .workflow directory
bash(mkdir -p .workflow)
```

### Step 3: Intelligent Project Analysis

**Invoke cli-explore-agent** with Deep Scan mode for comprehensive understanding:

```javascript
Task(
  subagent_type="cli-explore-agent",
  description="Deep project analysis",
  prompt=`
Analyze project structure and technology stack for workflow initialization.

## Analysis Objective
Perform Deep Scan analysis to build comprehensive project understanding for .workflow/project.json initialization.

## Required Analysis

### 1. Technology Stack Detection
- **Primary Languages**: Identify all programming languages with file counts
- **Frameworks**: Detect web frameworks (React, Vue, Express, Django, etc.)
- **Build Tools**: Identify build systems (npm, cargo, maven, gradle, etc.)
- **Test Frameworks**: Find testing tools (jest, pytest, go test, etc.)

### 2. Project Architecture
- **Architecture Style**: Identify patterns (MVC, microservices, monorepo, etc.)
- **Layer Structure**: Discover architectural layers (presentation, business, data)
- **Design Patterns**: Find common patterns (singleton, factory, repository, etc.)
- **Key Components**: List 5-10 core modules/components with brief descriptions

### 3. Project Metrics
- **Total Files**: Count source code files
- **Lines of Code**: Estimate total LOC
- **Module Count**: Number of top-level modules/packages
- **Complexity**: Overall complexity rating (low/medium/high)

### 4. Entry Points
- **Main Entry**: Identify primary application entry point(s)
- **CLI Commands**: Discover available commands/scripts
- **API Endpoints**: Find HTTP/REST/GraphQL endpoints (if applicable)

## Execution Mode
Use **Deep Scan** with Dual-Source Strategy:
- Phase 1: Bash structural scan (fast pattern discovery)
- Phase 2: Gemini semantic analysis (design intent, patterns)
- Phase 3: Synthesis (merge findings with attribution)

## Analysis Scope
- Root directory: ${projectRoot}
- Exclude: node_modules, dist, build, .git, vendor, __pycache__
- Focus: Source code directories (src, lib, pkg, app, etc.)

## Output Format
Return JSON structure for programmatic processing:

\`\`\`json
{
  "technology_stack": {
    "languages": [
      {"name": "TypeScript", "file_count": 150, "primary": true},
      {"name": "Python", "file_count": 30, "primary": false}
    ],
    "frameworks": ["React", "Express", "TypeORM"],
    "build_tools": ["npm", "webpack"],
    "test_frameworks": ["Jest", "Supertest"]
  },
  "architecture": {
    "style": "Layered MVC with Repository Pattern",
    "layers": ["presentation", "business-logic", "data-access"],
    "patterns": ["MVC", "Repository Pattern", "Dependency Injection"],
    "key_components": [
      {
        "name": "Authentication Module",
        "path": "src/auth",
        "description": "JWT-based authentication with OAuth2 support",
        "importance": "high"
      },
      {
        "name": "User Management",
        "path": "src/users",
        "description": "User CRUD operations and profile management",
        "importance": "high"
      }
    ]
  },
  "metrics": {
    "total_files": 180,
    "lines_of_code": 15000,
    "module_count": 12,
    "complexity": "medium"
  },
  "entry_points": {
    "main": "src/index.ts",
    "cli_commands": ["npm start", "npm test", "npm run build"],
    "api_endpoints": ["/api/auth", "/api/users", "/api/posts"]
  },
  "analysis_metadata": {
    "timestamp": "2025-01-18T10:30:00Z",
    "mode": "deep-scan",
    "source": "cli-explore-agent"
  }
}
\`\`\`

## Quality Requirements
- ✅ All technology stack items verified (no guessing)
- ✅ Key components include file paths for navigation
- ✅ Architecture style based on actual code patterns, not assumptions
- ✅ Metrics calculated from actual file counts/lines
- ✅ Entry points verified as executable
  `
)
```

**Agent Output**: JSON structure with comprehensive project analysis

### Step 4: Build project.json from Analysis

**Data Processing**:
```javascript
// Parse agent analysis output
const analysis = JSON.parse(agentOutput);

// Build complete project.json structure
const projectMeta = {
  // Basic metadata
  project_name: projectName,
  initialized_at: new Date().toISOString(),

  // Project overview (from cli-explore-agent)
  overview: {
    description: generateDescription(analysis), // e.g., "TypeScript web application with React frontend"
    technology_stack: analysis.technology_stack,
    architecture: {
      style: analysis.architecture.style,
      layers: analysis.architecture.layers,
      patterns: analysis.architecture.patterns
    },
    key_components: analysis.architecture.key_components,
    entry_points: analysis.entry_points,
    metrics: analysis.metrics
  },

  // Feature registry (initially empty, populated by complete)
  features: [],

  // Statistics
  statistics: {
    total_features: 0,
    total_sessions: 0,
    last_updated: new Date().toISOString()
  },

  // Analysis metadata
  _metadata: {
    initialized_by: "cli-explore-agent",
    analysis_timestamp: analysis.analysis_metadata.timestamp,
    analysis_mode: analysis.analysis_metadata.mode
  }
};

// Helper: Generate project description
function generateDescription(analysis) {
  const primaryLang = analysis.technology_stack.languages.find(l => l.primary);
  const frameworks = analysis.technology_stack.frameworks.slice(0, 2).join(', ');

  return `${primaryLang.name} project using ${frameworks}`;
}

// Write to .workflow/project.json
Write('.workflow/project.json', JSON.stringify(projectMeta, null, 2));
```

### Step 5: Output Summary

```
✓ Project initialized successfully

## Project Overview
Name: ${projectName}
Description: ${overview.description}

### Technology Stack
Languages: ${languages.map(l => l.name).join(', ')}
Frameworks: ${frameworks.join(', ')}

### Architecture
Style: ${architecture.style}
Components: ${key_components.length} core modules identified

### Project Metrics
Files: ${metrics.total_files}
LOC: ${metrics.lines_of_code}
Complexity: ${metrics.complexity}

### Memory Resources
SKILL Packages: ${memory_resources.skills.length}
Documentation: ${memory_resources.documentation.length} project(s)
Module Docs: ${memory_resources.module_docs.length} file(s)
Gaps: ${memory_resources.gaps.join(', ') || 'none'}

## Quick Start
• /workflow:plan "feature description" - Start new workflow
• /workflow:status --project - View project state

---
Project state saved to: .workflow/project.json
Memory index updated: ${memory_resources.last_scanned}
```

## Extended project.json Schema

### Complete Structure

```json
{
  "project_name": "claude_dms3",
  "initialized_at": "2025-01-18T10:00:00Z",

  "overview": {
    "description": "TypeScript workflow automation system with AI agent orchestration",
    "technology_stack": {
      "languages": [
        {"name": "TypeScript", "file_count": 150, "primary": true},
        {"name": "Bash", "file_count": 30, "primary": false}
      ],
      "frameworks": ["Node.js"],
      "build_tools": ["npm"],
      "test_frameworks": ["Jest"]
    },
    "architecture": {
      "style": "Agent-based workflow orchestration with modular command system",
      "layers": ["command-layer", "agent-orchestration", "cli-integration"],
      "patterns": ["Command Pattern", "Agent Pattern", "Template Method"]
    },
    "key_components": [
      {
        "name": "Workflow Planning",
        "path": ".claude/commands/workflow",
        "description": "Multi-phase planning workflow with brainstorming and task generation",
        "importance": "high"
      },
      {
        "name": "Agent System",
        "path": ".claude/agents",
        "description": "Specialized agents for code development, testing, documentation",
        "importance": "high"
      },
      {
        "name": "CLI Tool Integration",
        "path": ".claude/scripts",
        "description": "Gemini, Qwen, Codex wrapper scripts for AI-powered analysis",
        "importance": "medium"
      }
    ],
    "entry_points": {
      "main": ".claude/commands/workflow/plan.md",
      "cli_commands": ["/workflow:plan", "/workflow:execute", "/memory:docs"],
      "api_endpoints": []
    },
    "metrics": {
      "total_files": 180,
      "lines_of_code": 15000,
      "module_count": 12,
      "complexity": "medium"
    }
  },

  "features": [],

  "statistics": {
    "total_features": 0,
    "total_sessions": 0,
    "last_updated": "2025-01-18T10:00:00Z"
  },

  "memory_resources": {
    "skills": [
      {"name": "claude_dms3", "type": "project_docs", "path": ".claude/skills/claude_dms3"},
      {"name": "workflow-progress", "type": "workflow_progress", "path": ".claude/skills/workflow-progress"}
    ],
    "documentation": [
      {
        "name": "claude_dms3",
        "path": ".workflow/docs/claude_dms3",
        "has_readme": true,
        "has_architecture": true
      }
    ],
    "module_docs": [
      ".claude/commands/workflow/CLAUDE.md",
      ".claude/agents/CLAUDE.md"
    ],
    "gaps": ["tech_stack"],
    "last_scanned": "2025-01-18T10:05:00Z"
  },

  "_metadata": {
    "initialized_by": "cli-explore-agent",
    "analysis_timestamp": "2025-01-18T10:00:00Z",
    "analysis_mode": "deep-scan",
    "memory_scan_timestamp": "2025-01-18T10:05:00Z"
  }
}
```

### Phase 5: Discover Memory Resources

**Goal**: Scan and index available SKILL packages (memory command products) using agent delegation

**Invoke general-purpose agent** to discover and catalog all memory products:

```javascript
Task(
  subagent_type="general-purpose",
  description="Discover memory resources",
  prompt=`
Discover and index all memory command products: SKILL packages, documentation, and CLAUDE.md files.

## Discovery Scope
1. **SKILL Packages** (.claude/skills/) - Generated by /memory:skill-memory, /memory:tech-research, etc.
2. **Documentation** (.workflow/docs/) - Generated by /memory:docs
3. **Module Docs** (**/CLAUDE.md) - Generated by /memory:update-full, /memory:update-related

## Discovery Tasks

### 1. Scan SKILL Packages
- List all directories in .claude/skills/
- For each: extract name, classify type, record path
- Types: workflow-progress | codemap-* | style-* | tech_stacks | project_docs

### 2. Scan Documentation
- List directories in .workflow/docs/
- For each project: name, path, check README.md, ARCHITECTURE.md existence

### 3. Scan CLAUDE.md Files
- Find all **/CLAUDE.md (exclude: node_modules, .git, dist, build)
- Return path list only

### 4. Identify Gaps
- No project SKILL? → "project_skill"
- No documentation? → "documentation"
- Missing tech stack SKILL? → "tech_stack"
- No workflow-progress? → "workflow_history"
- <10% modules have CLAUDE.md? → "module_docs_low_coverage"

### 5. Return JSON:
{
  "skills": [
    {"name": "claude_dms3", "type": "project_docs", "path": ".claude/skills/claude_dms3"},
    {"name": "workflow-progress", "type": "workflow_progress", "path": ".claude/skills/workflow-progress"}
  ],
  "documentation": [
    {
      "name": "my_project",
      "path": ".workflow/docs/my_project",
      "has_readme": true,
      "has_architecture": true
    }
  ],
  "module_docs": [
    "src/core/CLAUDE.md",
    "lib/utils/CLAUDE.md"
  ],
  "gaps": ["tech_stack", "module_docs_low_coverage"]
}

## Context
- Project tech stack: ${JSON.stringify(analysis.technology_stack)}
- Check .workflow/.archives for session history
- If directories missing, return empty state with recommendations
  `
)
```

**Agent Output**: JSON structure with skills, documentation, module_docs, and gaps

**Update project.json**:
```javascript
const memoryDiscovery = JSON.parse(agentOutput);

projectMeta.memory_resources = {
  ...memoryDiscovery,
  last_scanned: new Date().toISOString()
};

Write('.workflow/project.json', JSON.stringify(projectMeta, null, 2));
```

**Output Summary**:
```
Memory Resources Indexed:
- SKILL Packages: ${skills.length}
- Documentation: ${documentation.length} project(s)
- Module Docs: ${module_docs.length} file(s)
- Gaps: ${gaps.join(', ') || 'none'}
```

---

## Regeneration Behavior

When using `--regenerate` flag:

1. **Backup existing file**:
   ```bash
   bash(cp .workflow/project.json .workflow/project.json.backup)
   ```

2. **Preserve features array**:
   ```javascript
   const existingMeta = JSON.parse(Read('.workflow/project.json'));
   const preservedFeatures = existingMeta.features || [];
   const preservedStats = existingMeta.statistics || {};
   ```

3. **Re-run cli-explore-agent analysis**

4. **Re-run memory discovery (Phase 5)**

5. **Merge preserved data with new analysis**:
   ```javascript
   const newProjectMeta = {
     ...analysisResults,
     features: preservedFeatures,        // Keep existing features
     statistics: preservedStats          // Keep statistics
   };
   ```

6. **Output**:
   ```
   ✓ Project analysis regenerated
   Backup saved: .workflow/project.json.backup

   Updated:
   - Technology stack analysis
   - Architecture overview
   - Key components discovery
   - Memory resources index

   Preserved:
   - ${preservedFeatures.length} existing features
   - Session statistics
   ```

## Error Handling

### Agent Failure
```
If cli-explore-agent fails:
1. Fall back to basic initialization
2. Use get_modules_by_depth.sh for structure
3. Create minimal project.json with placeholder overview
4. Log warning: "Project initialized with basic analysis. Run /workflow:init --regenerate for full analysis"
```

### Missing Tools
```
If Gemini CLI unavailable:
1. Agent uses Qwen fallback
2. If both fail, use bash-only analysis
3. Mark in _metadata: "analysis_mode": "bash-fallback"
```

### Invalid Project Root
```
If not in git repo and empty directory:
1. Warn user: "Empty project detected"
2. Create minimal project.json
3. Suggest: "Add code files and run /workflow:init --regenerate"
```

### Memory Discovery Failures

**Missing Directories**:
```
If .claude/skills, .workflow/docs, or CLAUDE.md files not found:
1. Return empty state for that category
2. Mark in gaps.missing array
3. Continue initialization
```

**Metadata Read Failures**:
```
If SKILL.md files are unreadable:
1. Include SKILL with basic info: name (from directory), type (inferred), path
2. Log warning: "SKILL package {name} has invalid metadata"
3. Continue with other SKILLs
```

**Coverage Check Failures**:
```
If unable to determine module doc coverage:
1. Skip adding "module_docs_low_coverage" to gaps
2. Continue with other gap checks
```

**Default Empty State**:
```json
{
  "memory_resources": {
    "skills": [],
    "documentation": [],
    "module_docs": [],
    "gaps": ["project_skill", "documentation", "tech_stack", "workflow_history", "module_docs"],
    "last_scanned": "ISO_TIMESTAMP"
  }
}
```
