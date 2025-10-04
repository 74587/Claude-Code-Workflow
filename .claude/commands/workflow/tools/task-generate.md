---
name: task-generate
description: Generate task JSON files and IMPL_PLAN.md from analysis results with artifacts integration
usage: /workflow:tools:task-generate --session <session_id>
argument-hint: "--session WFS-session-id"
examples:
  - /workflow:tools:task-generate --session WFS-auth
---

# Task Generation Command

## Overview
Generate task JSON files and IMPL_PLAN.md from analysis results with automatic artifact detection and integration.

## Core Philosophy
- **Analysis-Driven**: Generate from ANALYSIS_RESULTS.md
- **Artifact-Aware**: Auto-detect brainstorming outputs
- **Context-Rich**: Embed comprehensive context in task JSON
- **Flow-Control Ready**: Pre-define implementation steps
- **Memory-First**: Reuse loaded documents from memory

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
    "implementation_approach": {
      "task_description": "Implement '[title]' following synthesis specification. PRIORITY: Use synthesis-specification.md as primary requirement source. When implementation needs technical details (e.g., API schemas, caching configs, design tokens), refer to artifacts[] for detailed specifications from original role analyses.",
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
      ]
    },
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
6. Create individual task JSON files in `.task/`

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

## Related Commands
- `/workflow:plan` - Orchestrates entire planning
- `/workflow:tools:context-gather` - Provides context package
- `/workflow:tools:concept-enhanced` - Provides analysis results
- `/workflow:execute` - Executes generated tasks