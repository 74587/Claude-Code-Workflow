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
This command generates task JSON files and an `IMPL_PLAN.md` from `ANALYSIS_RESULTS.md`. It automatically detects and integrates brainstorming artifacts, creating a structured and context-rich plan for implementation. The command supports two primary execution modes: a default agent-based mode for seamless context handling and a `--cli-execute` mode that leverages the Codex CLI for complex, autonomous development tasks. Its core function is to translate analysis into actionable, executable tasks, ensuring all necessary context, dependencies, and implementation steps are defined upfront.

## 2. Execution Modes

This command offers two distinct modes for task execution, providing flexibility for different implementation complexities.

### Agent Mode (Default)
In the default mode, tasks are executed within the context of the currently active agent. This approach offers seamless context continuity, as the agent has direct access to all loaded documents, session state, and in-memory artifacts.
- **Execution**: The agent reads the synthesis specification and other artifacts directly from memory.
- **Implementation**: The agent performs the implementation based on its understanding of the requirements.
- **Validation**: The agent is responsible for validating its own work against the acceptance criteria.
- **Benefit**: High-speed execution with minimal overhead, ideal for tasks that are well-defined and don't require extensive autonomous reasoning.

### CLI Execute Mode (`--cli-execute`)
When the `--cli-execute` flag is used, the command generates tasks that invoke the Codex CLI. This mode is designed for complex implementations that benefit from Codex's advanced reasoning, iterative development, and session-based context persistence.
- **Execution**: Each task's `implementation_approach` contains a `codex exec` command.
- **Context Continuity**: The first task establishes a new Codex session, while subsequent tasks use the `resume --last` flag to maintain context, allowing Codex to learn from previous steps.
- **Benefit**: Leverages Codex's powerful autonomous development capabilities for complex, multi-step implementations requiring persistent context.
- **Use Case**: Ideal for large-scale features, complex refactoring, or when the implementation logic requires iterative reasoning and self-correction.

## 3. Core Principles
This command is built on a set of core principles to ensure efficient and reliable task generation.

- **Analysis-Driven**: All generated tasks originate from the `ANALYSIS_RESULTS.md`, ensuring a direct link between analysis and implementation.
- **Artifact-Aware**: Automatically detects and integrates brainstorming outputs (e.g., `synthesis-specification.md`, role analyses) to enrich task context.
- **Context-Rich**: Embeds comprehensive context, including requirements, focus paths, acceptance criteria, and artifact references, directly into each task JSON.
- **Flow-Control Ready**: Pre-defines a clear sequence of operations (`pre_analysis`, `implementation_approach`) within each task to guide execution.
- **Memory-First**: Prioritizes using documents and data already loaded in conversation memory to avoid redundant file operations.
- **CLI-Aware**: Natively supports the Codex `resume` mechanism in CLI Execute Mode for persistent, stateful execution across multiple tasks.
- **Responsibility**: Parses analysis, detects artifacts, generates enhanced 5-field schema task JSONs, creates `IMPL_PLAN.md` and `TODO_LIST.md`, and updates the session state.

## 4. Execution Flow
The command follows a streamlined, three-step process to convert analysis into executable tasks.

### Step 1: Input & Discovery
The process begins by gathering all necessary inputs. It follows a **Memory-First Rule**, skipping file reads if documents are already in the conversation memory.
1.  **Session Validation**: Loads and validates the session from `.workflow/{session_id}/workflow-session.json`.
2.  **Analysis Loading**: Reads the primary input, `.workflow/{session_id}/.process/ANALYSIS_RESULTS.md`.
3.  **Artifact Discovery**: Scans the `.workflow/{session_id}/.brainstorming/` directory to find `synthesis-specification.md`, `topic-framework.md`, and various role analyses.

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
    "agent": "@code-developer|@test-fix-agent|@general-purpose",
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
        "type": "synthesis_specification",
        "source": "brainstorm_synthesis",
        "path": ".workflow/WFS-[session]/.brainstorming/synthesis-specification.md",
        "priority": "highest",
        "usage": "Primary requirement source - use for consolidated requirements and cross-role alignment"
      },
      {
        "type": "role_analysis",
        "source": "brainstorm_roles",
        "path": ".workflow/WFS-[session]/.brainstorming/[role-name]/analysis.md",
        "priority": "high",
        "usage": "Technical/design/business details from specific roles. Common roles: system-architect (ADRs, APIs, caching), ui-designer (design tokens, layouts), product-manager (user stories, metrics)",
        "note": "Dynamically discovered - multiple role analysis files may be included based on brainstorming results"
      },
      {
        "type": "topic_framework",
        "source": "brainstorm_framework",
        "path": ".workflow/WFS-[session]/.brainstorming/topic-framework.md",
        "priority": "low",
        "usage": "Discussion context and framework structure"
      }
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_synthesis_specification",
        "action": "Load consolidated synthesis specification",
        "commands": [
          "bash(ls .workflow/WFS-[session]/.brainstorming/synthesis-specification.md 2>/dev/null || echo 'not found')",
          "Read(.workflow/WFS-[session]/.brainstorming/synthesis-specification.md)"
        ],
        "output_to": "synthesis_specification",
        "on_error": "skip_optional"
      },
      {
        "step": "load_role_analysis_artifacts",
        "action": "Load role-specific analysis documents for technical details",
        "note": "These artifacts contain implementation details not in synthesis. Consult when needing: API schemas, caching configs, design tokens, ADRs, performance metrics.",
        "commands": [
          "bash(find .workflow/WFS-[session]/.brainstorming/ -name 'analysis.md' 2>/dev/null | head -8)",
          "Read(.workflow/WFS-[session]/.brainstorming/system-architect/analysis.md)",
          "Read(.workflow/WFS-[session]/.brainstorming/ui-designer/analysis.md)",
          "Read(.workflow/WFS-[session]/.brainstorming/product-manager/analysis.md)"
        ],
        "output_to": "role_analysis_artifacts",
        "on_error": "skip_optional"
      },
      {
        "step": "load_planning_context",
        "action": "Load plan-generated analysis",
        "commands": [
          "Read(.workflow/WFS-[session]/.process/ANALYSIS_RESULTS.md)",
          "Read(.workflow/WFS-[session]/.process/context-package.json)"
        ],
        "output_to": "planning_context"
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
          "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Identify modification targets TASK: Analyze '[title]' and locate specific files/functions/lines to modify CONTEXT: [synthesis_specification] [individual_artifacts] EXPECTED: Code locations in format 'file:function:lines' RULES: Prioritize synthesis-specification.md, identify exact modification points\")"
        ],
        "output_to": "task_context_with_targets",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Implement task following synthesis specification",
        "description": "Implement '[title]' following synthesis specification. PRIORITY: Use synthesis-specification.md as primary requirement source. When implementation needs technical details (e.g., API schemas, caching configs, design tokens), refer to artifacts[] for detailed specifications from original role analyses.",
        "modification_points": [
          "Apply consolidated requirements from synthesis-specification.md",
          "Follow technical guidelines from synthesis",
          "Consult artifacts for implementation details when needed",
          "Integrate with existing patterns"
        ],
        "logic_flow": [
          "Load synthesis specification",
          "Extract requirements and design",
          "Analyze existing patterns",
          "Implement following specification",
          "Consult artifacts for technical details when needed",
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
analysis: .workflow/{session-id}/.process/ANALYSIS_RESULTS.md
artifacts: .workflow/{session-id}/.brainstorming/
context_package: .workflow/{session-id}/.process/context-package.json  # CCW smart context
workflow_type: "standard | tdd | design"  # Indicates execution model
verification_history:  # CCW quality gates
  concept_verify: "passed | skipped | pending"
  action_plan_verify: "pending"
phase_progression: "brainstorm → context → analysis → concept_verify → planning"  # CCW workflow phases
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
- ✅ Phase 1: Brainstorming (synthesis-specification.md generated)
- ✅ Phase 2: Context Gathering (context-package.json: {N} files, {M} modules analyzed)
- ✅ Phase 3: Enhanced Analysis (ANALYSIS_RESULTS.md: Gemini/Qwen/Codex parallel insights)
- ✅ Phase 4: Concept Verification ({X} clarifications answered, synthesis updated | skipped)
- ⏳ Phase 5: Action Planning (current phase - generating IMPL_PLAN.md)

**Quality Gates**:
- concept-verify: ✅ Passed (0 ambiguities remaining) | ⏭️ Skipped (user decision) | ⏳ Pending
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
**Primary Reference (synthesis-specification.md)**:
- **What**: Comprehensive implementation blueprint from multi-role synthesis
- **When**: Every task references this first for requirements and design decisions
- **How**: Extract architecture decisions, UI/UX patterns, functional requirements, non-functional requirements
- **Priority**: Authoritative - overrides role-specific analyses when conflicts arise
- **CCW Value**: Consolidates insights from all brainstorming roles into single source of truth

**Context Intelligence (context-package.json)**:
- **What**: Smart context gathered by CCW's context-gather phase
- **Content**: Focus paths, dependency graph, existing patterns, module structure
- **Usage**: Tasks load this via `flow_control.preparatory_steps` for environment setup
- **CCW Value**: Automated intelligent context discovery replacing manual file exploration

**Technical Analysis (ANALYSIS_RESULTS.md)**:
- **What**: Gemini/Qwen/Codex parallel analysis results
- **Content**: Optimization strategies, risk assessment, architecture review, implementation patterns
- **Usage**: Referenced in task planning for technical guidance and risk mitigation
- **CCW Value**: Multi-model parallel analysis providing comprehensive technical intelligence

### Integrated Specifications (Highest Priority)
- **synthesis-specification.md**: Comprehensive implementation blueprint
  - Contains: Architecture design, UI/UX guidelines, functional/non-functional requirements, implementation roadmap, risk assessment

### Supporting Artifacts (Reference)
- **topic-framework.md**: Role-specific discussion points and analysis framework
- **system-architect/analysis.md**: Detailed architecture specifications
- **ui-designer/analysis.md**: Layout and component specifications
- **product-manager/analysis.md**: Product vision and user stories

**Artifact Priority in Development**:
1. synthesis-specification.md (primary reference for all tasks)
2. context-package.json (smart context for execution environment)
3. ANALYSIS_RESULTS.md (technical analysis and optimization strategies)
4. Role-specific analyses (fallback for detailed specifications)

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
- [ADR references from synthesis]
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
- [ ] All requirements from synthesis-specification.md implemented
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
- [ ] [Key business metrics from synthesis]
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
├── .brainstorming/                  # Input artifacts
│   ├── synthesis-specification.md
│   ├── topic-framework.md
│   └── {role}/analysis.md
└── .process/
    ├── ANALYSIS_RESULTS.md          # Input from concept-enhanced
    └── context-package.json         # Input from context-gather
```

## 7. Artifact Integration
The command intelligently detects and integrates artifacts from the `.brainstorming/` directory.

#### Artifact Priority
1.  **synthesis-specification.md** (highest): The complete, integrated specification that serves as the primary source of truth.
2.  **topic-framework.md** (medium): The discussion framework that provides high-level structure.
3.  **role/analysis.md** (low): Individual role-based analyses that offer detailed, perspective-specific insights.

#### Artifact-Task Mapping
Artifacts are mapped to tasks based on their relevance to the task's domain.
- **synthesis-specification.md**: Included in all tasks as the primary reference.
- **ui-designer/analysis.md**: Mapped to UI/Frontend tasks.
- **system-architect/analysis.md**: Mapped to Architecture/Backend tasks.
- **subject-matter-expert/analysis.md**: Mapped to tasks related to domain logic or standards.
- **data-architect/analysis.md**: Mapped to tasks involving data models or APIs.

This ensures that each task has access to the most relevant and detailed specifications, from the high-level synthesis down to the role-specific details.

## 8. CLI Execute Mode Details
When using the `--cli-execute` flag, the command generates `bash(codex ...)` commands within the `implementation_approach` of the task JSON.

### Codex Resume Mechanism
This mechanism ensures context continuity across multiple, dependent tasks.

**Session Continuity Strategy**:
-   **First Task** (a task with no dependencies): Establishes a new Codex session by running a standard `codex exec` command. This initializes the context for the implementation sequence.
-   **Subsequent Tasks** (tasks with `depends_on` entries): Use the `resume --last` flag. This instructs Codex to load the context from the immediately preceding execution, allowing it to build upon previous work, maintain consistency, and learn from prior steps.

**Resume Flag Logic**:
```javascript
// Determine resume flag based on task dependencies
const resumeFlag = task.context.depends_on && task.context.depends_on.length > 0
  ? "resume --last"
  : "";

// First task (IMPL-001): no resume flag
// Later tasks (IMPL-002, IMPL-003): use "resume --last"
```

**Benefits**:
-   ✅ **Shared Context**: Ensures related tasks are handled with a consistent understanding.
-   ✅ **Learning**: Codex learns from previous implementations in the same session.
-   ✅ **Consistency**: Maintains consistent patterns and conventions across tasks.
-   ✅ **Efficiency**: Reduces redundant analysis and context loading.

### Example 1: First Task (Establish Session)
```json
{
  "id": "IMPL-001",
  "title": "Implement user authentication module",
  "context": {
    "depends_on": [],
    "focus_paths": ["src/auth"],
    "requirements": ["JWT-based authentication", "Login and registration endpoints"]
  },
  "flow_control": {
    "implementation_approach": [{
      "step": 1,
      "title": "Execute implementation with Codex",
      "command": "bash(codex -C src/auth --full-auto exec \"PURPOSE: Implement user authentication module TASK: JWT-based authentication with login and registration MODE: auto CONTEXT: @{.workflow/WFS-session/.brainstorming/synthesis-specification.md} EXPECTED: Complete auth module with tests RULES: Follow synthesis specification\" --skip-git-repo-check -s danger-full-access)",
      "depends_on": [],
      "output": "implementation"
    }]
  }
}
```

### Example 2: Subsequent Task (Resume Session)
```json
{
  "id": "IMPL-002",
  "title": "Add password reset functionality",
  "context": {
    "depends_on": ["IMPL-001"],
    "focus_paths": ["src/auth"],
    "requirements": ["Password reset via email", "Token validation"]
  },
  "flow_control": {
    "implementation_approach": [{
      "step": 1,
      "title": "Execute implementation with Codex",
      "command": "bash(codex --full-auto exec \"PURPOSE: Add password reset functionality TASK: Password reset via email with token validation MODE: auto CONTEXT: Previous auth implementation from session EXPECTED: Password reset endpoints with email integration RULES: Maintain consistency with existing auth patterns\" resume --last --skip-git-repo-check -s danger-full-access)",
      "depends_on": [],
      "output": "implementation"
    }]
  }
}
```

### Example 3: Third Task (Continue Session)
```json
{
  "id": "IMPL-003",
  "title": "Implement role-based access control",
  "context": {
    "depends_on": ["IMPL-001", "IMPL-002"],
    "focus_paths": ["src/auth"],
    "requirements": ["User roles and permissions", "Middleware for route protection"]
  },
  "flow_control": {
    "implementation_approach": [{
      "step": 1,
      "title": "Execute implementation with Codex",
      "command": "bash(codex --full-auto exec \"PURPOSE: Implement role-based access control TASK: User roles, permissions, and route protection middleware MODE: auto CONTEXT: Existing auth system from session EXPECTED: RBAC system integrated with current auth RULES: Use established patterns from session context\" resume --last --skip-git-repo-check -s danger-full-access)",
      "depends_on": [],
      "output": "implementation"
    }]
  }
}
```

**Pattern Summary**:
-   **IMPL-001**: Starts a fresh session with a full prompt and context.
-   **IMPL-002**: Resumes the last session, referencing the "previous auth implementation."
-   **IMPL-003**: Continues the session, referencing the "existing auth system."

## 9. Error Handling

### Input Validation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Session not found | Invalid session ID | Verify session exists |
| Analysis missing | Incomplete planning | Run concept-enhanced first |
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
- `/workflow:tools:concept-enhanced` - Provides analysis results
- `/workflow:execute` - Executes generated tasks
