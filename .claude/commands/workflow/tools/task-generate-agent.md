---
name: task-generate-agent
description: Autonomous task generation using action-planning-agent with discovery and output phases
usage: /workflow:tools:task-generate-agent --session <session_id>
argument-hint: "--session WFS-session-id"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
---

# Autonomous Task Generation Command

## Overview
Autonomous task JSON and IMPL_PLAN.md generation using action-planning-agent with two-phase execution: discovery and document generation.

## Core Philosophy
- **Agent-Driven**: Delegate execution to action-planning-agent for autonomous operation
- **Two-Phase Flow**: Discovery (context gathering) → Output (document generation)
- **Memory-First**: Reuse loaded documents from conversation memory
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research

## Execution Lifecycle

### Phase 1: Discovery & Context Loading
**⚡ Memory-First Rule**: Skip file loading if documents already in conversation memory

**Agent Context Package**:
```javascript
{
  "session_id": "WFS-[session-id]",
  "session_metadata": {
    // If in memory: use cached content
    // Else: Load from .workflow/{session-id}/workflow-session.json
  },
  "analysis_results": {
    // If in memory: use cached content
    // Else: Load from .workflow/{session-id}/.process/ANALYSIS_RESULTS.md
  },
  "artifacts_inventory": {
    // If in memory: use cached list
    // Else: Scan .workflow/{session-id}/.brainstorming/ directory
    "synthesis_specification": "path or null",
    "topic_framework": "path or null",
    "role_analyses": ["paths"]
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

2. **Load Analysis Results** (if not in memory)
   ```javascript
   if (!memory.has("ANALYSIS_RESULTS.md")) {
     Read(.workflow/{session-id}/.process/ANALYSIS_RESULTS.md)
   }
   ```

3. **Discover Artifacts** (if not in memory)
   ```javascript
   if (!memory.has("artifacts_inventory")) {
     bash(find .workflow/{session-id}/.brainstorming/ -name "*.md" -type f)
   }
   ```

4. **MCP Code Analysis** (optional - enhance understanding)
   ```javascript
   // Find relevant files for task context
   mcp__code-index__find_files(pattern="*auth*")
   mcp__code-index__search_code_advanced(
     pattern="authentication|oauth",
     file_pattern="*.ts"
   )
   ```

5. **MCP External Research** (optional - gather best practices)
   ```javascript
   // Get external examples for implementation
   mcp__exa__get_code_context_exa(
     query="TypeScript JWT authentication best practices",
     tokensNum="dynamic"
   )
   ```

### Phase 2: Agent Execution (Document Generation)

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate task JSON and implementation plan",
  prompt=`
## Execution Context

**Session ID**: WFS-{session-id}
**Mode**: Two-Phase Autonomous Task Generation

## Phase 1: Discovery Results (Provided Context)

### Session Metadata
{session_metadata_content}

### Analysis Results
{analysis_results_content}

### Artifacts Inventory
- **Synthesis Specification**: {synthesis_spec_path}
- **Topic Framework**: {topic_framework_path}
- **Role Analyses**: {role_analyses_list}

### Context Package
{context_package_summary}

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
**Schema**: 5-field enhanced schema with artifacts

