---
name: gather
description: Intelligently collect project context using context-search-agent based on task description, packages into standardized JSON
argument-hint: "--session WFS-session-id \"task description\""
examples:
  - /workflow:tools:context-gather --session WFS-user-auth "Implement user authentication system"
  - /workflow:tools:context-gather --session WFS-payment "Refactor payment module API"
  - /workflow:tools:context-gather --session WFS-bugfix "Fix login validation error"
allowed-tools: Task(*), Read(*), Glob(*)
---

# Context Gather Command (/workflow:tools:context-gather)

## Overview

Orchestrator command that invokes `context-search-agent` to gather comprehensive project context for implementation planning. Generates standardized `context-package.json` with codebase analysis, dependencies, and conflict detection.

**Agent**: `context-search-agent` (`.claude/agents/context-search-agent.md`)

## Core Philosophy

- **Agent Delegation**: Delegate all discovery to `context-search-agent` for autonomous execution
- **Detection-First**: Check for existing context-package before executing
- **Plan Mode**: Full comprehensive analysis (vs lightweight brainstorm mode)
- **Standardized Output**: Generate `.workflow/active/{session}/.process/context-package.json`

## Execution Flow

### Step 1: Context-Package Detection

**Execute First** - Check if valid package already exists:

```javascript
const contextPackagePath = `.workflow/${session_id}/.process/context-package.json`;

if (file_exists(contextPackagePath)) {
  const existing = Read(contextPackagePath);

  // Validate package belongs to current session
  if (existing?.metadata?.session_id === session_id) {
    console.log("✅ Valid context-package found for session:", session_id);
    console.log("📊 Stats:", existing.statistics);
    console.log("⚠️  Conflict Risk:", existing.conflict_detection.risk_level);
    return existing; // Skip execution, return existing
  } else {
    console.warn("⚠️ Invalid session_id in existing package, re-generating...");
  }
}
```

### Step 2: Invoke Context-Search Agent

**Only execute if Step 1 finds no valid package**

```javascript
Task(
  subagent_type="context-search-agent",
  description="Gather comprehensive context for plan",
  prompt=`
## Execution Mode
**PLAN MODE** (Comprehensive) - Full Phase 1-3 execution

## Session Information
- **Session ID**: ${session_id}
- **Task Description**: ${task_description}
- **Output Path**: .workflow/${session_id}/.process/context-package.json

## Mission
Execute complete context-search-agent workflow for implementation planning:

### Phase 1: Initialization & Pre-Analysis
1. **Project State Loading**: Read and parse `.workflow/project.json`. Use its `overview` section as the foundational `project_context`. This is your primary source for architecture, tech stack, and key components. If file doesn't exist, proceed with fresh analysis.
2. **Detection**: Check for existing context-package (early exit if valid)
3. **Foundation**: Initialize code-index, get project structure, load docs
4. **Analysis**: Extract keywords, determine scope, classify complexity based on task description and project state

### Phase 2: Multi-Source Context Discovery
Execute all 4 discovery tracks:
- **Track 1**: Historical archive analysis (query manifest.json for lessons learned)
- **Track 2**: Reference documentation (CLAUDE.md, architecture docs)
- **Track 3**: Web examples (use Exa MCP for unfamiliar tech/APIs)
- **Track 4**: Codebase analysis (5-layer discovery: files, content, patterns, deps, config/tests)

### Phase 3: Synthesis, Assessment & Packaging
1. Apply relevance scoring and build dependency graph
2. **Synthesize 4-source data**: Merge findings from all sources (archive > docs > code > web). **Prioritize the context from `project.json`** for architecture and tech stack unless code analysis reveals it's outdated.
3. **Populate `project_context`**: Directly use the `overview` from `project.json` to fill the `project_context` section of the output `context-package.json`. Include technology_stack, architecture, key_components, and entry_points.
4. Integrate brainstorm artifacts (if .brainstorming/ exists, read content)
5. Perform conflict detection with risk assessment
6. **Inject historical conflicts** from archive analysis into conflict_detection
7. Generate and validate context-package.json

## Output Requirements
Complete context-package.json with:
- **metadata**: task_description, keywords, complexity, tech_stack, session_id
- **project_context**: architecture_patterns, coding_conventions, tech_stack (sourced from `project.json` overview)
- **assets**: {documentation[], source_code[], config[], tests[]} with relevance scores
- **dependencies**: {internal[], external[]} with dependency graph
- **brainstorm_artifacts**: {guidance_specification, role_analyses[], synthesis_output} with content
- **conflict_detection**: {risk_level, risk_factors, affected_modules[], mitigation_strategy, historical_conflicts[]}

## Quality Validation
Before completion verify:
- [ ] Valid JSON format with all required fields
- [ ] File relevance accuracy >80%
- [ ] Dependency graph complete (max 2 transitive levels)
- [ ] Conflict risk level calculated correctly
- [ ] No sensitive data exposed
- [ ] Total files ≤50 (prioritize high-relevance)

