--- 
name: task-generate
description: Generate task JSON files and IMPL_PLAN.md from analysis results with artifacts integration
argument-hint: "--session WFS-session-id [--cli-execute]"
examples:
  - /workflow:tools:task-generate --session WFS-auth
  - /workflow:tools:task-generate --session WFS-auth --cli-execute
---

# Task Generation Command

## 1. Overview
This command generates task JSON files and an `IMPL_PLAN.md` from brainstorming role analyses. It automatically detects and integrates all brainstorming artifacts (role-specific `analysis.md` files and `guidance-specification.md`), creating a structured and context-rich plan for implementation. The command supports two primary execution modes: a default agent-based mode for seamless context handling and a `--cli-execute` mode that leverages the Codex CLI for complex, autonomous development tasks. Its core function is to translate requirements and design specifications from role analyses into actionable, executable tasks, ensuring all necessary context, dependencies, and implementation steps are defined upfront.

## 2. Execution Modes

This command offers two distinct modes for task execution, providing flexibility for different implementation complexities.

### Agent Mode (Default)
In the default mode, each step in `implementation_approach` **omits the `command` field**. The agent interprets the step's `modification_points` and `logic_flow` to execute the task autonomously.
- **Step Structure**: Contains `step`, `title`, `description`, `modification_points`, `logic_flow`, `depends_on`, and `output` fields
- **Execution**: Agent reads these fields and performs the implementation autonomously
- **Context Loading**: Agent loads context via `pre_analysis` steps
- **Validation**: Agent validates against acceptance criteria in `context.acceptance`
- **Benefit**: Direct agent execution with full context awareness, no external tool overhead
- **Use Case**: Standard implementation tasks where agent capability is sufficient

### CLI Execute Mode (`--cli-execute`)
When the `--cli-execute` flag is used, each step in `implementation_approach` **includes a `command` field** that specifies the exact execution command. This mode is designed for complex implementations requiring specialized CLI tools.
- **Step Structure**: Includes all default fields PLUS a `command` field
- **Execution**: The specified command executes the step directly (e.g., `bash(codex ...)`)
- **Context Packages**: Each command receives context via the CONTEXT field in the prompt
- **Multi-Step Support**: Complex tasks can have multiple sequential codex steps with `resume --last`
- **Benefit**: Leverages specialized CLI tools (codex/gemini/qwen) for complex reasoning and autonomous execution
- **Use Case**: Large-scale features, complex refactoring, or when user explicitly requests CLI tool usage

## 3. Core Principles
This command is built on a set of core principles to ensure efficient and reliable task generation.

- **Role Analysis-Driven**: All generated tasks originate from role-specific `analysis.md` files (enhanced in synthesis phase), ensuring direct link between requirements/design and implementation
- **Artifact-Aware**: Automatically detects and integrates all brainstorming outputs (role analyses, guidance-specification.md, enhancements) to enrich task context
- **Context-Rich**: Embeds comprehensive context (requirements, focus paths, acceptance criteria, artifact references) directly into each task JSON
- **Flow-Control Ready**: Pre-defines clear execution sequence (`pre_analysis`, `implementation_approach`) within each task
- **Memory-First**: Prioritizes using documents already loaded in conversation memory to avoid redundant file operations
- **Mode-Flexible**: Supports both agent-driven execution (default) and CLI tool execution (with `--cli-execute` flag)
- **Multi-Step Support**: Complex tasks can use multiple sequential steps in `implementation_approach` with codex resume mechanism
- **Responsibility**: Parses analysis, detects artifacts, generates enhanced task JSONs, creates `IMPL_PLAN.md` and `TODO_LIST.md`, updates session state

## 4. Execution Flow
The command follows a streamlined, three-step process to convert analysis into executable tasks.

### Step 1: Input & Discovery
The process begins by gathering all necessary inputs. It follows a **Memory-First Rule**, skipping file reads if documents are already in the conversation memory.
1.  **Session Validation**: Loads and validates the session from `.workflow/{session_id}/workflow-session.json`.
2.  **Context Package Loading** (primary source): Reads `.workflow/{session_id}/.process/context-package.json` for smart context and artifact catalog.
3.  **Brainstorm Artifacts Extraction**: Extracts role analysis paths from `context-package.json` → `brainstorm_artifacts.role_analyses[]` (supports `analysis*.md` automatically).
4.  **Document Loading**: Reads role analyses, guidance specification, synthesis output, and conflict resolution (if exists) using paths from context package.

### Step 2: Task Decomposition & Grouping
Once all inputs are loaded, the command analyzes the tasks defined in the analysis results and groups them based on shared context.
1.  **Task Definition Parsing**: Extracts task definitions, requirements, and dependencies.
2.  **Context Signature Analysis**: Computes a unique hash (`context_signature`) for each task based on its `focus_paths` and referenced `artifacts`.
3.  **Task Grouping**:
    *   Tasks with the **same signature** are candidates for merging, as they operate on the same context.
    *   Tasks with **different signatures** and no dependencies are grouped for parallel execution.
    *   Tasks with `depends_on` relationships are marked for sequential execution.
4.  **Modification Target Determination**: Extracts specific code locations (`file:function:lines`) from the analysis to populate the `target_files` field.

### Step 3: Output Generation
Finally, the command generates all the necessary output files.
1.  **Task JSON Creation**: Creates individual `.task/IMPL-*.json` files, embedding all context, artifacts, and flow control steps. If `--cli-execute` is active, it generates the appropriate `codex exec` commands.
2.  **IMPL_PLAN.md Generation**: Creates the main implementation plan document, summarizing the strategy, tasks, and dependencies.
3.  **TODO_LIST.md Generation**: Creates a simple checklist for tracking task progress.
4.  **Session State Update**: Updates `workflow-session.json` with the final task count and artifact inventory, marking the session as ready for execution.

## 5. Task Decomposition Strategy
The command employs a sophisticated strategy to group and decompose tasks, optimizing for context reuse and parallel execution.

### Core Principles
- **Primary Rule: Shared Context → Merge Tasks**: Tasks that operate on the same files, use the same artifacts, and share the same tech stack are merged. This avoids redundant context loading and recognizes inherent relationships between the tasks.
- **Secondary Rule: Different Contexts + No Dependencies → Decompose for Parallel Execution**: Tasks that are fully independent (different files, different artifacts, no shared dependencies) are decomposed into separate parallel execution groups.

### Context Analysis for Task Grouping
The decision to merge or decompose is based on analyzing context indicators:

1.  **Shared Context Indicators (→ Merge)**:
    *   Identical `focus_paths` (working on the same modules/files).
    *   Same tech stack and dependencies.
    *   Identical `context.artifacts` references.
    *   A sequential logic flow within the same feature.
    *   Shared test fixtures or setup.

2.  **Independent Context Indicators (→ Decompose)**:
    *   Different `focus_paths` (separate modules).
    *   Different tech stacks (e.g., frontend vs. backend).
    *   Different `context.artifacts` (using different brainstorming outputs).
    *   No shared dependencies.
    *   Can be tested independently.

**Decomposition is only performed when**:
- Tasks have different contexts and no shared dependencies (enabling parallel execution).
- A single task represents an excessive workload (e.g., >2500 lines of code or >6 files to modify).
- A sequential dependency creates a necessary block (e.g., IMPL-1 must complete before IMPL-2 can start).

### Context Signature Algorithm
To automate grouping, a `context_signature` is computed for each task.

```javascript
// Compute context signature for task grouping
function computeContextSignature(task) {
  const focusPathsStr = task.context.focus_paths.sort().join('|');
  const artifactsStr = task.context.artifacts.map(a => a.path).sort().join('|');
  const techStack = task.context.shared_context?.tech_stack?.sort().join('|') || '';

  return hash(`${focusPathsStr}:${artifactsStr}:${techStack}`);
}
```

### Execution Group Assignment
Tasks are assigned to execution groups based on their signatures and dependencies.

```javascript
// Group tasks by context signature
function groupTasksByContext(tasks) {
  const groups = {};

  tasks.forEach(task => {
    const signature = computeContextSignature(task);
    if (!groups[signature]) {
      groups[signature] = [];
    }
    groups[signature].push(task);
  });

  return groups;
}

// Assign execution groups for parallel tasks
function assignExecutionGroups(tasks) {
  const contextGroups = groupTasksByContext(tasks);

  Object.entries(contextGroups).forEach(([signature, groupTasks]) => {
    if (groupTasks.length === 1) {
      const task = groupTasks[0];
      // Single task with unique context
      if (!task.context.depends_on || task.context.depends_on.length === 0) {
        task.meta.execution_group = `parallel-${signature.slice(0, 8)}`;
      } else {
        task.meta.execution_group = null; // Sequential task
      }
    } else {
      // Multiple tasks with same context → Should be merged
      console.warn(`Tasks ${groupTasks.map(t => t.id).join(', ')} share context and should be merged`);
      // Merge tasks into single task
      return mergeTasks(groupTasks);
    }
  });
}
```
**Task Limits**:
- **Maximum 10 tasks** (hard limit).
- **Hierarchy**: Flat (≤5 tasks) or two-level (6-10 tasks). If >10, the scope should be re-evaluated.
- **Parallel Groups**: Tasks with the same `execution_group` ID are independent and can run concurrently.

## 6. Generated Outputs
The command produces three key documents and a directory of task files.

### 6.1. Task JSON Schema (`.task/IMPL-*.json`)
This enhanced 5-field schema embeds all necessary context, artifacts, and execution steps.

```json
{
  "id": "IMPL-N[.M]",
  "title": "Descriptive task name",
  "status": "pending|active|completed|blocked|container",
  "meta": {
    "type": "feature|bugfix|refactor|test-gen|test-fix|docs",
    "agent": "@code-developer|@test-fix-agent|@universal-executor",
    "execution_group": "group-id|null",
    "context_signature": "hash-of-focus_paths-and-artifacts"
  },
  "context": {
    "requirements": ["Clear requirement from analysis"],
    "focus_paths": ["src/module/path", "tests/module/path"],
    "acceptance": ["Measurable acceptance criterion"],
    "parent": "IMPL-N",
    "depends_on": ["IMPL-N.M"],
    "inherited": {"shared_patterns": [], "common_dependencies": []},
    "shared_context": {"tech_stack": [], "conventions": []},
    "artifacts": [
      {
        "path": "{{from context-package.json → brainstorm_artifacts.role_analyses[].files[].path}}",
        "priority": "highest",
        "usage": "Role-specific requirements, design specs, enhanced by synthesis. Paths loaded dynamically from context-package.json (supports multiple files per role: analysis.md, analysis-01.md, analysis-api.md, etc.). Common roles: product-manager, system-architect, ui-designer, data-architect, ux-expert."
      },
      {
        "path": ".workflow/WFS-[session]/.process/context-package.json",
        "priority": "critical",
        "usage": "Smart context with focus paths, module structure, dependency graph, existing patterns, tech stack. Use for: environment setup, dependency resolution, pattern discovery, conflict detection results"
      },
      {
        "path": ".workflow/WFS-[session]/.process/CONFLICT_RESOLUTION.md",
        "priority": "high",
        "usage": "Conflict resolution strategies and selected approaches (conditional, exists only if conflict_risk was medium/high). Use for: understanding code conflicts, applying resolution strategies, migration planning"
      },
      {
        "path": ".workflow/WFS-[session]/.brainstorming/guidance-specification.md",
        "priority": "medium",
        "usage": "Discussion context and framework structure"
      }
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_context_package",
        "action": "Load context package for artifact paths",
        "commands": [
          "Read(.workflow/WFS-[session]/.process/context-package.json)"
        ],
        "output_to": "context_package",
        "on_error": "fail"
      },
      {
        "step": "load_role_analysis_artifacts",
        "action": "Load role analyses from context-package.json (supports multiple files per role)",
        "note": "Paths loaded from context-package.json → brainstorm_artifacts.role_analyses[]. Supports analysis*.md automatically.",
        "commands": [
          "Read(.workflow/WFS-[session]/.process/context-package.json)",
          "Extract(brainstorm_artifacts.role_analyses[].files[].path)",
          "Read(each extracted path)"
        ],
        "output_to": "role_analysis_artifacts",
        "on_error": "skip_optional"
      },
      {
        "step": "load_planning_context",
        "action": "Load plan-generated context intelligence and conflict resolution",
        "note": "CRITICAL: context-package.json provides smart context (focus paths, dependencies, patterns). CONFLICT_RESOLUTION.md (if exists) provides conflict resolution strategies.",
        "commands": [
          "Read(.workflow/WFS-[session]/.process/context-package.json)",
          "bash(test -f .workflow/WFS-[session]/.process/CONFLICT_RESOLUTION.md && cat .workflow/WFS-[session]/.process/CONFLICT_RESOLUTION.md || echo 'No conflicts detected')"
        ],
        "output_to": "planning_context",
        "on_error": "fail",
        "usage_guidance": {
          "context-package.json": "Use for focus_paths validation, dependency resolution, existing pattern discovery, module structure understanding, conflict_risk assessment",
          "CONFLICT_RESOLUTION.md": "Apply selected conflict resolution strategies, understand migration requirements (conditional, may not exist if no conflicts)"
        }
      },
      {
        "step": "mcp_codebase_exploration",
        "action": "Explore codebase using MCP tools",
        "command": "mcp__code-index__find_files(pattern=\"[patterns]\") && mcp__code-index__search_code_advanced(pattern=\"[patterns]\")",
        "output_to": "codebase_structure"
      },
      {
        "step": "analyze_task_patterns",
        "action": "Analyze existing code patterns and identify modification targets",
        "commands": [
          "bash(cd \"[focus_paths]\")",
          "bash(gemini \"PURPOSE: Identify modification targets TASK: Analyze '[title]' and locate specific files/functions/lines to modify CONTEXT: [role_analyses] [individual_artifacts] EXPECTED: Code locations in format 'file:function:lines' RULES: Consult role analyses for requirements, identify exact modification points\")"
        ],
        "output_to": "task_context_with_targets",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Implement task following role analyses and context",
        "description": "Implement '[title]' following this priority: 1) role analysis.md files (requirements, design specs, enhancements from synthesis), 2) context-package.json (smart context, focus paths, patterns), 3) CONFLICT_RESOLUTION.md (if exists, conflict resolution strategies). Role analyses are enhanced by synthesis phase with concept improvements and clarifications.",
        "modification_points": [
          "Apply requirements and design specs from role analysis documents",
          "Use enhancements and clarifications from synthesis phase",
          "Apply conflict resolution strategies (if conflicts were detected)",
          "Use context-package.json for focus paths and dependency resolution",
          "Consult specific role artifacts for implementation details when needed",
          "Integrate with existing patterns"
        ],
        "logic_flow": [
          "Load role analyses (requirements, design, enhancements from synthesis)",
          "Load context-package.json (smart context: focus paths, dependencies, patterns, conflict_risk)",
          "Load CONFLICT_RESOLUTION.md (if exists, conflict resolution strategies)",
          "Extract requirements and design decisions from role documents",
          "Review synthesis enhancements and clarifications",
          "Apply conflict resolution strategies (if applicable)",
          "Identify modification targets using context package",
          "Implement following role requirements and design specs",
          "Consult role artifacts for detailed specifications when needed",
          "Validate against acceptance criteria"
        ],
        "depends_on": [],
        "output": "implementation"
      }
    ],
    "target_files": ["file:function:lines"]
  }
}
```

### 6.2. IMPL_PLAN.md Structure
This document provides a high-level overview of the entire implementation plan.

```markdown
---
identifier: WFS-{session-id}
source: "User requirements" | "File: path" | "Issue: ISS-001"
role_analyses: .workflow/{session-id}/.brainstorming/[role]/analysis*.md
artifacts: .workflow/{session-id}/.brainstorming/
context_package: .workflow/{session-id}/.process/context-package.json  # CCW smart context
conflict_resolution: .workflow/{session-id}/.process/CONFLICT_RESOLUTION.md  # Conditional, if conflict_risk >= medium
workflow_type: "standard | tdd | design"  # Indicates execution model
verification_history:  # CCW quality gates
  synthesis_clarify: "passed | skipped | pending"  # Brainstorm phase clarification
  action_plan_verify: "pending"
phase_progression: "brainstorm → synthesis → context → conflict_resolution → planning"  # CCW workflow phases
---

# Implementation Plan: {Project Title}

## 1. Summary
Core requirements, objectives, technical approach summary (2-3 paragraphs max).

**Core Objectives**:
- [Key objective 1]
- [Key objective 2]

**Technical Approach**:
- [High-level approach]

## 2. Context Analysis

### CCW Workflow Context
**Phase Progression**:
- ✅ Phase 1: Brainstorming (role analyses generated by participating roles)
- ✅ Phase 2: Synthesis (concept enhancement + clarification, {N} questions answered, role analyses refined)
- ✅ Phase 3: Context Gathering (context-package.json: {N} files, {M} modules analyzed, conflict_risk: {level})
- ✅ Phase 4: Conflict Resolution ({status}: {conflict_count} conflicts detected and resolved | skipped if no conflicts)
- ⏳ Phase 5: Task Generation (current phase - generating IMPL_PLAN.md and task JSONs)

**Quality Gates**:
- synthesis-clarify: ✅ Passed ({N} ambiguities resolved, {M} enhancements applied)
- action-plan-verify: ⏳ Pending (recommended before /workflow:execute)

**Context Package Summary**:
- **Focus Paths**: {list key directories from context-package.json}
- **Key Files**: {list primary files for modification}
- **Module Depth Analysis**: {from get_modules_by_depth.sh output}
- **Smart Context**: {total file count} files, {module count} modules, {dependency count} dependencies identified

### Project Profile
- **Type**: Greenfield/Enhancement/Refactor
- **Scale**: User count, data volume, complexity
- **Tech Stack**: Primary technologies
- **Timeline**: Duration and milestones

### Module Structure
'''
[Directory tree showing key modules]
'''

### Dependencies
**Primary**: [Core libraries and frameworks]
**APIs**: [External services]
**Development**: [Testing, linting, CI/CD tools]

### Patterns & Conventions
- **Architecture**: [Key patterns like DI, Event-Driven]
- **Component Design**: [Design patterns]
- **State Management**: [State strategy]
- **Code Style**: [Naming, TypeScript coverage]

## 3. Brainstorming Artifacts Reference

### Artifact Usage Strategy
**Primary Reference (Role Analyses)**:
- **What**: Role-specific analyses from brainstorming phase providing multi-perspective insights
- **When**: Every task references relevant role analyses for requirements and design decisions
- **How**: Extract requirements, architecture decisions, UI/UX patterns from applicable role documents
- **Priority**: Collective authoritative source - multiple role perspectives provide comprehensive coverage
- **CCW Value**: Maintains role-specific expertise while enabling cross-role integration during planning

**Context Intelligence (context-package.json)**:
- **What**: Smart context gathered by CCW's context-gather phase
- **Content**: Focus paths, dependency graph, existing patterns, module structure, tech stack, conflict_risk assessment
- **Usage**: Tasks load this via `flow_control.preparatory_steps` for environment setup and conflict awareness
- **CCW Value**: Automated intelligent context discovery replacing manual file exploration

**Conflict Resolution (CONFLICT_RESOLUTION.md)**:
- **What**: Conflict analysis and resolution strategies (conditional, exists only if conflict_risk >= medium)
- **Content**: Conflict detection results, resolution options, selected strategies, migration requirements
- **Usage**: Referenced in task planning for applying conflict resolution strategies and understanding code conflicts
- **CCW Value**: CLI-powered conflict detection and strategic resolution guidance for complex codebases

### Role Analysis Documents (Highest Priority)
Role analyses provide specialized perspectives on the implementation:
- **system-architect/analysis.md**: Architecture design, ADRs, API specifications, caching strategies
- **ui-designer/analysis.md**: Design tokens, layout specifications, component patterns
- **ux-expert/analysis.md**: User journeys, interaction flows, accessibility requirements
- **guidance-specification/analysis.md**: Product vision, user stories, business requirements, success metrics
- **data-architect/analysis.md**: Data models, schemas, database design, migration strategies
- **api-designer/analysis.md**: API contracts, endpoint specifications, integration patterns

### Supporting Artifacts (Reference)
- **topic-framework.md**: Role-specific discussion points and analysis framework

**Artifact Priority in Development**:
1. context-package.json (primary source: smart context AND brainstorm artifact catalog in `brainstorm_artifacts`)
2. role/analysis*.md (paths from context-package.json: requirements, design specs, enhanced by synthesis)
3. CONFLICT_RESOLUTION.md (path from context-package.json: conflict strategies, if conflict_risk >= medium)
4. guidance-specification.md (path from context-package.json: discussion framework)

## 4. Implementation Strategy

### Execution Strategy
**Execution Model**: [Sequential | Parallel | Phased | TDD Cycles]

**Rationale**: [Why this execution model fits the project]

**Parallelization Opportunities**:
- [List independent workstreams]

**Serialization Requirements**:
- [List critical dependencies]

### Architectural Approach
**Key Architecture Decisions**:
- [ADR references from role analyses]
- [Justification for architecture patterns]

**Integration Strategy**:
- [How modules communicate]
- [State management approach]

### Key Dependencies
**Task Dependency Graph**:
'''
[High-level dependency visualization]
'''

**Critical Path**: [Identify bottleneck tasks]

### Testing Strategy
**Testing Approach**:
- Unit testing: [Tools, scope]
- Integration testing: [Key integration points]
- E2E testing: [Critical user flows]

**Coverage Targets**:
- Lines: ≥70%
- Functions: ≥70%
- Branches: ≥65%

**Quality Gates**:
- [CI/CD gates]
- [Performance budgets]

## 5. Task Breakdown Summary

### Task Count
**{N} tasks** (flat hierarchy | two-level hierarchy, sequential | parallel execution)

### Task Structure
- **IMPL-1**: [Main task title]
- **IMPL-2**: [Main task title]
...

### Complexity Assessment
- **High**: [List with rationale]
- **Medium**: [List]
- **Low**: [List]

### Dependencies
[Reference Section 4.3 for dependency graph]

**Parallelization Opportunities**:
- [Specific task groups that can run in parallel]

## 6. Implementation Plan (Detailed Phased Breakdown)

### Execution Strategy

**Phase 1 (Weeks 1-2): [Phase Name]**
- **Tasks**: IMPL-1, IMPL-2
- **Deliverables**:
  - [Specific deliverable 1]
  - [Specific deliverable 2]
- **Success Criteria**:
  - [Measurable criterion]

**Phase 2 (Weeks 3-N): [Phase Name]**
...

### Resource Requirements

**Development Team**:
- [Team composition and skills]

**External Dependencies**:
- [Third-party services, APIs]

**Infrastructure**:
- [Development, staging, production environments]

## 7. Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|-------------|---------------------|-------|
| [Risk description] | High/Med/Low | High/Med/Low | [Strategy] | [Role] |

**Critical Risks** (High impact + High probability):
- [Risk 1]: [Detailed mitigation plan]

**Monitoring Strategy**:
- [How risks will be monitored]

## 8. Success Criteria

**Functional Completeness**:
- [ ] All requirements from role analysis documents implemented
- [ ] All acceptance criteria from task.json files met

**Technical Quality**:
- [ ] Test coverage ≥70%
- [ ] Bundle size within budget
- [ ] Performance targets met

**Operational Readiness**:
- [ ] CI/CD pipeline operational
- [ ] Monitoring and logging configured
- [ ] Documentation complete

**Business Metrics**:
- [ ] [Key business metrics from role analyses]
```

### 6.3. TODO_LIST.md Structure
A simple Markdown file for tracking the status of each task.

```markdown
# Tasks: [Session Topic]

## Task Progress
▸ **IMPL-001**: [Main Task Group] → [📋](./.task/IMPL-001.json)
  - [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/IMPL-001.1.json)
  - [x] **IMPL-001.2**: [Subtask] → [📋](./.task/IMPL-001.2.json) | [✅](./.summaries/IMPL-001.2-summary.md)

- [x] **IMPL-002**: [Simple Task] → [📋](./.task/IMPL-002.json) | [✅](./.summaries/IMPL-002-summary.md)

## Status Legend
- `▸` = Container task (has subtasks)
- `- [ ]` = Pending leaf task
- `- [x]` = Completed leaf task
- Maximum 2 levels: Main tasks and subtasks only
```

### 6.4. Output Files Diagram
The command organizes outputs into a standard directory structure.
```
.workflow/{session-id}/
├── IMPL_PLAN.md                     # Implementation plan
├── TODO_LIST.md                     # Progress tracking
├── .task/
│   ├── IMPL-1.json                  # Container task
│   ├── IMPL-1.1.json                # Leaf task with flow_control
│   └── IMPL-1.2.json                # Leaf task with flow_control
├── .brainstorming              # Input artifacts from brainstorm + synthesis
│   ├── guidance-specification.md    # Discussion framework
│   └── {role}/analysis*.md          # Role analyses (enhanced by synthesis, may have multiple files per role)
└── .process/
    ├── context-package.json         # Input from context-gather (smart context + conflict_risk)
    └── CONFLICT_RESOLUTION.md       # Input from conflict-resolution (conditional, if conflict_risk >= medium)
```

## 7. Artifact Integration
The command intelligently detects and integrates artifacts from the `.brainstorming/` directory.

#### Artifact Priority
1.  **context-package.json** (critical): Primary source - smart context AND all brainstorm artifact paths in `brainstorm_artifacts` section
2.  **role/analysis*.md** (highest): Paths from context-package.json → role-specific requirements, design specs, enhanced by synthesis
3.  **CONFLICT_RESOLUTION.md** (high): Path from context-package.json → conflict strategies (conditional, if conflict_risk >= medium)
4.  **guidance-specification.md** (medium): Path from context-package.json → discussion framework from brainstorming

#### Artifact-Task Mapping
Artifacts are mapped to tasks based on their relevance to the task's domain.
- **Role analysis.md files**: Primary requirements source - all relevant role analyses included based on task type
- **ui-designer/analysis.md**: Mapped to UI/Frontend tasks for design tokens, layouts, components
- **system-architect/analysis.md**: Mapped to Architecture/Backend tasks for ADRs, APIs, patterns
- **subject-matter-expert/analysis.md**: Mapped to tasks related to domain logic or standards
- **data-architect/analysis.md**: Mapped to tasks involving data models, schemas, or APIs
- **product-manager/analysis.md**: Mapped to all tasks for business requirements and user stories

This ensures that each task has access to the most relevant and detailed specifications from role-specific analyses.

## 8. CLI Execute Mode Details
When using `--cli-execute`, each step in `implementation_approach` includes a `command` field with the execution command.

**Key Points**:
- **Sequential Steps**: Steps execute in order defined in `implementation_approach` array
- **Context Delivery**: Each codex command receives context via CONTEXT field: `@.workflow/WFS-session/.process/context-package.json` (role analyses loaded dynamically from context package)
- **Multi-Step Tasks**: First step provides full context, subsequent steps use `resume --last` to maintain session continuity
- **Step Dependencies**: Later steps reference outputs from earlier steps via `depends_on` field

### Example 1: Agent Mode - Simple Task (Default, No Command)
```json
{
  "id": "IMPL-001",
  "title": "Implement user authentication module",
  "context": {
    "depends_on": [],
    "focus_paths": ["src/auth"],
    "requirements": ["JWT-based authentication", "Login and registration endpoints"],
    "acceptance": [
      "JWT token generation working",
      "Login and registration endpoints implemented",
      "Tests passing with >70% coverage"
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_role_analyses",
        "action": "Load role analyses from context-package.json",
        "commands": [
          "Read(.workflow/WFS-session/.process/context-package.json)",
          "Extract(brainstorm_artifacts.role_analyses[].files[].path)",
          "Read(each extracted path)"
        ],
        "output_to": "role_analyses",
        "on_error": "fail"
      },
      {
        "step": "load_context",
        "action": "Load context package for project structure",
        "commands": ["Read(.workflow/WFS-session/.process/context-package.json)"],
        "output_to": "context_pkg",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Implement JWT-based authentication",
        "description": "Create authentication module using JWT following [role_analyses] requirements and [context_pkg] patterns",
        "modification_points": [
          "Create auth service with JWT generation",
          "Implement login endpoint with credential validation",
          "Implement registration endpoint with user creation",
          "Add JWT middleware for route protection"
        ],
        "logic_flow": [
          "User registers → validate input → hash password → create user",
          "User logs in → validate credentials → generate JWT → return token",
          "Protected routes → validate JWT → extract user → allow access"
        ],
        "depends_on": [],
        "output": "auth_implementation"
      }
    ],
    "target_files": ["src/auth/service.ts", "src/auth/middleware.ts", "src/routes/auth.ts"]
  }
}
```

### Example 2: CLI Execute Mode - Single Codex Step
```json
{
  "id": "IMPL-002",
  "title": "Implement user authentication module",
  "context": {
    "depends_on": [],
    "focus_paths": ["src/auth"],
    "requirements": ["JWT-based authentication", "Login and registration endpoints"],
    "acceptance": ["JWT generation working", "Endpoints implemented", "Tests passing"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_role_analyses",
        "action": "Load role analyses from context-package.json",
        "commands": [
          "Read(.workflow/WFS-session/.process/context-package.json)",
          "Extract(brainstorm_artifacts.role_analyses[].files[].path)",
          "Read(each extracted path)"
        ],
        "output_to": "role_analyses",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Implement authentication with Codex",
        "description": "Create JWT-based authentication module",
        "command": "bash(codex -C src/auth --full-auto exec \"PURPOSE: Implement user authentication TASK: JWT-based auth with login/registration MODE: auto CONTEXT: @.workflow/WFS-session/.process/context-package.json EXPECTED: Complete auth module with tests RULES: Load role analyses from context-package.json → brainstorm_artifacts\" --skip-git-repo-check -s danger-full-access)",
        "modification_points": ["Create auth service", "Implement endpoints", "Add JWT middleware"],
        "logic_flow": ["Validate credentials", "Generate JWT", "Return token"],
        "depends_on": [],
        "output": "auth_implementation"
      }
    ],
    "target_files": ["src/auth/service.ts", "src/auth/middleware.ts"]
  }
}
```

### Example 3: CLI Execute Mode - Multi-Step with Resume
```json
{
  "id": "IMPL-003",
  "title": "Implement role-based access control",
  "context": {
    "depends_on": ["IMPL-002"],
    "focus_paths": ["src/auth", "src/middleware"],
    "requirements": ["User roles and permissions", "Route protection middleware"],
    "acceptance": ["RBAC models created", "Middleware working", "Management API complete"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_context",
        "action": "Load context and role analyses from context-package.json",
        "commands": [
          "Read(.workflow/WFS-session/.process/context-package.json)",
          "Extract(brainstorm_artifacts.role_analyses[].files[].path)",
          "Read(each extracted path)"
        ],
        "output_to": "full_context",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Create RBAC models",
        "description": "Define role and permission data models",
        "command": "bash(codex -C src/auth --full-auto exec \"PURPOSE: Create RBAC models TASK: Role and permission models MODE: auto CONTEXT: @.workflow/WFS-session/.process/context-package.json EXPECTED: Models with migrations RULES: Load role analyses from context-package.json → brainstorm_artifacts\" --skip-git-repo-check -s danger-full-access)",
        "modification_points": ["Define role model", "Define permission model", "Create migrations"],
        "logic_flow": ["Design schema", "Implement models", "Generate migrations"],
        "depends_on": [],
        "output": "rbac_models"
      },
      {
        "step": 2,
        "title": "Implement RBAC middleware",
        "description": "Create route protection middleware using models from step 1",
        "command": "bash(codex --full-auto exec \"PURPOSE: Create RBAC middleware TASK: Route protection middleware MODE: auto CONTEXT: RBAC models from step 1 EXPECTED: Middleware for route protection RULES: Use session patterns\" resume --last --skip-git-repo-check -s danger-full-access)",
        "modification_points": ["Create permission checker", "Add route decorators", "Integrate with auth"],
        "logic_flow": ["Check user role", "Validate permissions", "Allow/deny access"],
        "depends_on": [1],
        "output": "rbac_middleware"
      },
      {
        "step": 3,
        "title": "Add role management API",
        "description": "Create CRUD endpoints for roles and permissions",
        "command": "bash(codex --full-auto exec \"PURPOSE: Role management API TASK: CRUD endpoints for roles/permissions MODE: auto CONTEXT: Models and middleware from previous steps EXPECTED: Complete API with validation RULES: Maintain consistency\" resume --last --skip-git-repo-check -s danger-full-access)",
        "modification_points": ["Create role endpoints", "Create permission endpoints", "Add validation"],
        "logic_flow": ["Define routes", "Implement controllers", "Add authorization"],
        "depends_on": [2],
        "output": "role_management_api"
      }
    ],
    "target_files": [
      "src/models/Role.ts",
      "src/models/Permission.ts",
      "src/middleware/rbac.ts",
      "src/routes/roles.ts"
    ]
  }
}
```

**Pattern Summary**:
- **Agent Mode (Example 1)**: No `command` field - agent executes via `modification_points` and `logic_flow`
- **CLI Mode Single-Step (Example 2)**: One `command` field with full context package
- **CLI Mode Multi-Step (Example 3)**: First step uses full context, subsequent steps use `resume --last`
- **Context Delivery**: Context package provided via `@{...}` references in CONTEXT field

## 9. Error Handling

### Input Validation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Session not found | Invalid session ID | Verify session exists |
| Context missing | Incomplete planning | Run context-gather first |
| Invalid format | Corrupted results | Regenerate analysis |

### Task Generation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Count exceeds limit | >10 tasks | Re-scope requirements |
| Invalid structure | Missing fields | Fix analysis results |
| Dependency cycle | Circular refs | Adjust dependencies |

### Artifact Integration Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| Artifact not found | Missing output | Continue without artifacts |
| Invalid format | Corrupted file | Skip artifact loading |
| Path invalid | Moved/deleted | Update references |

## 10. Integration & Usage

### Command Chain
- **Called By**: `/workflow:plan` (Phase 4)
- **Calls**: None (terminal command)
- **Followed By**: `/workflow:execute`, `/workflow:status`

### Basic Usage
```bash
/workflow:tools:task-generate --session WFS-auth
```

## 11. Related Commands
- `/workflow:plan` - Orchestrates entire planning
- `/workflow:plan --cli-execute` - Planning with CLI execution mode
- `/workflow:tools:context-gather` - Provides context package
- `/workflow:tools:conflict-resolution` - Provides conflict resolution strategies (optional)
- `/workflow:execute` - Executes generated tasks
