---
name: feature-planner
description: Generate or update feature-planner/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:feature-planner [topic]
argument-hint: "optional topic - uses existing framework if available"
examples:
  - /workflow:brainstorm:feature-planner
  - /workflow:brainstorm:feature-planner "user dashboard enhancement"
  - /workflow:brainstorm:feature-planner "mobile app feature roadmap"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🔧 **Feature Planner Analysis Generator**

### Purpose
**Specialized command for generating feature-planner/analysis.md** that addresses topic-framework.md discussion points from feature development perspective. Creates or updates role-specific analysis with framework references.

### Core Function
- **Framework-based Analysis**: Address each discussion point in topic-framework.md
- **Feature Development Focus**: Feature specification, development planning, and delivery management
- **Update Mechanism**: Create new or update existing analysis.md
- **Agent Delegation**: Use conceptual-planning-agent for analysis generation

### Analysis Scope
- **Feature Specification**: Transform requirements into detailed specifications
- **Development Planning**: Sprint planning, milestones, and dependency management
- **Quality Assurance**: Testing strategies and acceptance criteria
- **Delivery Management**: Release planning and implementation timelines

## ⚙️ **Execution Protocol**

### Phase 1: Session & Framework Detection
```bash
# Check active session and framework
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    brainstorm_dir = .workflow/WFS-{session}/.brainstorming/

    CHECK: brainstorm_dir/topic-framework.md
    IF EXISTS:
        framework_mode = true
        load_framework = true
    ELSE:
        IF topic_provided:
            framework_mode = false  # Create analysis without framework
        ELSE:
            ERROR: "No framework found and no topic provided"
```

### Phase 2: Analysis Mode Detection
```bash
# Determine execution mode
IF framework_mode == true:
    mode = "framework_based_analysis"
    topic_ref = load_framework_topic()
    discussion_points = extract_framework_points()
ELSE:
    mode = "standalone_analysis"
    topic_ref = provided_topic
    discussion_points = generate_basic_structure()
```

### Phase 3: Agent Execution with Flow Control
**Framework-Based Analysis Generation**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute feature-planner analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: feature-planner
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/feature-planner/
ANALYSIS_MODE: {framework_mode ? "framework_based" : "standalone"}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load feature-planner planning template
   - Command: bash($(cat ~/.claude/workflows/cli-templates/planning-roles/feature-planner.md))
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and existing context
   - Command: Read(.workflow/WFS-{session}/.brainstorming/session.json)
   - Output: session_context

## Analysis Requirements
**Framework Reference**: Address all discussion points in topic-framework.md from feature development perspective
**Role Focus**: Feature specification, development planning, quality assurance, delivery management
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive feature planning analysis addressing all framework discussion points
2. **Framework Reference**: Include @../topic-framework.md reference in analysis

## Completion Criteria
- Address each discussion point from topic-framework.md with feature development expertise
- Provide actionable development plans and implementation strategies
- Include quality assurance and testing considerations
- Reference framework document using @ notation for integration
"
```

## 📋 **TodoWrite Integration**

### Workflow Progress Tracking
```javascript
TodoWrite({
  todos: [
    {
      content: "Detect active session and locate topic framework",
      status: "in_progress",
      activeForm: "Detecting session and framework"
    },
    {
      content: "Load topic-framework.md and session metadata for context",
      status: "pending",
      activeForm: "Loading framework and session context"
    },
    {
      content: "Execute feature-planner analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing feature-planner framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured feature-planner analysis"
    },
    {
      content: "Update session.json with feature-planner completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/feature-planner/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# Feature Planner Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: Feature Development perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with feature development expertise]

### Core Requirements (from framework)
[Feature development perspective on requirements]

### Technical Considerations (from framework)
[Feature architecture and development considerations]

### User Experience Factors (from framework)
[Feature usability and user story considerations]

### Implementation Challenges (from framework)
[Development complexity and delivery considerations]

### Success Metrics (from framework)
[Feature success metrics and acceptance criteria]

## Feature Development Specific Recommendations
[Role-specific feature planning recommendations and strategies]

---
*Generated by feature-planner analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "feature_planner": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/feature-planner/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: Feature development insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance