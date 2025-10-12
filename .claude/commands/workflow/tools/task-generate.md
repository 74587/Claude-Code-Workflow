---
name: task-generate
description: Generate task JSON files and IMPL_PLAN.md from analysis results with artifacts integration
argument-hint: "--session WFS-session-id [--cli-execute]"
examples:
  - /workflow:tools:task-generate --session WFS-auth
  - /workflow:tools:task-generate --session WFS-auth --cli-execute
---

# Task Generation Command

## Overview
Generate task JSON files and IMPL_PLAN.md from analysis results with automatic artifact detection and integration.

## Execution Modes

### Agent Mode (Default)
Tasks execute within agent context using agent's capabilities:
- Agent reads synthesis specifications
- Agent implements following requirements
- Agent validates implementation
- **Benefit**: Seamless context within single agent execution

### CLI Execute Mode (`--cli-execute`)
Tasks execute using Codex CLI with resume mechanism:
- Each task uses `codex exec` command in `implementation_approach`
- First task establishes Codex session
- Subsequent tasks use `codex exec "..." resume --last` for context continuity
- **Benefit**: Codex's autonomous development capabilities with persistent context
- **Use Case**: Complex implementation requiring Codex's reasoning and iteration

## Core Philosophy
- **Analysis-Driven**: Generate from ANALYSIS_RESULTS.md
- **Artifact-Aware**: Auto-detect brainstorming outputs
- **Context-Rich**: Embed comprehensive context in task JSON
- **Flow-Control Ready**: Pre-define implementation steps
- **Memory-First**: Reuse loaded documents from memory
- **CLI-Aware**: Support Codex resume mechanism for persistent context

## Core Responsibilities
- Parse analysis results and extract tasks
- Detect and integrate brainstorming artifacts
- Generate enhanced task JSON files (5-field schema)
- Create IMPL_PLAN.md and TODO_LIST.md
- Update session state for execution

## Execution Lifecycle

### Phase 1: Input Validation & Discovery
**⚡ Memory-First Rule**: Skip file loading if documents already in conversation memory

1. **Session Validation**
   - If session metadata in memory → Skip loading
   - Else: Load `.workflow/{session_id}/workflow-session.json`

2. **Analysis Results Loading**
   - If ANALYSIS_RESULTS.md in memory → Skip loading
   - Else: Read `.workflow/{session_id}/.process/ANALYSIS_RESULTS.md`

3. **Artifact Discovery**
   - If artifact inventory in memory → Skip scanning
   - Else: Scan `.workflow/{session_id}/.brainstorming/` directory
   - Detect: synthesis-specification.md, topic-framework.md, role analyses

### Phase 2: Task JSON Generation

#### Task Decomposition Standards
**Core Principle: Task Merging Over Decomposition**
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

#### Enhanced Task JSON Schema (5-Field + Artifacts)
```json
{
  "id": "IMPL-N[.M]",
  "title": "Descriptive task name",
  "status": "pending|active|completed|blocked|container",
  "meta": {
    "type": "feature|bugfix|refactor|test-gen|test-fix|docs",
    "agent": "@code-developer|@test-fix-agent|@general-purpose"
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

    // CLI Execute Mode: Use Codex command (when --cli-execute flag present)
    "implementation_approach": [
      {
        "step": 1,
        "title": "Execute implementation with Codex",
        "description": "Use Codex CLI to implement '[title]' following synthesis specification with autonomous development capabilities",
        "modification_points": [
          "Codex loads synthesis specification and artifacts",
          "Codex implements following requirements",
          "Codex validates and tests implementation"
        ],
        "logic_flow": [
          "Establish or resume Codex session",
          "Pass synthesis specification to Codex",
          "Codex performs autonomous implementation",
          "Codex validates against acceptance criteria"
        ],
        "command": "bash(codex -C [focus_paths] --full-auto exec \"PURPOSE: [title] TASK: [requirements] MODE: auto CONTEXT: @{[synthesis_path],[artifacts_paths]} EXPECTED: [acceptance] RULES: Follow synthesis-specification.md\" [resume_flag] --skip-git-repo-check -s danger-full-access)",
        "depends_on": [],
        "output": "implementation"
      }
    ],
    "target_files": ["file:function:lines"]
  }
}
```

#### Task Generation Process
1. Parse analysis results and extract task definitions
2. Detect brainstorming artifacts with priority scoring
3. Generate task context (requirements, focus_paths, acceptance)
4. **Determine modification targets**: Extract specific code locations from analysis
5. Build flow_control with artifact loading steps and target_files
6. **CLI Execute Mode**: If `--cli-execute` flag present, generate Codex commands
7. Create individual task JSON files in `.task/`

#### Codex Resume Mechanism (CLI Execute Mode)

**Session Continuity Strategy**:
- **First Task** (no depends_on or depends_on=[]): Establish new Codex session
  - Command: `codex -C [path] --full-auto exec "[prompt]" --skip-git-repo-check -s danger-full-access`
  - Creates new session context

- **Subsequent Tasks** (has depends_on): Resume previous Codex session
  - Command: `codex --full-auto exec "[prompt]" resume --last --skip-git-repo-check -s danger-full-access`
  - Maintains context from previous implementation
  - **Critical**: `resume --last` flag enables context continuity

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
- ✅ Shared context across related tasks
- ✅ Codex learns from previous implementations
- ✅ Consistent patterns and conventions
- ✅ Reduced redundant analysis

#### Target Files Generation (Critical)
**Purpose**: Identify specific code locations for modification AND new files to create

**Source Data Priority**:
1. **ANALYSIS_RESULTS.md** - Should contain identified code locations
2. **Gemini/MCP Analysis** - From `analyze_task_patterns` step
3. **Context Package** - File references from `focus_paths`

**Format**: `["file:function:lines"]` or `["file"]` (for new files)
- `file`: Relative path from project root (e.g., `src/auth/AuthService.ts`)
- `function`: Function/method name to modify (e.g., `login`, `validateToken`) - **omit for new files**
- `lines`: Approximate line range (e.g., `45-52`, `120-135`) - **omit for new files**

**Examples**:
```json
"target_files": [
  "src/auth/AuthService.ts:login:45-52",
  "src/middleware/auth.ts:validateToken:30-45",
  "src/auth/PasswordReset.ts",
  "tests/auth/PasswordReset.test.ts",
  "tests/auth.test.ts:testLogin:15-20"
]
```

**Generation Strategy**:
- **New files to create** → Use `["path/to/NewFile.ts"]` (no function or lines)
- **Existing files with specific locations** → Use `["file:function:lines"]`
- **Existing files with function only** → Search lines using MCP/grep `["file:function:*"]`
- **Existing files (explore entire)** → Mark as `["file.ts:*:*"]`
- **No specific targets** → Leave empty `[]` (agent explores focus_paths)

### Phase 3: Artifact Detection & Integration

#### Artifact Priority
1. **synthesis-specification.md** (highest) - Complete integrated spec
2. **topic-framework.md** (medium) - Discussion framework
3. **role/analysis.md** (low) - Individual perspectives

#### Artifact-Task Mapping
- **synthesis-specification.md** → All tasks
- **ui-designer/analysis.md** → UI/Frontend tasks
- **ux-expert/analysis.md** → UX/Interaction tasks
- **system-architect/analysis.md** → Architecture/Backend tasks
- **subject-matter-expert/analysis.md** → Domain/Standards tasks
- **data-architect/analysis.md** → Data/API tasks
- **scrum-master/analysis.md** → Sprint/Process tasks
- **product-owner/analysis.md** → Backlog/Story tasks

### Phase 4: IMPL_PLAN.md Generation

#### Document Structure
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
```
[Directory tree showing key modules]
```

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
```
[High-level dependency visualization]
```

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

### Phase 5: TODO_LIST.md Generation

#### Document Structure
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

### Phase 6: Session State Update
1. Update workflow-session.json with task count and artifacts
2. Validate all output files (task JSONs, IMPL_PLAN.md, TODO_LIST.md)
3. Generate completion report

## Output Files Structure
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

## Error Handling

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

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:plan` (Phase 4)
- **Calls**: None (terminal command)
- **Followed By**: `/workflow:execute`, `/workflow:status`

### Basic Usage
```bash
/workflow:tools:task-generate --session WFS-auth
```

## CLI Execute Mode Examples

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
- IMPL-001: Fresh start with `-C src/auth` and full prompt
- IMPL-002: Resume with `resume --last`, references "previous auth implementation"
- IMPL-003: Resume with `resume --last`, references "existing auth system"

## Related Commands
- `/workflow:plan` - Orchestrates entire planning
- `/workflow:plan --cli-execute` - Planning with CLI execution mode
- `/workflow:tools:context-gather` - Provides context package
- `/workflow:tools:concept-enhanced` - Provides analysis results
- `/workflow:execute` - Executes generated tasks