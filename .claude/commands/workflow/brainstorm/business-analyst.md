---
name: business-analyst
description: Business analyst perspective brainstorming for process optimization and business efficiency analysis
usage: /workflow:brainstorm:business-analyst <topic>
argument-hint: "topic or challenge to analyze from business analysis perspective"
examples:
  - /workflow:brainstorm:business-analyst "workflow automation opportunities"
  - /workflow:brainstorm:business-analyst "business process optimization"
  - /workflow:brainstorm:business-analyst "cost reduction initiatives"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 📊 **Role Overview: Business Analyst**

### Role Definition
Business process expert responsible for analyzing workflows, identifying requirements, and optimizing business operations to maximize value and efficiency.

### Core Responsibilities
- **Process Analysis**: Analyze existing business processes for efficiency and improvement opportunities
- **Requirements Analysis**: Identify and define business requirements and functional specifications
- **Value Assessment**: Evaluate solution business value and return on investment
- **Change Management**: Plan and manage business process changes

### Focus Areas
- **Process Optimization**: Workflows, automation opportunities, efficiency improvements
- **Data Analysis**: Business metrics, KPI design, performance measurement
- **Cost-Benefit**: ROI analysis, cost optimization, value creation
- **Risk Management**: Business risks, compliance requirements, change risks

### Success Metrics
- Process efficiency improvements (time/cost reduction)
- Requirements clarity and completeness
- Stakeholder satisfaction levels
- ROI achievement and value delivery

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md

### Key Analysis Questions

**1. Business Process Analysis**
- What are the bottlenecks and inefficiencies in current business processes?
- Which processes can be automated or simplified?
- What are the obstacles in cross-departmental collaboration?

**2. Business Requirements Identification**
- What are the core needs of stakeholders?
- What are the business objectives and success metrics?
- How should functional and non-functional requirements be prioritized?

**3. Value and Benefit Analysis**
- What is the expected business value of the solution?
- How does implementation cost compare to expected benefits?
- What are the risk assessments and mitigation strategies?

**4. Implementation and Change Management**
- How will changes impact existing processes?
- What training and adaptation requirements exist?
- What success metrics and monitoring mechanisms are needed?

## ⚡ **Two-Step Execution Flow**

### ⚠️ Session Management - FIRST STEP
Session detection and selection:
```bash
# Check for active sessions
active_sessions=$(find .workflow -name ".active-*" 2>/dev/null)
if [ multiple_sessions ]; then
  prompt_user_to_select_session()
else
  use_existing_or_create_new()
fi
```

### Step 1: Context Gathering Phase
**Business Analyst Perspective Questioning**

Before agent assignment, gather comprehensive business analyst context:

#### 📋 Role-Specific Questions

**1. Business Process Analysis**
- What are the current business processes and workflows that need analysis?
- Which departments, teams, or stakeholders are involved in these processes?
- What are the key bottlenecks, inefficiencies, or pain points you've observed?
- What metrics or KPIs are currently used to measure process performance?

**2. Cost and Resource Analysis**
- What are the current costs associated with these processes (time, money, resources)?
- How much time do stakeholders spend on these activities daily/weekly?
- What technology, tools, or systems are currently being used?
- What budget constraints or financial targets need to be considered?

**3. Business Requirements and Objectives**
- What are the primary business objectives this analysis should achieve?
- Who are the key stakeholders and what are their specific needs?
- What are the success criteria and how will you measure improvement?
- Are there any compliance, regulatory, or governance requirements?

**4. Change Management and Implementation**
- How ready is the organization for process changes?
- What training or change management support might be needed?
- What timeline or deadlines are we working with?
- What potential resistance or challenges do you anticipate?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/business-analyst-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated business analyst conceptual analysis for: {topic}

ASSIGNED_ROLE: business-analyst
OUTPUT_LOCATION: .brainstorming/business-analyst/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load business-analyst planning template\",
    \"command\": \"bash(~/.claude/scripts/planning-role-load.sh load business-analyst)\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply business analyst perspective to topic analysis
- Focus on process optimization, cost-benefit analysis, and change management
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main business analyst analysis
- recommendations.md: Business analyst recommendations
- deliverables/: Business analyst-specific outputs as defined in role template

Embody business analyst role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather business analyst context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to business-analyst-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load business-analyst planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for business-analyst role", "status": "pending", "activeForm": "Executing agent"}
]
```

## 📊 **Output Structure**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/business-analyst/
├── analysis.md                 # Main business analysis and process assessment
├── requirements.md             # Detailed business requirements and specifications
├── business-case.md            # Cost-benefit analysis and financial justification
└── implementation-plan.md      # Change management and implementation strategy
```

### Document Templates

#### analysis.md Structure
```markdown
# Business Analyst Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Overview of key business analysis findings and recommendations]

## Current State Assessment
### Business Process Mapping
### Stakeholder Analysis
### Performance Metrics Analysis
### Pain Points and Inefficiencies

## Business Requirements
### Functional Requirements
### Non-Functional Requirements
### Stakeholder Needs Analysis
### Requirements Prioritization

## Process Optimization Opportunities
### Automation Potential
### Workflow Improvements
### Resource Optimization
### Quality Enhancements

## Financial Analysis
### Cost-Benefit Analysis
### ROI Calculations
### Budget Requirements
### Financial Projections

## Risk Assessment
### Business Risks
### Operational Risks
### Mitigation Strategies
### Contingency Planning

## Implementation Strategy
### Change Management Plan
### Training Requirements
### Timeline and Milestones
### Success Metrics and KPIs

## Recommendations
### Immediate Actions (0-3 months)
### Medium-term Initiatives (3-12 months)
### Long-term Strategic Goals (12+ months)
### Resource Requirements
```

## 🔄 **Session Integration**

### Status Synchronization
After analysis completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "business_analyst": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/business-analyst/",
        "key_insights": ["process_optimization", "cost_saving", "efficiency_gain"]
      }
    }
  }
}
```

### Collaboration with Other Roles
Business analyst perspective provides to other roles:
- **Business requirements and constraints** → Product Manager
- **Process technology requirements** → System Architect
- **Business process interface needs** → UI Designer
- **Business data requirements** → Data Architect
- **Business security requirements** → Security Expert

## ✅ **Quality Standards**

### Required Analysis Elements
- [ ] Detailed business process mapping
- [ ] Clear requirements specifications and priorities
- [ ] Quantified cost-benefit analysis
- [ ] Comprehensive risk assessment
- [ ] Actionable implementation plan

### Business Analysis Principles Checklist
- [ ] Value-oriented: Focus on business value creation
- [ ] Data-driven: Analysis based on facts and data
- [ ] Holistic thinking: Consider entire business ecosystem
- [ ] Risk awareness: Identify and manage various risks
- [ ] Sustainability: Long-term maintainability and improvement

### Analysis Quality Metrics
- [ ] Requirements completeness and accuracy
- [ ] Quantified benefits from process optimization
- [ ] Comprehensiveness of risk assessment
- [ ] Feasibility of implementation plan
- [ ] Stakeholder satisfaction levels