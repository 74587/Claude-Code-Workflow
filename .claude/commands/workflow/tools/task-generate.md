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
    "type": "feature|bugfix|refactor|test|docs",
    "agent": "@code-developer|@planning-agent|@code-review-test-agent"
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
        "contains": "complete_integrated_specification"
      },
      {
        "type": "topic_framework",
        "source": "brainstorm_framework",
        "path": ".workflow/WFS-[session]/.brainstorming/topic-framework.md",
        "priority": "medium",
        "contains": "discussion_framework_structure"
      },
      {
        "type": "individual_role_analysis",
        "source": "brainstorm_roles",
        "path": ".workflow/WFS-[session]/.brainstorming/[role]/analysis.md",
        "priority": "low",
        "contains": "role_specific_analysis_fallback"
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
        "step": "load_individual_role_artifacts",
        "action": "Load individual role analyses as fallback",
        "commands": [
          "bash(find .workflow/WFS-[session]/.brainstorming/ -name 'analysis.md' 2>/dev/null | head -8)",
          "Read(.workflow/WFS-[session]/.brainstorming/ui-designer/analysis.md)",
          "Read(.workflow/WFS-[session]/.brainstorming/system-architect/analysis.md)"
        ],
        "output_to": "individual_artifacts",
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
        "action": "Analyze existing code patterns",
        "commands": [
          "bash(cd \"[focus_paths]\")",
          "bash(~/.claude/scripts/gemini-wrapper -p \"PURPOSE: Analyze patterns TASK: Review '[title]' CONTEXT: [synthesis_specification] [individual_artifacts] EXPECTED: Pattern analysis RULES: Prioritize synthesis-specification.md\")"
        ],
        "output_to": "task_context",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement '[title]' following synthesis specification",
      "modification_points": [
        "Apply consolidated requirements from synthesis-specification.md",
        "Follow technical guidelines from synthesis",
        "Integrate with existing patterns"
      ],
      "logic_flow": [
        "Load synthesis specification",
        "Extract requirements and design",
        "Analyze existing patterns",
        "Implement following specification",
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
4. Build flow_control with artifact loading steps
5. Create individual task JSON files in `.task/`

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