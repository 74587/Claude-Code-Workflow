---
name: business-analyst
description: Generate or update business-analyst/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:business-analyst [topic]
argument-hint: "optional topic - uses existing framework if available"
examples:
  - /workflow:brainstorm:business-analyst
  - /workflow:brainstorm:business-analyst "workflow automation opportunities"
  - /workflow:brainstorm:business-analyst "business process optimization"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 📊 **Business Analyst Analysis Generator**

### Purpose
**Specialized command for generating business-analyst/analysis.md** that addresses topic-framework.md discussion points from business analysis perspective. Creates or updates role-specific analysis with framework references.

### Core Function
- **Framework-based Analysis**: Address each discussion point in topic-framework.md
- **Business Analysis Focus**: Process optimization, requirements analysis, and business efficiency perspective
- **Update Mechanism**: Create new or update existing analysis.md
- **Agent Delegation**: Use conceptual-planning-agent for analysis generation

### Analysis Scope
- **Process Analysis**: Analyze existing business processes for efficiency and improvement opportunities
- **Requirements Analysis**: Identify and define business requirements and functional specifications
- **Value Analysis**: Assess cost-benefit and ROI of business initiatives
- **Change Management**: Plan organizational change and process transformation

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

Execute business-analyst analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: business-analyst
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/business-analyst/
ANALYSIS_MODE: {framework_mode ? "framework_based" : "standalone"}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load business-analyst planning template
   - Command: bash($(cat ~/.claude/workflows/cli-templates/planning-roles/business-analyst.md))
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and existing context
   - Command: Read(.workflow/WFS-{session}/.brainstorming/session.json)
   - Output: session_context

## Analysis Requirements
**Framework Reference**: Address all discussion points in topic-framework.md from business analysis perspective
**Role Focus**: Process optimization, requirements analysis, business efficiency
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive business analysis addressing all framework discussion points
2. **Framework Reference**: Include @../topic-framework.md reference in analysis

## Completion Criteria
- Address each discussion point from topic-framework.md with business analysis expertise
- Provide process optimization recommendations and requirements specifications
- Include cost-benefit analysis and change management considerations
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
      content: "Execute business-analyst analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing business-analyst framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured business-analyst analysis"
    },
    {
      content: "Update session.json with business-analyst completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/business-analyst/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# Business Analyst Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: Business Analysis perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with business analysis expertise]

### Core Requirements (from framework)
[Business analysis perspective on requirements]

### Technical Considerations (from framework)
[Business process and workflow considerations]

### User Experience Factors (from framework)
[Business user experience and stakeholder considerations]

### Implementation Challenges (from framework)
[Change management and process transformation challenges]

### Success Metrics (from framework)
[Business success metrics and performance indicators]

## Business Analysis Specific Recommendations
[Role-specific business process recommendations and solutions]

---
*Generated by business-analyst analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "business_analyst": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/business-analyst/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: Business analysis insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance