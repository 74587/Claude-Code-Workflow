---
name: task-generate-agent
description: Generate implementation plan documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent - produces planning artifacts, does NOT execute code implementation
argument-hint: "--session WFS-session-id"
examples:
  - /workflow:tools:task-generate-agent --session WFS-auth
---

# Generate Implementation Plan Command

## Overview
Generate implementation planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) using action-planning-agent. This command produces **planning artifacts only** - it does NOT execute code implementation. Actual code implementation requires separate execution command (e.g., /workflow:execute).

## Core Philosophy
- **Planning Only**: Generate planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) - does NOT implement code
- **Agent-Driven Document Generation**: Delegate plan generation to action-planning-agent
- **N+1 Parallel Planning**: Auto-detect multi-module projects, enable parallel planning (2+1 or 3+1 mode)
- **Progressive Loading**: Load context incrementally (Core → Selective → On-Demand) due to analysis.md file size
- **Memory-First**: Reuse loaded documents from conversation memory
- **Smart Selection**: Load synthesis_output OR guidance + relevant role analyses, NOT all role analyses
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and research
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root (e.g., `./src/module`)

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session
   └─ Validation: session_id REQUIRED

Phase 1: Context Preparation & Module Detection (Command)
   ├─ Assemble session paths (metadata, context package, output dirs)
   ├─ Provide metadata (session_id, execution_mode, mcp_capabilities)
   ├─ Auto-detect modules from context-package + directory structure
   └─ Decision:
      ├─ modules.length == 1 → Single Agent Mode (Phase 2A)
      └─ modules.length >= 2 → Parallel Mode (Phase 2B + Phase 3)

Phase 2A: Single Agent Planning (Original Flow)
   ├─ Load context package (progressive loading strategy)
   ├─ Generate Task JSON Files (.task/IMPL-*.json)
   ├─ Create IMPL_PLAN.md
   └─ Generate TODO_LIST.md

Phase 2B: N Parallel Planning (Multi-Module)
   ├─ Launch N action-planning-agents simultaneously (one per module)
   ├─ Each agent generates module-scoped tasks (IMPL-{prefix}{seq}.json)
   ├─ Task ID format: IMPL-A1, IMPL-A2... / IMPL-B1, IMPL-B2...
   └─ Each module limited to ≤9 tasks

Phase 3: Integration (+1 Coordinator, Multi-Module Only)
   ├─ Collect all module task JSONs
   ├─ Resolve cross-module dependencies (CROSS::{module}::{pattern} → actual ID)
   ├─ Generate unified IMPL_PLAN.md (grouped by module)
   └─ Generate TODO_LIST.md (hierarchical: module → tasks)
```

## Document Generation Lifecycle

### Phase 1: Context Preparation & Module Detection (Command Responsibility)

**Command prepares session paths, metadata, and detects module structure.**

**Session Path Structure**:
```
.workflow/active/WFS-{session-id}/
├── workflow-session.json          # Session metadata
├── .process/
│   └── context-package.json       # Context package with artifact catalog
├── .task/                         # Output: Task JSON files
│   ├── IMPL-A1.json               # Multi-module: prefixed by module
│   ├── IMPL-A2.json
│   ├── IMPL-B1.json
│   └── ...
├── IMPL_PLAN.md                   # Output: Implementation plan (grouped by module)
└── TODO_LIST.md                   # Output: TODO list (hierarchical)
```

**Command Preparation**:
1. **Assemble Session Paths** for agent prompt:
   - `session_metadata_path`
   - `context_package_path`
   - Output directory paths

2. **Provide Metadata** (simple values):
   - `session_id`
   - `mcp_capabilities` (available MCP tools)

3. **Auto Module Detection** (determines single vs parallel mode):
   ```javascript
   function autoDetectModules(contextPackage, projectRoot) {
     // === Complexity Gate: Only parallelize for High complexity ===
     const complexity = contextPackage.metadata?.complexity || 'Medium';
     if (complexity !== 'High') {
       // Force single agent mode for Low/Medium complexity
       // This maximizes agent context reuse for related tasks
       return [{ name: 'main', prefix: '', paths: ['.'] }];
     }

     // Priority 1: Explicit frontend/backend separation
     if (exists('src/frontend') && exists('src/backend')) {
       return [
         { name: 'frontend', prefix: 'A', paths: ['src/frontend'] },
         { name: 'backend', prefix: 'B', paths: ['src/backend'] }
       ];
     }

     // Priority 2: Monorepo structure
     if (exists('packages/*') || exists('apps/*')) {
       return detectMonorepoModules();  // Returns 2-3 main packages
     }

     // Priority 3: Context-package dependency clustering
     const modules = clusterByDependencies(contextPackage.dependencies?.internal);
     if (modules.length >= 2) return modules.slice(0, 3);

     // Default: Single module (original flow)
     return [{ name: 'main', prefix: '', paths: ['.'] }];
   }
   ```

**Decision Logic**:
- `complexity !== 'High'` → Force Phase 2A (Single Agent, maximize context reuse)
- `modules.length == 1` → Phase 2A (Single Agent, original flow)
- `modules.length >= 2 && complexity == 'High'` → Phase 2B + Phase 3 (N+1 Parallel)

**Note**: CLI tool usage is now determined semantically by action-planning-agent based on user's task description, not by flags.

### Phase 2A: Single Agent Planning (Original Flow)

**Condition**: `modules.length == 1` (no multi-module detected)

**Purpose**: Generate IMPL_PLAN.md, task JSONs, and TODO_LIST.md - planning documents only, NOT code implementation.

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md)",
  prompt=`
## TASK OBJECTIVE
Generate implementation planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) for workflow session

IMPORTANT: This is PLANNING ONLY - you are generating planning documents, NOT implementing code.

CRITICAL: Follow the progressive loading strategy defined in agent specification (load analysis.md files incrementally due to file size)

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{session-id}/workflow-session.json
  - Context Package: .workflow/active/{session-id}/.process/context-package.json

Output:
  - Task Dir: .workflow/active/{session-id}/.task/
  - IMPL_PLAN: .workflow/active/{session-id}/IMPL_PLAN.md
  - TODO_LIST: .workflow/active/{session-id}/TODO_LIST.md

## CONTEXT METADATA
Session ID: {session-id}
MCP Capabilities: {exa_code, exa_web, code_index}

## CLI TOOL SELECTION
Determine CLI tool usage per-step based on user's task description:
- If user specifies "use Codex/Gemini/Qwen for X" → Add command field to relevant steps
- Default: Agent execution (no command field) unless user explicitly requests CLI

## EXPLORATION CONTEXT (from context-package.exploration_results)
- Load exploration_results from context-package.json
- Use aggregated_insights.critical_files for focus_paths generation
- Apply aggregated_insights.constraints to acceptance criteria
- Reference aggregated_insights.all_patterns for implementation approach
- Use aggregated_insights.all_integration_points for precise modification locations
- Use conflict_indicators for risk-aware task sequencing

## CONFLICT RESOLUTION CONTEXT (if exists)
- Check context-package.conflict_detection.resolution_file for conflict-resolution.json path
- If exists, load .process/conflict-resolution.json:
  - Apply planning_constraints as task constraints (for brainstorm-less workflows)
  - Reference resolved_conflicts for implementation approach alignment
  - Handle custom_conflicts with explicit task notes

## EXPECTED DELIVERABLES
1. Task JSON Files (.task/IMPL-*.json)
   - 6-field schema (id, title, status, context_package_path, meta, context, flow_control)
   - Quantified requirements with explicit counts
   - Artifacts integration from context package
   - **focus_paths enhanced with exploration critical_files**
   - Flow control with pre_analysis steps (include exploration integration_points analysis)

2. Implementation Plan (IMPL_PLAN.md)
   - Context analysis and artifact references
   - Task breakdown and execution strategy
   - Complete structure per agent definition

3. TODO List (TODO_LIST.md)
   - Hierarchical structure (containers, pending, completed markers)
   - Links to task JSONs and summaries
   - Matches task JSON hierarchy

## QUALITY STANDARDS
Hard Constraints:
  - Task count <= 18 (hard limit - request re-scope if exceeded)
  - All requirements quantified (explicit counts and enumerated lists)
  - Acceptance criteria measurable (include verification commands)
  - Artifact references mapped from context package
  - All documents follow agent-defined structure

## SUCCESS CRITERIA
- All planning documents generated successfully:
  - Task JSONs valid and saved to .task/ directory
  - IMPL_PLAN.md created with complete structure
  - TODO_LIST.md generated matching task JSONs
- Return completion status with document count and task breakdown summary
`
)
```

### Phase 2B: N Parallel Planning (Multi-Module)

**Condition**: `modules.length >= 2` (multi-module detected)

**Purpose**: Launch N action-planning-agents simultaneously, one per module, for parallel task JSON generation.

**Note**: Phase 2B agents generate Task JSONs ONLY. IMPL_PLAN.md and TODO_LIST.md are generated by Phase 3 Coordinator.

**Parallel Agent Invocation**:
```javascript
// Launch N agents in parallel (one per module)
const planningTasks = modules.map(module =>
  Task(
    subagent_type="action-planning-agent",
    description=`Generate ${module.name} module task JSONs`,
    prompt=`
## TASK OBJECTIVE
Generate task JSON files for ${module.name} module within workflow session

IMPORTANT: This is PLANNING ONLY - generate task JSONs, NOT implementing code.
IMPORTANT: Generate Task JSONs ONLY. IMPL_PLAN.md and TODO_LIST.md by Phase 3 Coordinator.

CRITICAL: Follow progressive loading strategy in agent specification

## MODULE SCOPE
- Module: ${module.name} (${module.type})
- Focus Paths: ${module.paths.join(', ')}
- Task ID Prefix: IMPL-${module.prefix}
- Task Limit: ≤9 tasks
- Other Modules: ${otherModules.join(', ')}

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{session-id}/workflow-session.json
  - Context Package: .workflow/active/{session-id}/.process/context-package.json
Output:
  - Task Dir: .workflow/active/{session-id}/.task/

## CONTEXT METADATA
Session ID: {session-id}
MCP Capabilities: {exa_code, exa_web, code_index}

## CROSS-MODULE DEPENDENCIES
- Use placeholder: depends_on: ["CROSS::{module}::{pattern}"]
- Example: depends_on: ["CROSS::B::api-endpoint"]
- Phase 3 Coordinator resolves to actual task IDs

## EXPECTED DELIVERABLES
Task JSON Files (.task/IMPL-${module.prefix}*.json):
  - 6-field schema per agent specification
  - Task ID format: IMPL-${module.prefix}1, IMPL-${module.prefix}2, ...
  - Focus ONLY on ${module.name} module scope

## SUCCESS CRITERIA
- Task JSONs saved to .task/ with IMPL-${module.prefix}* naming
- Cross-module dependencies use CROSS:: placeholder format
- Return task count and brief summary
    `
  )
);

// Execute all in parallel
await Promise.all(planningTasks);
```

**Output Structure** (direct to .task/):
```
.task/
├── IMPL-A1.json      # Module A (e.g., frontend)
├── IMPL-A2.json
├── IMPL-B1.json      # Module B (e.g., backend)
├── IMPL-B2.json
└── IMPL-C1.json      # Module C (e.g., shared)
```

**Task ID Naming**:
- Format: `IMPL-{prefix}{seq}.json`
- Prefix: A, B, C... (assigned by detection order)
- Sequence: 1, 2, 3... (per-module increment)

### Phase 3: Integration (+1 Coordinator Agent, Multi-Module Only)

**Condition**: Only executed when `modules.length >= 2`

**Purpose**: Collect all module tasks, resolve cross-module dependencies, generate unified IMPL_PLAN.md and TODO_LIST.md documents.

**Coordinator Agent Invocation**:
```javascript
// Wait for all Phase 2B agents to complete
const moduleResults = await Promise.all(planningTasks);

// Launch +1 Coordinator Agent
Task(
  subagent_type="action-planning-agent",
  description="Integrate module tasks and generate unified documents",
  prompt=`
## TASK OBJECTIVE
Integrate all module task JSONs, resolve cross-module dependencies, and generate unified IMPL_PLAN.md and TODO_LIST.md

IMPORTANT: This is INTEGRATION ONLY - consolidate existing task JSONs, NOT creating new tasks.

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{session-id}/workflow-session.json
  - Context Package: .workflow/active/{session-id}/.process/context-package.json
  - Task JSONs: .workflow/active/{session-id}/.task/IMPL-*.json (from Phase 2B)
Output:
  - Updated Task JSONs: .workflow/active/{session-id}/.task/IMPL-*.json (resolved dependencies)
  - IMPL_PLAN: .workflow/active/{session-id}/IMPL_PLAN.md
  - TODO_LIST: .workflow/active/{session-id}/TODO_LIST.md

## CONTEXT METADATA
Session ID: {session-id}
Modules: ${modules.map(m => m.name + '(' + m.prefix + ')').join(', ')}
Module Count: ${modules.length}

## INTEGRATION STEPS
1. Collect all .task/IMPL-*.json, group by module prefix
2. Resolve CROSS:: dependencies → actual task IDs, update task JSONs
3. Generate IMPL_PLAN.md (multi-module format per agent specification)
4. Generate TODO_LIST.md (hierarchical format per agent specification)

## CROSS-MODULE DEPENDENCY RESOLUTION
- Pattern: CROSS::{module}::{pattern} → IMPL-{module}* matching title/context
- Example: CROSS::B::api-endpoint → IMPL-B1 (if B1 title contains "api-endpoint")
- Log unresolved as warnings

## EXPECTED DELIVERABLES
1. Updated Task JSONs with resolved dependency IDs
2. IMPL_PLAN.md - multi-module format with cross-dependency section
3. TODO_LIST.md - hierarchical by module with cross-dependency section

## SUCCESS CRITERIA
- No CROSS:: placeholders remaining in task JSONs
- IMPL_PLAN.md and TODO_LIST.md generated with multi-module structure
- Return: task count, per-module breakdown, resolved dependency count
  `
)
```

**Dependency Resolution Algorithm**:
```javascript
function resolveCrossModuleDependency(placeholder, allTasks) {
  const [, targetModule, pattern] = placeholder.match(/CROSS::(\w+)::(.+)/);
  const candidates = allTasks.filter(t =>
    t.id.startsWith(`IMPL-${targetModule}`) &&
    (t.title.toLowerCase().includes(pattern.toLowerCase()) ||
     t.context?.description?.toLowerCase().includes(pattern.toLowerCase()))
  );
  return candidates.length > 0
    ? candidates.sort((a, b) => a.id.localeCompare(b.id))[0].id
    : placeholder; // Keep for manual resolution
}
```

