---
name: ui-designer
description: Generate or update ui-designer/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:ui-designer [topic]
argument-hint: "optional topic - uses existing framework if available"
examples:
  - /workflow:brainstorm:ui-designer
  - /workflow:brainstorm:ui-designer "user authentication redesign"
  - /workflow:brainstorm:ui-designer "mobile app navigation improvement"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🎨 **UI Designer Analysis Generator**

### Purpose
**Specialized command for generating ui-designer/analysis.md** that addresses topic-framework.md discussion points from UI/UX design perspective. Creates or updates role-specific analysis with framework references.

### Core Function
- **Framework-based Analysis**: Address each discussion point in topic-framework.md
- **UI/UX Focus**: User experience, interface design, and accessibility perspective
- **Update Mechanism**: Create new or update existing analysis.md
- **Agent Delegation**: Use conceptual-planning-agent for analysis generation

### Analysis Scope
- **User Experience Design**: Intuitive and efficient user experiences
- **Interface Design**: Beautiful and functional user interfaces
- **Interaction Design**: Smooth user interaction flows and micro-interactions
- **Accessibility Design**: Inclusive design meeting WCAG compliance

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

Execute ui-designer analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: ui-designer
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/ui-designer/
ANALYSIS_MODE: {framework_mode ? "framework_based" : "standalone"}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load ui-designer planning template
   - Command: bash($(cat ~/.claude/workflows/cli-templates/planning-roles/ui-designer.md))
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and existing context
   - Command: Read(.workflow/WFS-{session}/workflow-session.json)
   - Output: session_context

## Analysis Requirements
**Framework Reference**: Address all discussion points in topic-framework.md from UI/UX perspective
**Role Focus**: User experience design, interface optimization, accessibility compliance
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive UI/UX analysis addressing all framework discussion points
2. **Framework Reference**: Include @../topic-framework.md reference in analysis

## Completion Criteria
- Address each discussion point from topic-framework.md with UI/UX design expertise
- Provide actionable design recommendations and interface solutions
- Include accessibility considerations and WCAG compliance planning
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
      content: "Execute ui-designer analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing ui-designer framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured ui-designer analysis"
    },
    {
      content: "Update workflow-session.json with ui-designer completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/ui-designer/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# UI Designer Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: UI/UX Design perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with UI/UX expertise]

### Core Requirements (from framework)
[UI/UX perspective on requirements]

### Technical Considerations (from framework)
[Interface and design system considerations]

### User Experience Factors (from framework)
[Detailed UX analysis and recommendations]

### Implementation Challenges (from framework)
[Design implementation and accessibility considerations]

### Success Metrics (from framework)
[UX metrics and usability success criteria]

## UI/UX Specific Recommendations
[Role-specific design recommendations and solutions]

---
*Generated by ui-designer analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "ui_designer": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/ui-designer/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: UI/UX insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance