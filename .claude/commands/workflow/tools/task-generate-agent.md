---
name: task-generate-agent
description: Autonomous task generation using action-planning-agent with discovery and output phases
argument-hint: "--session WFS-session-id [--cli-execute]"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
  - /workflow:tools:task-generate-agent --session WFS-auth --cli-execute
---

# Autonomous Task Generation Command

## Overview
Autonomous task JSON and IMPL_PLAN.md generation using action-planning-agent with two-phase execution: discovery and document generation. Supports both agent-driven execution (default) and CLI tool execution modes.

## Core Philosophy
- **Agent-Driven**: Delegate execution to action-planning-agent for autonomous operation
- **Two-Phase Flow**: Discovery (context gathering) → Output (document generation)
- **Memory-First**: Reuse loaded documents from conversation memory
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research
- **Pre-Selected Templates**: Command selects correct template based on `--cli-execute` flag **before** invoking agent
- **Agent Simplicity**: Agent receives pre-selected template and focuses only on content generation

## Execution Lifecycle

### Phase 1: Discovery & Context Loading
**⚡ Memory-First Rule**: Skip file loading if documents already in conversation memory

**Agent Context Package**:
```javascript
{
  "session_id": "WFS-[session-id]",
  "execution_mode": "agent-mode" | "cli-execute-mode",  // Determined by flag
  "task_json_template_path": "~/.claude/workflows/cli-templates/prompts/workflow/task-json-agent-mode.txt"
                           | "~/.claude/workflows/cli-templates/prompts/workflow/task-json-cli-mode.txt",
  // Path selected by command based on --cli-execute flag, agent reads it
  "session_metadata": {
    // If in memory: use cached content
    // Else: Load from .workflow/{session-id}/workflow-session.json
  },
  "brainstorm_artifacts": {
    // Loaded from context-package.json → brainstorm_artifacts section
    "role_analyses": [
      {
        "role": "system-architect",
        "files": [{"path": "...", "type": "primary|supplementary"}]
      }
    ],
    "guidance_specification": {"path": "...", "exists": true},
    "synthesis_output": {"path": "...", "exists": true},
    "conflict_resolution": {"path": "...", "exists": true}  // if conflict_risk >= medium
  },
  "context_package": {
    // If in memory: use cached content
    // Else: Load from .workflow/{session-id}/.process/context-package.json
  },
  "mcp_capabilities": {
    "code_index": true,
    "exa_code": true,
    "exa_web": true
  }
}
```

**Discovery Actions**:
1. **Load Session Context** (if not in memory)
   ```javascript
   if (!memory.has("workflow-session.json")) {
     Read(.workflow/{session-id}/workflow-session.json)
   }
   ```

2. **Load Context Package** (if not in memory)
   ```javascript
   if (!memory.has("context-package.json")) {
     Read(.workflow/{session-id}/.process/context-package.json)
   }
   ```

3. **Extract & Load Role Analyses** (from context-package.json)
   ```javascript
   // Extract role analysis paths from context package
   const roleAnalysisPaths = contextPackage.brainstorm_artifacts.role_analyses
     .flatMap(role => role.files.map(f => f.path));

   // Load each role analysis file
   roleAnalysisPaths.forEach(path => Read(path));
   ```

4. **Load Conflict Resolution** (from context-package.json, if exists)
   ```javascript
   if (contextPackage.brainstorm_artifacts.conflict_resolution?.exists) {
     Read(contextPackage.brainstorm_artifacts.conflict_resolution.path)
   }
   ```

5. **MCP Code Analysis** (optional - enhance understanding)
   ```javascript
   // Find relevant files for task context
   mcp__code-index__find_files(pattern="*auth*")
   mcp__code-index__search_code_advanced(
     pattern="authentication|oauth",
     file_pattern="*.ts"
   )
   ```

6. **MCP External Research** (optional - gather best practices)
   ```javascript
   // Get external examples for implementation
   mcp__exa__get_code_context_exa(
     query="TypeScript JWT authentication best practices",
     tokensNum="dynamic"
   )
   ```

### Phase 2: Agent Execution (Document Generation)

**Pre-Agent Template Selection** (Command decides path before invoking agent):
```javascript
// Command checks flag and selects template PATH (not content)
const templatePath = hasCliExecuteFlag
  ? "~/.claude/workflows/cli-templates/prompts/workflow/task-json-cli-mode.txt"
  : "~/.claude/workflows/cli-templates/prompts/workflow/task-json-agent-mode.txt";
```

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate task JSON and implementation plan",
  prompt=`
## Execution Context

**Session ID**: WFS-{session-id}
**Execution Mode**: {agent-mode | cli-execute-mode}
**Task JSON Template Path**: {template_path}

## Phase 1: Discovery Results (Provided Context)

### Session Metadata
{session_metadata_content}

### Role Analyses (Enhanced by Synthesis)
{role_analyses_content}
- Includes requirements, design specs, enhancements, and clarifications from synthesis phase

### Artifacts Inventory
- **Guidance Specification**: {guidance_spec_path}
- **Role Analyses**: {role_analyses_list}

### Context Package
{context_package_summary}
- Includes conflict_risk assessment

### Conflict Resolution (Conditional)
{conflict_resolution_content}
- Exists only if conflict_risk was medium/high
- Contains conflict detection results and resolution strategies

### MCP Analysis Results (Optional)
**Code Structure**: {mcp_code_index_results}
**External Research**: {mcp_exa_research_results}

## Phase 2: Document Generation Task

### Task Decomposition Standards
**Core Principle**: Task Merging Over Decomposition
- **Merge Rule**: Execute together when possible
- **Decompose Only When**:
  - Excessive workload (>2500 lines or >6 files)
  - Different tech stacks or domains
  - Sequential dependency blocking
  - Parallel execution needed

**Task Limits**:
- **Maximum 10 tasks** (hard limit)
- **Function-based**: Complete units (logic + UI + tests + config)
- **Hierarchy**: Flat (≤5) | Two-level (6-10) | Re-scope (>10)

### Required Outputs

#### 1. Task JSON Files (.task/IMPL-*.json)
**Location**: .workflow/{session-id}/.task/
**Template**: Read from the template path provided above

**Task JSON Template Loading**:
\`\`\`
Read({template_path})
\`\`\`

**Important**:
- Read the template from the path provided in context
- Use the template structure exactly as written
- Replace placeholder variables ({synthesis_spec_path}, {role_analysis_path}, etc.) with actual session-specific paths
- Include MCP tool integration in pre_analysis steps
- Map artifacts based on task domain (UI → ui-designer, Backend → system-architect)

#### 2. IMPL_PLAN.md
**Location**: .workflow/{session-id}/IMPL_PLAN.md

**IMPL_PLAN Template**:
\`\`\`
$(cat ~/.claude/workflows/cli-templates/prompts/workflow/impl-plan-template.txt)
\`\`\`

**Important**:
- Use the template above for IMPL_PLAN.md generation
- Replace all {placeholder} variables with actual session-specific values
- Populate CCW Workflow Context based on actual phase progression
- Extract content from role analyses and context-package.json
- List all detected brainstorming artifacts with correct paths (role analyses, guidance-specification.md)
- Include conflict resolution status if CONFLICT_RESOLUTION.md exists

#### 3. TODO_LIST.md
**Location**: .workflow/{session-id}/TODO_LIST.md
**Structure**:
\`\`\`markdown
# Tasks: {Session Topic}

## Task Progress
▸ **IMPL-001**: [Main Task Group] → [📋](./.task/IMPL-001.json)
  - [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/IMPL-001.1.json)
  - [ ] **IMPL-001.2**: [Subtask] → [📋](./.task/IMPL-001.2.json)

- [ ] **IMPL-002**: [Simple Task] → [📋](./.task/IMPL-002.json)

## Status Legend
- \`▸\` = Container task (has subtasks)
- \`- [ ]\` = Pending leaf task
- \`- [x]\` = Completed leaf task
\`\`\`

### Execution Instructions for Agent

**Agent Task**: Generate task JSON files, IMPL_PLAN.md, and TODO_LIST.md based on analysis results

**Note**: The correct task JSON template path has been pre-selected by the command based on the `--cli-execute` flag and is provided in the context as `{template_path}`.

**Step 1: Load Task JSON Template**
- Read template from the provided path: `Read({template_path})`
- This template is already the correct one based on execution mode

**Step 2: Extract and Decompose Tasks**
- Parse role analysis.md files for requirements, design specs, and task recommendations
- Review synthesis enhancements and clarifications in role analyses
- Apply conflict resolution strategies (if CONFLICT_RESOLUTION.md exists)
- Apply task merging rules (merge when possible, decompose only when necessary)
- Map artifacts to tasks based on domain (UI → ui-designer, Backend → system-architect, Data → data-architect)
- Ensure task count ≤10

**Step 3: Generate Task JSON Files**
- Use the template structure from Step 1
- Create .task/IMPL-*.json files with proper structure
- Replace all {placeholder} variables with actual session paths
- Embed artifacts array with brainstorming outputs
- Include MCP tool integration in pre_analysis steps

**Step 4: Create IMPL_PLAN.md**
- Use IMPL_PLAN template
- Populate all sections with session-specific content
- List artifacts with priorities and usage guidelines
- Document execution strategy and dependencies

**Step 5: Generate TODO_LIST.md**
- Create task progress checklist matching generated JSONs
- Use proper status indicators (▸, [ ], [x])
- Link to task JSON files

**Step 6: Update Session State**
- Update workflow-session.json with task count and artifact inventory
- Mark session ready for execution

### MCP Enhancement Examples

**Code Index Usage**:
\`\`\`javascript
// Discover authentication-related files
mcp__code-index__find_files(pattern="*auth*")

// Search for OAuth patterns
mcp__code-index__search_code_advanced(
  pattern="oauth|jwt|authentication",
  file_pattern="*.{ts,js}"
)

// Get file summary for key components
mcp__code-index__get_file_summary(
  file_path="src/auth/index.ts"
)
\`\`\`

**Exa Research Usage**:
\`\`\`javascript
// Get best practices for task implementation
mcp__exa__get_code_context_exa(
  query="TypeScript OAuth2 implementation patterns",
  tokensNum="dynamic"
)

// Research specific API usage
mcp__exa__get_code_context_exa(
  query="Express.js JWT middleware examples",
  tokensNum=5000
)
\`\`\`

### Quality Validation

Before completion, verify:
- [ ] All task JSON files created in .task/ directory
- [ ] Each task JSON has 5 required fields
- [ ] Artifact references correctly mapped
- [ ] Flow control includes artifact loading steps
- [ ] MCP tool integration added where appropriate
- [ ] IMPL_PLAN.md follows required structure
- [ ] TODO_LIST.md matches task JSONs
- [ ] Dependency graph is acyclic
- [ ] Task count within limits (≤10)
- [ ] Session state updated

## Output

Generate all three documents and report completion status:
- Task JSON files created: N files
- Artifacts integrated: synthesis-spec, guidance-specification, N role analyses
- MCP enhancements: code-index, exa-research
- Session ready for execution: /workflow:execute
`
)
```


### Agent Context Passing

**Memory-Aware Context Assembly**:
```javascript
// Assemble context package for agent
const agentContext = {
  session_id: "WFS-[id]",

  // Use memory if available, else load
  session_metadata: memory.has("workflow-session.json")
    ? memory.get("workflow-session.json")
    : Read(.workflow/WFS-[id]/workflow-session.json),

  context_package: memory.has("context-package.json")
    ? memory.get("context-package.json")
    : Read(.workflow/WFS-[id]/.process/context-package.json),

  // Extract brainstorm artifacts from context package
  brainstorm_artifacts: extractBrainstormArtifacts(context_package),

  // Load role analyses using paths from context package
  role_analyses: brainstorm_artifacts.role_analyses
    .flatMap(role => role.files)
    .map(file => Read(file.path)),

  // Load conflict resolution if exists (from context package)
  conflict_resolution: brainstorm_artifacts.conflict_resolution?.exists
    ? Read(brainstorm_artifacts.conflict_resolution.path)
    : null,

  // Optional MCP enhancements
  mcp_analysis: executeMcpDiscovery()
}
```
