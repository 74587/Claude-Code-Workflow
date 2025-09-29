---
name: security-expert
description: Generate or update security-expert/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:security-expert [topic]
argument-hint: "optional topic - uses existing framework if available"
examples:
  - /workflow:brainstorm:security-expert
  - /workflow:brainstorm:security-expert "user authentication security review"
  - /workflow:brainstorm:security-expert "API security architecture"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🔒 **Security Expert Analysis Generator**

### Purpose
**Specialized command for generating security-expert/analysis.md** that addresses topic-framework.md discussion points from cybersecurity perspective. Creates or updates role-specific analysis with framework references.

### Core Function
- **Framework-based Analysis**: Address each discussion point in topic-framework.md
- **Cybersecurity Focus**: Threat modeling, security architecture, and risk management
- **Update Mechanism**: Create new or update existing analysis.md
- **Agent Delegation**: Use conceptual-planning-agent for analysis generation

### Analysis Scope
- **Threat Modeling**: Attack vectors, threat actors, and vulnerability assessment
- **Security Architecture**: Controls, defensive measures, and compliance
- **Risk Management**: Risk assessment, mitigation, and security policies
- **Implementation Security**: Integration, monitoring, and incident response

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

Execute security-expert analysis for existing topic framework

## Context Loading
ASSIGNED_ROLE: security-expert
OUTPUT_LOCATION: .workflow/WFS-{session}/.brainstorming/security-expert/
ANALYSIS_MODE: {framework_mode ? "framework_based" : "standalone"}

## Flow Control Steps
1. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content

2. **load_role_template**
   - Action: Load security-expert planning template
   - Command: bash($(cat ~/.claude/workflows/cli-templates/planning-roles/security-expert.md))
   - Output: role_template_guidelines

3. **load_session_metadata**
   - Action: Load session metadata and existing context
   - Command: Read(.workflow/WFS-{session}/.brainstorming/session.json)
   - Output: session_context

## Analysis Requirements
**Framework Reference**: Address all discussion points in topic-framework.md from cybersecurity perspective
**Role Focus**: Threat modeling, security architecture, risk management, compliance
**Structured Approach**: Create analysis.md addressing framework discussion points
**Template Integration**: Apply role template guidelines within framework structure

## Expected Deliverables
1. **analysis.md**: Comprehensive security analysis addressing all framework discussion points
2. **Framework Reference**: Include @../topic-framework.md reference in analysis

## Completion Criteria
- Address each discussion point from topic-framework.md with cybersecurity expertise
- Provide actionable security controls and threat mitigation strategies
- Include compliance requirements and risk assessment insights
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
      content: "Execute security-expert analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing security-expert framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured security-expert analysis"
    },
    {
      content: "Update session.json with security-expert completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/security-expert/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# Security Expert Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: Cybersecurity perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with cybersecurity expertise]

### Core Requirements (from framework)
[Security perspective on threat modeling and protection requirements]

### Technical Considerations (from framework)
[Security architecture and technical control considerations]

### User Experience Factors (from framework)
[Security usability and user protection considerations]

### Implementation Challenges (from framework)
[Security implementation and compliance considerations]

### Success Metrics (from framework)
[Security success metrics and risk management criteria]

## Cybersecurity Specific Recommendations
[Role-specific security controls and threat mitigation strategies]

---
*Generated by security-expert analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "security_expert": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/security-expert/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: Security insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance