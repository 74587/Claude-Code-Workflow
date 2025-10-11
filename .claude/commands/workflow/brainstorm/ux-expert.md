---
name: ux-expert
description: Generate or update ux-expert/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:ux-expert [topic]
argument-hint: "optional topic - uses existing framework if available"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🎯 **UX Expert Analysis Generator**

### Purpose
**Specialized command for generating ux-expert/analysis.md** that addresses topic-framework.md discussion points from user experience and interface design perspective. Creates or updates role-specific analysis with framework references.

### Core Function
- **Framework-based Analysis**: Address each discussion point in topic-framework.md
- **UX Design Focus**: User interface, interaction patterns, and usability optimization
- **Update Mechanism**: Create new or update existing analysis.md
- **Agent Delegation**: Use conceptual-planning-agent for analysis generation

### Analysis Scope
- **User Interface Design**: Visual hierarchy, layout patterns, and component design
- **Interaction Patterns**: User flows, navigation, and microinteractions
- **Usability Optimization**: Accessibility, cognitive load, and user testing strategies
- **Design Systems**: Component libraries, design tokens, and consistency frameworks

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

Execute ux-expert analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: ux-expert
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/ux-expert/
ANALYSIS_MODE: {framework_mode ? "framework_based" : "standalone"}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load ux-expert planning template
   - Command: bash($(cat ~/.claude/workflows/cli-templates/planning-roles/ux-expert.md))
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and existing context
   - Command: Read(.workflow/WFS-{session}/workflow-session.json)
   - Output: session_context

## Analysis Requirements
**Framework Reference**: Address all discussion points in topic-framework.md from user experience and interface design perspective
**Role Focus**: UI design, interaction patterns, usability optimization, design systems
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive UX design analysis addressing all framework discussion points
2. **Framework Reference**: Include @../topic-framework.md reference in analysis

## Completion Criteria
- Address each discussion point from topic-framework.md with UX design expertise
- Provide actionable interface design and usability optimization strategies
- Include accessibility considerations and interaction pattern recommendations
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
      content: "Execute ux-expert analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing ux-expert framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured ux-expert analysis"
    },
    {
      content: "Update workflow-session.json with ux-expert completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/ux-expert/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# UX Expert Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: User Experience & Interface Design perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with UX design expertise]

### Core Requirements (from framework)
[User interface and interaction design requirements perspective]

### Technical Considerations (from framework)
[Design system implementation and technical feasibility considerations]

### User Experience Factors (from framework)
[Usability optimization, accessibility, and user-centered design analysis]

### Implementation Challenges (from framework)
[Design implementation challenges and progressive enhancement strategies]

### Success Metrics (from framework)
[UX metrics including usability testing, user satisfaction, and design KPIs]

## UX Expert Specific Recommendations
[Role-specific interface design patterns and usability optimization strategies]

---
*Generated by ux-expert analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "ux_expert": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/ux-expert/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: UX design insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance
