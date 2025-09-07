---
name: workflow-action-plan
description: Action planning phase that integrates brainstorming insights or user input to create executable implementation plans
usage: /workflow:action-plan [--from-brainstorming] [--skip-brainstorming] [--replan] [--trigger=<reason>]
argument-hint: [optional: from brainstorming, skip brainstorming, replan mode, or replan trigger]
examples:
  - /workflow:action-plan --from-brainstorming
  - /workflow:action-plan --skip-brainstorming "implement OAuth authentication"
  - /workflow:action-plan --replan --trigger=requirement-change
  - /workflow:action-plan --from-brainstorming --scope=all --strategy=minimal-disruption
---

# Workflow Action Plan Command (/workflow:action-plan)

## Overview
Creates actionable implementation plans based on brainstorming insights or direct user input. Establishes project structure, understands existing workflow context, and generates executable plans with proper task decomposition and resource allocation.

## Core Principles
**System:** @~/.claude/workflows/unified-workflow-system-principles.md

## Input Sources & Planning Approaches

### Brainstorming-Based Planning (--from-brainstorming)
**Prerequisites**: Completed brainstorming session with multi-agent analysis
**Input Sources**:
- `.workflow/WFS-[topic-slug]/.brainstorming/[agent]/analysis.md` files
- `.workflow/WFS-[topic-slug]/.brainstorming/synthesis-analysis.md`
- `.workflow/WFS-[topic-slug]/.brainstorming/recommendations.md`
- `workflow-session.json` brainstorming phase results

### Direct User Input Planning (--skip-brainstorming)
**Prerequisites**: User provides task description and requirements
**Input Sources**:
- User task description and requirements
- Existing project structure analysis
- Session context from workflow-session.json (if exists)

### Session Context Detection

⚠️ **CRITICAL**: Before planning, MUST check for existing active session to avoid creating duplicate sessions.

**Session Check Process:**
1. **Query Session Registry**: Check `.workflow/session_status.jsonl` for active sessions. If the file doesn't exist, create it.
2. **Session Selection**: Use existing active session or create new one only if none exists  
3. **Context Integration**: Load existing session state and brainstorming outputs

```json
{
  "session_id": "WFS-[topic-slug]",
  "type": "simple|medium|complex", 
  "current_phase": "PLAN",
  "session_source": "existing_active|new_creation",
  "brainstorming": {
    "status": "completed|skipped",
    "output_directory": ".workflow/WFS-[topic-slug]/.brainstorming/",
    "insights_available": true|false
  }
}
```

### Planning Depth & Document Generation
- **Simple**: Skip detailed planning, generate minimal IMPL_PLAN.md or go direct to IMPLEMENT
- **Medium**: Standard planning with IMPL_PLAN.md generation (1-2 agents)
- **Complex**: Full planning with comprehensive IMPL_PLAN.md (enhanced structure)

## Execution Flow

### Phase 1: Context Understanding & Structure Establishment
1. **Session Detection & Selection**: 
   - **Check Active Sessions**: Query `.workflow/session_status.jsonl` for existing active sessions. If the file doesn't exist, create it.
   - **Session Priority**: Use existing active session if available, otherwise create new session
   - **Session Analysis**: Read and understand workflow-session.json from selected session
   - Detect existing brainstorming outputs
   - Identify current phase and progress
   - Understand project context and requirements

2. **File Structure Assessment**: 
   - **If brainstorming exists**: Verify `.workflow/WFS-[topic-slug]/.brainstorming/` structure
   - **If no structure exists**: Create complete workflow directory structure
   - **Document Discovery**: Identify all existing planning documents

3. **Input Source Determination**:
   - **From Brainstorming**: Read all agent analyses and synthesis documents
   - **Skip Brainstorming**: Collect user requirements and context directly
   - **Hybrid**: Combine existing insights with new user input

### Phase 2: Context Integration & Requirements Analysis
4. **Requirements Synthesis**:
   - **From Brainstorming**: Integrate multi-agent perspectives and recommendations
   - **From User Input**: Analyze and structure user-provided requirements
   - **Gap Analysis**: Identify missing information and clarify with user

5. **Complexity Assessment**: Determine planning depth needed based on:
   - Scope of requirements (brainstorming insights or user input)
   - Technical complexity indicators
   - Resource and timeline constraints
   - Risk assessment from available information

### Phase 3: Document Generation & Planning
6. **Create Document Directory**: Setup `.workflow/WFS-[topic-slug]/` structure (if needed)

7. **Execute Planning**:
   - **Simple**: Minimal documentation, direct to IMPLEMENT
   - **Medium**: Generate IMPL_PLAN.md with task breakdown
   - **Complex**: Generate comprehensive IMPL_PLAN.md with staged approach and risk assessment

8. **Auto-Generate Tasks (NEW)**: Parse IMPL_PLAN.md and automatically create corresponding task JSON files
   - **Extract Tasks**: Parse task identifiers (IMPL-001, IMPL-002, etc.) from plan
   - **Create Task Files**: Generate `.task/impl-*.json` files with plan context
   - **Link to Plan**: Include `source_plan_ref` field linking tasks back to plan sections
   - **Set Dependencies**: Establish task dependencies based on plan structure

9. **Update Session**: Mark PLAN phase complete with document references and generated task list

10. **Link Documents**: Update JSON state with generated document paths and task file references

## Automated Task Generation (Single Source of Truth Integration)

### Planning-to-Execution Automation
**NEW FEATURE**: Eliminates the gap between planning and execution by automatically creating executable task files from planning documents.

### Task Extraction Process
1. **Parse IMPL_PLAN.md**: Scan for task identifiers in standardized format:
   - `IMPL-001`, `IMPL-002`, etc. (main tasks)
   - `IMPL-1.1`, `IMPL-1.2`, etc. (subtasks)
   - Task titles and descriptions from plan sections

2. **Generate Task JSON Files**: For each identified task, create structured JSON:
```json
{
  "id": "IMPL-001",
  "title": "Foundation/Infrastructure setup",
  "status": "pending", 
  "type": "infrastructure",
  "agent": "code-developer",
  "effort": "2h",
  
  "context": {
    "inherited_from": "WFS-[topic-slug]",
    "source_plan_ref": "IMPL_PLAN.md#phase-1-foundation",
    "requirements": ["Extracted from plan description"],
    "scope": ["Derived from plan context"],
    "acceptance": ["Extracted from success criteria"]
  },
  
  "dependencies": {
    "upstream": [],
    "downstream": ["IMPL-002"],
    "phase_group": "Phase 1: Foundation"
  },
  
  "metadata": {
    "created_at": "2025-09-07T15:00:00Z",
    "created_by": "workflow:action-plan",
    "auto_generated": true,
    "plan_version": "1.0"
  }
}
```

3. **Link Bidirectionally**: 
   - Task files reference plan sections
   - Session state includes all generated task IDs
   - Ready for immediate execution via `/task:execute`

### Benefits of Automation
- **Zero Manual Task Creation**: Plans immediately become executable
- **Consistency**: All tasks derive from same authoritative plan
- **Traceability**: Clear linkage from requirements through plan to tasks
- **Immediate Execution**: Can run `/task:execute IMPL-001` immediately after planning

## Session State Analysis & Document Understanding

### Workflow Session Discovery
**Command**: `workflow:action-plan` automatically detects and analyzes:

**Session Detection Process**:
1. **Find Active Sessions**: Locate `.workflow/WFS-*/workflow-session.json` files
2. **Session Validation**: Verify session completeness and current phase
3. **Context Extraction**: Read session metadata, progress, and phase outputs

**Session State Analysis**:
```json
{
  "session_id": "WFS-user-auth-system", 
  "current_phase": "PLAN",
  "brainstorming": {
    "status": "completed",
    "agents_completed": ["system-architect", "ui-designer", "security-expert"],
    "synthesis_available": true,
    "recommendations_count": 12
  },
  "documents": {
    "brainstorming": {
      "system-architect/analysis.md": {"status": "available", "insights": ["scalability", "microservices"]},
      "synthesis-analysis.md": {"status": "available", "key_themes": ["security-first", "user-experience"]}
    }
  }
}
```

### Document Intelligence & Content Understanding
**Process**: Action planning reads and interprets existing workflow documents

**Brainstorming Document Analysis**:
- **Agent Analyses**: Extract key insights, recommendations, and constraints from each agent
- **Synthesis Reports**: Understand cross-perspective themes and convergent solutions  
- **Recommendation Prioritization**: Identify high-impact, actionable items
- **Context Preservation**: Maintain user requirements and constraints from discussions

**Content Integration Strategy**:
- **Technical Requirements**: From system-architect, data-architect, security-expert analyses
- **User Experience**: From ui-designer, user-researcher perspectives
- **Business Context**: From product-manager, business-analyst insights
- **Implementation Constraints**: From all agent recommendations and user discussions

**Gap Detection**:
- Identify missing technical specifications
- Detect undefined user requirements
- Find unresolved architectural decisions
- Highlight conflicting recommendations requiring resolution

## Output Format

### IMPL_PLAN.md Structure (Enhanced for Action Planning)
```markdown
# Action Implementation Plan

## Context & Requirements
### From Brainstorming Analysis (if --from-brainstorming)
- **Key Insights**: Synthesized from multi-agent perspectives
- **Technical Requirements**: Architecture, security, data considerations
- **User Experience Requirements**: UI/UX design and usability needs
- **Business Requirements**: Product goals, stakeholder priorities, constraints
- **User Discussion Context**: Captured requirements from user interactions

### From User Input (if --skip-brainstorming)  
- **User Provided Requirements**: Direct input and specifications
- **Context Analysis**: Interpreted requirements and technical implications
- **Gap Identification**: Areas needing clarification or additional information

## Strategic Approach
- **Implementation Philosophy**: Core principles guiding development
- **Success Metrics**: How progress and completion will be measured
- **Risk Mitigation**: Key risks identified and mitigation strategies

## Task Breakdown
- **IMPL-001**: Foundation/Infrastructure setup
- **IMPL-002**: Core functionality implementation
- **IMPL-003**: Integration and testing
- **IMPL-004**: [Additional tasks based on complexity]

## Dependencies & Sequence
- **Critical Path**: Essential task sequence
- **Parallel Opportunities**: Tasks that can run concurrently  
- **External Dependencies**: Third-party integrations or resources needed

## Resource Allocation
- **Technical Resources**: Required skills and expertise
- **Timeline Estimates**: Duration estimates for each phase
- **Quality Gates**: Review and approval checkpoints

## Success Criteria
- **Functional Acceptance**: Core functionality validation
- **Technical Acceptance**: Performance, security, scalability criteria
- **User Acceptance**: Usability and experience validation
```

### Enhanced IMPL_PLAN.md Structure (Complex Workflows)
```markdown
# Implementation Plan - [Project Name]

## Context & Requirements
### From Brainstorming Analysis (if --from-brainstorming)
- **Key Insights**: Synthesized from multi-agent perspectives
- **Technical Requirements**: Architecture, security, data considerations
- **User Experience Requirements**: UI/UX design and usability needs
- **Business Requirements**: Product goals, stakeholder priorities, constraints
- **User Discussion Context**: Captured requirements from user interactions

### From User Input (if --skip-brainstorming)  
- **User Provided Requirements**: Direct input and specifications
- **Context Analysis**: Interpreted requirements and technical implications
- **Gap Identification**: Areas needing clarification or additional information

## Strategic Approach
- **Implementation Philosophy**: Core principles guiding development
- **Success Metrics**: How progress and completion will be measured
- **Risk Mitigation**: Key risks identified and mitigation strategies

## Phase Breakdown

### Phase 1: Foundation
- **Objective**: [Core infrastructure/base components]
- **Tasks**: IMPL-001, IMPL-002
- **Duration**: [Estimate]
- **Success Criteria**: [Measurable outcomes]

### Phase 2: Core Implementation  
- **Objective**: [Main functionality]
- **Tasks**: IMPL-003, IMPL-004, IMPL-005
- **Duration**: [Estimate] 
- **Dependencies**: Phase 1 completion

### Phase 3: Integration & Testing
- **Objective**: [System integration and validation]
- **Tasks**: IMPL-006, IMPL-007
- **Duration**: [Estimate]

## Risk Assessment
- **High Risk**: [Description] - Mitigation: [Strategy]
- **Medium Risk**: [Description] - Mitigation: [Strategy]

## Quality Gates
- Code review requirements
- Testing coverage targets
- Performance benchmarks
- Security validation checks

## Rollback Strategy
- Rollback triggers and procedures
- Data preservation approach
```

## Document Storage
Generated documents are stored in session directory:
```
.workflow/WFS-[topic-slug]/
├── IMPL_PLAN.md               # Combined planning document (all complexities)
└── workflow-session.json      # Updated with document references
```

## Session Updates (Enhanced with Task Generation)
```json
{
  "phases": {
    "PLAN": {
      "status": "completed",
      "output": {
        "primary": "IMPL_PLAN.md",
        "tasks_generated": [".task/impl-001.json", ".task/impl-002.json", ".task/impl-003.json"]
      },
      "documents_generated": ["IMPL_PLAN.md"],
      "tasks_auto_created": 3,
      "completed_at": "2025-09-05T11:00:00Z",
      "tasks_identified": ["IMPL-001", "IMPL-002", "IMPL-003"],
      "ready_for_implementation": true
    }
  },
  "documents": {
    "planning": {
      "IMPL_PLAN.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/IMPL_PLAN.md",
        "tasks_extracted": 3,
        "auto_generation": "completed"
      }
    }
  },
  "task_system": {
    "enabled": true,
    "auto_generated": true,
    "directory": ".workflow/WFS-[topic-slug]/.task/",
    "task_count": {
      "total": 3,
      "pending": 3,
      "from_planning": 3
    }
  }
}
```

## Complexity Decision Rules

### Document Generation Matrix
| Complexity | IMPL_PLAN.md | Structure | Agent Requirements |
|------------|--------------|-----------|-------------------|
| **Simple** | Optional/Skip | Minimal | Direct to IMPLEMENT |
| **Medium** | Required | Standard | planning-agent |
| **Complex** | Required | Enhanced with phases + risk assessment | planning-agent + detailed analysis |

### Auto-Detection Triggers
Complex planning triggered when:
- Architecture changes required
- Security implementation needed
- Performance optimization planned
- System integration involved
- Estimated effort > 8 hours
- Risk level assessed as high

### Manual Override
```bash
# Force complex planning even for medium tasks
/workflow:action-plan --force-complex

# Force simple planning for quick fixes
/workflow:action-plan --force-simple
```

## Skip Option
```bash
/workflow:action-plan --skip-to-implement
```
- Generates minimal plan
- Immediately transitions to IMPLEMENT
- Useful for urgent fixes

## Replanning Mode

### Usage
```bash
# Basic replanning
/workflow:action-plan --replan --trigger=requirement-change

# Strategic replanning with impact analysis
/workflow:action-plan --replan --trigger=new-issue --scope=all --strategy=minimal-disruption --impact-analysis

# Conflict resolution
/workflow:action-plan --replan --trigger=dependency-conflict --auto-resolve
```

### Replan Parameters
- `--trigger=<reason>` → Replanning trigger: `new-issue|requirement-change|dependency-conflict|optimization`
- `--scope=<scope>` → Scope: `current-phase|all|documents-only|tasks-only`
- `--strategy=<strategy>` → Strategy: `minimal-disruption|optimal-efficiency|risk-minimization|time-optimization`
- `--impact-analysis` → Detailed impact analysis
- `--auto-resolve` → Auto-resolve conflicts
- `--dry-run` → Simulation mode

### Replanning Strategies

#### Minimal Disruption
- Preserve completed tasks
- Minimize impact on active work
- Insert changes optimally

#### Optimal Efficiency 
- Re-optimize task order
- Maximize parallelization
- Optimize critical path

#### Risk Minimization
- Prioritize high-risk tasks
- Add buffer time
- Strengthen dependencies

#### Time Optimization
- Focus on core requirements
- Defer non-critical tasks
- Maximize parallel execution

### Integration with Issues
When issues are created, replanning can be automatically triggered:
```bash
# Create issue then replan
/workflow:issue create --type=feature "OAuth2 support" 
/workflow:action-plan --replan --trigger=new-issue --issue=ISS-001
```

## Integration with Workflow System

### Action Planning Integration Points
**Prerequisite Commands**:
- `/workflow:session start` → Initialize workflow session
- `/brainstorm` → (Optional) Multi-agent brainstorming phase

**Action Planning Execution**:
- `/workflow:action-plan --from-brainstorming` → Plan from completed brainstorming
- `/workflow:action-plan --skip-brainstorming "task description"` → Plan from user input  
- `/workflow:action-plan --replan` → Revise existing plans

**Follow-up Commands**:
- `/workflow:implement` → Execute the action plan
- `/workflow:status` → View current workflow state
- `/task:create` → Create specific implementation tasks
- `/workflow:review` → Validate completed implementation

### Session State Updates
After action planning completion:
```json
{
  "current_phase": "IMPLEMENT",
  "phases": {
    "BRAINSTORM": {"status": "completed|skipped"},
    "PLAN": {
      "status": "completed",
      "input_source": "brainstorming|user_input", 
      "documents_generated": ["IMPL_PLAN.md"],
      "tasks_identified": ["IMPL-001", "IMPL-002", "IMPL-003"],
      "complexity_assessed": "simple|medium|complex"
    }
  }
}
```

### Quality Assurance
**Action Planning Excellence**:
- **Context Integration** → All brainstorming insights or user requirements incorporated
- **Actionable Output** → Plans translate directly to executable tasks
- **Comprehensive Coverage** → Technical, UX, and business considerations included
- **Clear Sequencing** → Dependencies and critical path clearly defined
- **Measurable Success** → Concrete acceptance criteria established

This action planning command bridges brainstorming insights and implementation execution, ensuring comprehensive planning based on multi-perspective analysis or direct user input.