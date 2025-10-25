---
name: gather
description: Intelligently collect project context using context-search-agent based on task description and package into standardized JSON
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
- **Standardized Output**: Generate `.workflow/{session}/.process/context-package.json`

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
  subagent_type="universal-executor",
  description="Gather comprehensive context for plan",
  prompt=`
You are executing as context-search-agent (.claude/agents/context-search-agent.md).

## Execution Mode
**PLAN MODE** (Comprehensive) - Full Phase 1-3 execution

## Session Information
- **Session ID**: ${session_id}
- **Task Description**: ${task_description}
- **Output Path**: .workflow/${session_id}/.process/context-package.json

## Mission
Execute complete context-search-agent workflow for implementation planning:

### Phase 1: Initialization & Pre-Analysis
1. **Detection**: Check for existing context-package (early exit if valid)
2. **Foundation**: Initialize code-index, get project structure, load docs
3. **Analysis**: Extract keywords, determine scope, classify complexity

### Phase 2: Multi-Source Context Discovery
Execute all 3 discovery tracks:
- **Track 1**: Reference documentation (CLAUDE.md, architecture docs)
- **Track 2**: Web examples (use Exa MCP for unfamiliar tech/APIs)
- **Track 3**: Codebase analysis (5-layer discovery: files, content, patterns, deps, config/tests)

### Phase 3: Synthesis, Assessment & Packaging
1. Apply relevance scoring and build dependency graph
2. Synthesize 3-source data (docs > code > web)
3. Integrate brainstorm artifacts (if .brainstorming/ exists, read content)
4. Perform conflict detection with risk assessment
5. Generate and validate context-package.json

## Output Requirements
Complete context-package.json with:
- **metadata**: task_description, keywords, complexity, tech_stack, session_id
- **project_context**: architecture_patterns, coding_conventions, tech_stack
- **assets**: {documentation[], source_code[], config[], tests[]} with relevance scores
- **dependencies**: {internal[], external[]} with dependency graph
- **brainstorm_artifacts**: {guidance_specification, role_analyses[], synthesis_output} with content
- **conflict_detection**: {risk_level, risk_factors, affected_modules[], mitigation_strategy}

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
- **project_context**: Architecture patterns, conventions, tech stack
- **assets**: Categorized files with relevance scores (documentation, source_code, config, tests)
- **dependencies**: Internal and external dependency graphs
- **brainstorm_artifacts**: Brainstorm documents with full content (if exists)
- **conflict_detection**: Risk assessment with mitigation strategies

## Usage Examples

### Basic Usage
```bash
/workflow:tools:context-gather --session WFS-auth-feature "Implement JWT authentication with refresh tokens"
```
## Success Criteria

- ✅ Valid context-package.json generated in `.workflow/{session}/.process/`
- ✅ Contains >80% relevant files based on task keywords
- ✅ Execution completes within 2 minutes
- ✅ All required schema fields present and valid
- ✅ Conflict risk accurately assessed
- ✅ Agent reports completion with statistics

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Package validation failed | Invalid session_id in existing package | Re-run agent to regenerate |
| Agent execution timeout | Large codebase or slow MCP | Increase timeout, check code-index status |
| Missing required fields | Agent incomplete execution | Check agent logs, verify schema compliance |
| File count exceeds limit | Too many relevant files | Agent should auto-prioritize top 50 by relevance |

## Notes

- **Detection-first**: Always check for existing package before invoking agent
- **Agent autonomy**: Agent handles all discovery logic per `.claude/agents/context-search-agent.md`
- **No redundancy**: This command is a thin orchestrator, all logic in agent
- **Plan-specific**: Use this for implementation planning; brainstorm mode uses direct agent call
