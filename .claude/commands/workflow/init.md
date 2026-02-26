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
Initialize `.workflow/project-tech.json` and `.workflow/specs/*.md` with comprehensive project understanding by delegating analysis to **cli-explore-agent**.

**Dual File System**:
- `project-tech.json`: Auto-generated technical analysis (stack, architecture, components)
- `specs/*.md`: User-maintained rules and constraints (created as scaffold)

**Note**: This command may be called by other workflow commands. Upon completion, return immediately to continue the calling workflow without interrupting the task flow.

## Usage
```bash
/workflow:init                 # Initialize (skip if exists)
/workflow:init --regenerate    # Force regeneration
```

## Execution Process

```
Input Parsing:
   └─ Parse --regenerate flag → regenerate = true | false

Decision:
   ├─ BOTH_EXIST + no --regenerate → Exit: "Already initialized"
   ├─ EXISTS + --regenerate → Backup existing → Continue analysis
   └─ NOT_FOUND → Continue analysis

Analysis Flow:
   ├─ Get project metadata (name, root)
   ├─ Invoke cli-explore-agent
   │   ├─ Structural scan (get_modules_by_depth.sh, find, wc)
   │   ├─ Semantic analysis (Gemini CLI)
   │   ├─ Synthesis and merge
   │   └─ Write .workflow/project-tech.json
   ├─ Create guidelines scaffold (if not exists)
   │   └─ Write .workflow/specs/*.md (empty structure)
   ├─ Display summary
   └─ Ask about guidelines configuration
       ├─ If guidelines empty → Ask user: "Configure now?" or "Skip"
       │   ├─ Configure now → Skill(skill="workflow:init-guidelines")
       │   └─ Skip → Show next steps
       └─ If guidelines populated → Show next steps only

Output:
   ├─ .workflow/project-tech.json (+ .backup if regenerate)
   └─ .workflow/specs/*.md (scaffold or configured)
```

## Implementation

### Step 1: Parse Input and Check Existing State

**Parse --regenerate flag**:
```javascript
const regenerate = $ARGUMENTS.includes('--regenerate')
```

**Check existing state**:

```bash
bash(test -f .workflow/project-tech.json && echo "TECH_EXISTS" || echo "TECH_NOT_FOUND")
bash(test -f .workflow/specs/coding-conventions.md && echo "SPECS_EXISTS" || echo "SPECS_NOT_FOUND")
```

**If BOTH_EXIST and no --regenerate**: Exit early
```
Project already initialized:
- Tech analysis: .workflow/project-tech.json
- Guidelines: .workflow/specs/*.md

Use /workflow:init --regenerate to rebuild tech analysis
Use /workflow:session:solidify to add guidelines
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
bash(cp .workflow/project-tech.json .workflow/project-tech.json.backup)
```

**Delegate analysis to agent**:

```javascript
Task(
  subagent_type="cli-explore-agent",
  run_in_background=false,
  description="Deep project analysis",
  prompt=`
Analyze project for workflow initialization and generate .workflow/project-tech.json.

## MANDATORY FIRST STEPS
1. Execute: cat ~/.ccw/workflows/cli-templates/schemas/project-tech-schema.json (get schema reference)
2. Execute: ccw tool exec get_modules_by_depth '{}' (get project structure)

## Task
Generate complete project-tech.json following the schema structure:
- project_name: "${projectName}"
- initialized_at: ISO 8601 timestamp
- overview: {
    description: "Brief project description",
    technology_stack: {
      languages: [{name, file_count, primary}],
      frameworks: ["string"],
      build_tools: ["string"],
      test_frameworks: ["string"]
    },
    architecture: {style, layers: [], patterns: []},
    key_components: [{name, path, description, importance}]
  }
- features: []
- development_index: ${regenerate ? 'preserve from backup' : '{feature: [], enhancement: [], bugfix: [], refactor: [], docs: []}'}
- statistics: ${regenerate ? 'preserve from backup' : '{total_features: 0, total_sessions: 0, last_updated: ISO timestamp}'}
- _metadata: {initialized_by: "cli-explore-agent", analysis_timestamp: ISO timestamp, analysis_mode: "deep-scan"}

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

## Execution
1. Structural scan: get_modules_by_depth.sh, find, wc -l
2. Semantic analysis: Gemini for patterns/architecture
3. Synthesis: Merge findings
4. ${regenerate ? 'Merge with preserved development_index and statistics from .workflow/project-tech.json.backup' : ''}
5. Write JSON: Write('.workflow/project-tech.json', jsonContent)
6. Report: Return brief completion summary

Project root: ${projectRoot}
`
)
```

### Step 3.5: Initialize Spec System (if not exists)

```javascript
// Initialize spec system if not already initialized
if (!file_exists('.workflow/specs/coding-conventions.md')) {
  Bash('ccw spec init');
  Bash('ccw spec rebuild');
}
```

### Step 4: Display Summary

```javascript
const projectTech = JSON.parse(Read('.workflow/project-tech.json'));
const specsInitialized = file_exists('.workflow/specs/coding-conventions.md');

console.log(`
Project initialized successfully

## Project Overview
Name: ${projectTech.project_name}
Description: ${projectTech.overview.description}

### Technology Stack
Languages: ${projectTech.overview.technology_stack.languages.map(l => l.name).join(', ')}
Frameworks: ${projectTech.overview.technology_stack.frameworks.join(', ')}

### Architecture
Style: ${projectTech.overview.architecture.style}
Components: ${projectTech.overview.key_components.length} core modules

---
Files created:
- Tech analysis: .workflow/project-tech.json
- Specs: .workflow/specs/ ${specsInitialized ? '(initialized)' : ''}
${regenerate ? '- Backup: .workflow/project-tech.json.backup' : ''}
`);
```

### Step 5: Ask About Guidelines Configuration

After displaying the summary, ask the user if they want to configure project guidelines interactively.

```javascript
// Check if specs have user content beyond seed documents
const specsList = Bash('ccw spec list --json');
const specsCount = JSON.parse(specsList).total || 0;

// Only ask if specs are just seeds
if (specsCount <= 5) {
  const userChoice = AskUserQuestion({
    questions: [{
      question: "Would you like to configure project specs now? The wizard will ask targeted questions based on your tech stack.",
      header: "Specs",
      multiSelect: false,
      options: [
        {
          label: "Configure now (Recommended)",
          description: "Interactive wizard to set up coding conventions, constraints, and quality rules"
        },
        {
          label: "Skip for now",
          description: "You can run /workflow:init-guidelines later or use ccw spec load to import specs"
        }
      ]
    }]
  });

  if (userChoice.answers["Specs"] === "Configure now (Recommended)") {
    console.log("\nStarting specs configuration wizard...\n");
    Skill(skill="workflow:init-guidelines");
  } else {
    console.log(`
Next steps:
- Use /workflow:init-guidelines to configure specs interactively
- Use ccw spec load to import specs from external sources
- Use /workflow:plan to start planning
`);
  }
} else {
  console.log(`
Specs already configured (${specsCount} spec files).

Next steps:
- Use /workflow:init-guidelines --reset to reconfigure
- Use /workflow:session:solidify to add individual rules
- Use /workflow:plan to start planning
`);
}
```

## Error Handling

**Agent Failure**: Fall back to basic initialization with placeholder overview
**Missing Tools**: Agent uses Qwen fallback or bash-only
**Empty Project**: Create minimal JSON with all gaps identified

## Related Commands

- `/workflow:init-guidelines` - Interactive wizard to configure project guidelines (called after init)
- `/workflow:session:solidify` - Add individual rules/constraints one at a time
- `workflow-plan` skill - Start planning with initialized project context
- `/workflow:status --project` - View project state and guidelines