Execute autonomously following agent documentation.
Report completion with statistics.
`
)
```

### Step 3: Output Verification

After agent completes, verify output:

```javascript
// Verify file was created
const outputPath = `.workflow/${session_id}/.process/context-package.json`;
if (!file_exists(outputPath)) {
  throw new Error("❌ Agent failed to generate context-package.json");
}
```

## Parameter Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--session` | string | ✅ | Workflow session ID (e.g., WFS-user-auth) |
| `task_description` | string | ✅ | Detailed task description for context extraction |

## Output Schema

Refer to `context-search-agent.md` Phase 3.7 for complete `context-package.json` schema.

**Key Sections**:
- **metadata**: Session info, keywords, complexity, tech stack
- **project_context**: Architecture patterns, conventions, tech stack (populated from `project.json` overview)
- **assets**: Categorized files with relevance scores (documentation, source_code, config, tests)
- **dependencies**: Internal and external dependency graphs
- **brainstorm_artifacts**: Brainstorm documents with full content (if exists)
- **conflict_detection**: Risk assessment with mitigation strategies and historical conflicts

## Historical Archive Analysis

### Track 1: Query Archive Manifest

The context-search-agent MUST perform historical archive analysis as Track 1 in Phase 2:

**Step 1: Check for Archive Manifest**
```bash
# Check if archive manifest exists
if [[ -f .workflow/archives/manifest.json ]]; then
  # Manifest available for querying
fi
```

**Step 2: Extract Task Keywords**
```javascript
// From current task description, extract key entities and operations
const keywords = extractKeywords(task_description);
// Examples: ["User", "model", "authentication", "JWT", "reporting"]
```

**Step 3: Search Archive for Relevant Sessions**
```javascript
// Query manifest for sessions with matching tags or descriptions
const relevantArchives = archives.filter(archive => {
  return archive.tags.some(tag => keywords.includes(tag)) ||
         keywords.some(kw => archive.description.toLowerCase().includes(kw.toLowerCase()));
});
```

**Step 4: Extract Watch Patterns**
```javascript
// For each relevant archive, check watch_patterns for applicability
const historicalConflicts = [];

relevantArchives.forEach(archive => {
  archive.lessons.watch_patterns?.forEach(pattern => {
    // Check if pattern trigger matches current task
    if (isPatternRelevant(pattern.pattern, task_description)) {
      historicalConflicts.push({
        source_session: archive.session_id,
        pattern: pattern.pattern,
        action: pattern.action,
        files_to_check: pattern.related_files,
        archived_at: archive.archived_at
      });
    }
  });
});
```

**Step 5: Inject into Context Package**
```json
{
  "conflict_detection": {
    "risk_level": "medium",
    "risk_factors": ["..."],
    "affected_modules": ["..."],
    "mitigation_strategy": "...",
    "historical_conflicts": [
      {
        "source_session": "WFS-auth-feature",
        "pattern": "When modifying User model",
        "action": "Check reporting-service and auditing-service dependencies",
        "files_to_check": ["src/models/User.ts", "src/services/reporting.ts"],
        "archived_at": "2025-09-16T09:00:00Z"
      }
    ]
  }
}
```

### Risk Level Escalation

If `historical_conflicts` array is not empty, minimum risk level should be "medium":

```javascript
if (historicalConflicts.length > 0 && currentRisk === "low") {
  conflict_detection.risk_level = "medium";
  conflict_detection.risk_factors.push(
    `${historicalConflicts.length} historical conflict pattern(s) detected from past sessions`
  );
}
```

### Archive Query Algorithm

```markdown
1. IF .workflow/archives/manifest.json does NOT exist → Skip Track 1, continue to Track 2
2. IF manifest exists:
   a. Load manifest.json
   b. Extract keywords from task_description (nouns, verbs, technical terms)
   c. Filter archives where:
      - ANY tag matches keywords (case-insensitive) OR
      - description contains keywords (case-insensitive substring match)
   d. For each relevant archive:
      - Read lessons.watch_patterns array
      - Check if pattern.pattern keywords overlap with task_description
      - If relevant: Add to historical_conflicts array
   e. IF historical_conflicts.length > 0:
      - Set risk_level = max(current_risk, "medium")
      - Add to risk_factors
3. Continue to Track 2 (reference documentation)
```

## Notes

- **Detection-first**: Always check for existing package before invoking agent
- **Project.json integration**: Agent reads `.workflow/project.json` as primary source for project context, avoiding redundant analysis
- **Agent autonomy**: Agent handles all discovery logic per `.claude/agents/context-search-agent.md`
- **No redundancy**: This command is a thin orchestrator, all logic in agent
- **Plan-specific**: Use this for implementation planning; brainstorm mode uses direct agent call