**Required Fields**:
\`\`\`json
{
  "id": "IMPL-N[.M]",
  "title": "Descriptive task name",
  "status": "pending",
  "meta": {
    "type": "feature|bugfix|refactor|test|docs",
    "agent": "@code-developer|@test-fix-agent|@general-purpose"
  },
  "context": {
    "requirements": ["extracted from analysis"],
    "focus_paths": ["src/paths"],
    "acceptance": ["measurable criteria"],
    "depends_on": ["IMPL-N"],
    "artifacts": [
      {
        "type": "synthesis_specification",
        "path": "{synthesis_spec_path}",
        "priority": "highest"
      }
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_synthesis_specification",
        "action": "Load consolidated synthesis specification",
        "commands": [
          "bash(ls {synthesis_spec_path} 2>/dev/null || echo 'not found')",
          "Read({synthesis_spec_path})"
        ],
        "output_to": "synthesis_specification",
        "on_error": "skip_optional"
      },
      {
        "step": "mcp_codebase_exploration",
        "action": "Explore codebase using MCP",
        "command": "mcp__code-index__find_files(pattern=\\"[patterns]\\") && mcp__code-index__search_code_advanced(pattern=\\"[patterns]\\")",
        "output_to": "codebase_structure"
      },
      {
        "step": "analyze_task_patterns",
        "action": "Analyze existing code patterns",
        "commands": [
          "bash(cd \\"[focus_paths]\\")",
          "bash(~/.claude/scripts/gemini-wrapper -p \\"PURPOSE: Analyze patterns TASK: Review '[title]' CONTEXT: [synthesis_specification] EXPECTED: Pattern analysis RULES: Prioritize synthesis-specification.md\\")"
        ],
        "output_to": "task_context",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement '[title]' following synthesis specification",
      "modification_points": ["Apply requirements from synthesis"],
      "logic_flow": [
        "Load synthesis specification",
        "Analyze existing patterns",
        "Implement following specification",
        "Validate against acceptance criteria"
      ]
    },
    "target_files": ["file:function:lines", "path/to/NewFile.ts"]
  }
}
\`\`\`

#### 2. IMPL_PLAN.md
**Location**: .workflow/{session-id}/IMPL_PLAN.md
**Structure**:
\`\`\`markdown
---
identifier: WFS-{session-id}
source: "User requirements"
analysis: .workflow/{session-id}/.process/ANALYSIS_RESULTS.md
---

# Implementation Plan: {Project Title}

## Summary
Core requirements, objectives, and technical approach.

## Context Analysis
- **Project**: Type, patterns, tech stack
- **Modules**: Components and integration points
- **Dependencies**: External libraries and constraints
- **Patterns**: Code conventions and guidelines

## Brainstorming Artifacts
- synthesis-specification.md (Highest priority)
- topic-framework.md (Medium priority)
- Role analyses: ui-designer, system-architect, etc.

## Task Breakdown
- **Task Count**: N tasks, complexity level
- **Hierarchy**: Flat/Two-level structure
- **Dependencies**: Task dependency graph

## Implementation Plan
- **Execution Strategy**: Sequential/Parallel approach
- **Resource Requirements**: Tools, dependencies, artifacts
- **Success Criteria**: Metrics and acceptance conditions
\`\`\`

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

### Execution Instructions

**Step 1: Extract Task Definitions**
- Parse analysis results for task recommendations
- Extract task ID, title, requirements, complexity
- Map artifacts to relevant tasks based on type

**Step 2: Generate Task JSON Files**
- Create individual .task/IMPL-*.json files
- Embed artifacts array with detected brainstorming outputs
- Generate flow_control with artifact loading steps
- Add MCP tool integration for codebase exploration

**Step 3: Create IMPL_PLAN.md**
- Summarize requirements and technical approach
- List detected artifacts with priorities
- Document task breakdown and dependencies
- Define execution strategy and success criteria

**Step 4: Generate TODO_LIST.md**
- List all tasks with container/leaf structure
- Link to task JSON files
- Use proper status indicators (▸, [ ], [x])

**Step 5: Update Session State**
- Update .workflow/{session-id}/workflow-session.json
- Mark session as ready for execution
- Record task count and artifact inventory

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
- Artifacts integrated: synthesis-spec, topic-framework, N role analyses
- MCP enhancements: code-index, exa-research
- Session ready for execution: /workflow:execute
`
)
```

## Command Integration

### Usage
```bash
# Basic usage
/workflow:tools:task-generate-agent --session WFS-auth

# Called by /workflow:plan
SlashCommand(command="/workflow:tools:task-generate-agent --session WFS-[id]")
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

  analysis_results: memory.has("ANALYSIS_RESULTS.md")
    ? memory.get("ANALYSIS_RESULTS.md")
    : Read(.workflow/WFS-[id]/.process/ANALYSIS_RESULTS.md),

  artifacts_inventory: memory.has("artifacts_inventory")
    ? memory.get("artifacts_inventory")
    : discoverArtifacts(),

  context_package: memory.has("context-package.json")
    ? memory.get("context-package.json")
    : Read(.workflow/WFS-[id]/.process/context-package.json),

  // Optional MCP enhancements
  mcp_analysis: executeMcpDiscovery()
}
```

## Related Commands
- `/workflow:plan` - Orchestrates planning and calls this command
- `/workflow:tools:task-generate` - Manual version without agent
- `/workflow:tools:context-gather` - Provides context package
- `/workflow:tools:concept-enhanced` - Provides analysis results
- `/workflow:execute` - Executes generated tasks

## Key Differences from task-generate

| Feature | task-generate | task-generate-agent |
|---------|--------------|-------------------|
| Execution | Manual/scripted | Agent-driven |
| Phases | 6 phases | 2 phases (discovery + output) |
| MCP Integration | Optional | Enhanced with examples |
| Decision Logic | Command-driven | Agent-autonomous |
| Complexity | Higher control | Simpler delegation |