---
name: product-manager
description: Product manager perspective brainstorming for user needs and business value analysis
usage: /workflow:brainstorm:product-manager <topic>
argument-hint: "topic or challenge to analyze from product management perspective"
examples:
  - /workflow:brainstorm:product-manager "user authentication redesign"
  - /workflow:brainstorm:product-manager "mobile app performance optimization"
  - /workflow:brainstorm:product-manager "feature prioritization strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🎯 **Role Overview: Product Manager**

### Role Definition
Strategic product leader focused on maximizing user value and business impact through data-driven decisions and market-oriented thinking.

### Core Responsibilities
- **User Needs Analysis**: Identify and validate genuine user problems and requirements
- **Business Value Assessment**: Quantify commercial impact and return on investment
- **Market Positioning**: Analyze competitive landscape and identify opportunities
- **Product Strategy**: Develop roadmaps, priorities, and go-to-market approaches

### Focus Areas
- **User Experience**: Journey mapping, satisfaction metrics, conversion optimization
- **Business Metrics**: ROI, user growth, retention rates, revenue impact
- **Market Dynamics**: Competitive analysis, differentiation, market trends
- **Product Lifecycle**: Feature evolution, technical debt management, scalability

### Success Metrics
- User satisfaction scores and engagement metrics
- Business KPIs (revenue, growth, retention)
- Market share and competitive positioning
- Product adoption and feature utilization rates

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md

### Key Analysis Questions

**1. User Value Assessment**
- What genuine user problem does this solve?
- Who are the target users and what are their core needs?
- How does this improve the user experience measurably?

**2. Business Impact Evaluation**
- What are the expected business outcomes?
- How does the cost-benefit analysis look?
- What impact will this have on existing workflows?

**3. Market Opportunity Analysis**
- What gaps exist in current market solutions?
- What is our unique competitive advantage?
- Is the timing right for this initiative?

**4. Execution Feasibility**
- What resources and timeline are required?
- What are the technical and market risks?
- Do we have the right team capabilities?

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
**Product Manager Perspective Questioning**

Before agent assignment, gather comprehensive product management context:

#### 📋 Role-Specific Questions
1. **Business Objectives & Metrics**
   - Primary business goals and success metrics?
   - Revenue impact expectations and timeline?
   - Key stakeholders and decision makers?

2. **Target Users & Market**
   - Primary user segments and personas?
   - User pain points and current solutions?
   - Competitive landscape and differentiation needs?

3. **Product Strategy & Scope**
   - Feature priorities and user value propositions?
   - Resource constraints and timeline expectations?
   - Integration with existing product ecosystem?

4. **Success Criteria & Risk Assessment**
   - How will success be measured and validated?
   - Market and technical risks to consider?
   - Go-to-market strategy requirements?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/product-manager-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated product-manager conceptual analysis for: {topic}

ASSIGNED_ROLE: product-manager
OUTPUT_LOCATION: .brainstorming/product-manager/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load product-manager planning template\",
    \"command\": \"bash($(cat ~/.claude/workflows/cli-templates/planning-roles/product-manager.md))\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply product-manager perspective to topic analysis
- Focus on user value, business impact, and market positioning
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main product management analysis
- recommendations.md: Product strategy recommendations
- deliverables/: Product-specific outputs as defined in role template

Embody product-manager role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather product manager context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to product-manager-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load product-manager planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for product-manager role", "status": "pending", "activeForm": "Executing agent"}
]
```

## 📊 **Output Specification**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/product-manager/
├── analysis.md                 # Primary product management analysis
├── business-case.md            # Business justification and metrics
├── user-research.md            # User research and market insights
└── roadmap.md                  # Strategic recommendations and timeline
```

### Document Templates

#### analysis.md Structure
```markdown
# Product Manager Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Key findings and recommendations overview]

## User Needs Analysis
### Target User Segments
### Core Problems Identified
### User Journey Mapping
### Priority Requirements

## Business Impact Assessment
### Revenue Impact
### Cost Analysis
### ROI Projections
### Risk Assessment

## Competitive Analysis
### Market Position
### Differentiation Opportunities
### Competitive Advantages

## Strategic Recommendations
### Immediate Actions (0-3 months)
### Medium-term Initiatives (3-12 months)
### Long-term Vision (12+ months)
```

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "product_manager": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/product-manager/",
        "key_insights": ["user_value_proposition", "business_impact_assessment", "strategic_recommendations"]
      }
    }
  }
}
```

### Cross-Role Collaboration
Product manager perspective provides:
- **User Requirements Definition** → UI Designer
- **Business Constraints and Objectives** → System Architect
- **Feature Prioritization** → Feature Planner
- **Market Requirements** → Innovation Lead
- **Success Metrics** → Business Analyst

## ✅ **Quality Assurance**

### Required Analysis Elements
- [ ] Clear user value proposition with supporting evidence
- [ ] Quantified business impact assessment with metrics
- [ ] Actionable product strategy recommendations
- [ ] Data-driven priority rankings
- [ ] Well-defined success criteria and KPIs

### Output Quality Standards
- [ ] Analysis grounded in real user needs and market data
- [ ] Business justification with clear logic and assumptions
- [ ] Recommendations are specific and actionable
- [ ] Timeline and milestones are realistic and achievable
- [ ] Risk identification is comprehensive and accurate

### Product Management Principles
- [ ] **User-Centric**: All decisions prioritize user value and experience
- [ ] **Data-Driven**: Conclusions supported by metrics and research
- [ ] **Market-Aware**: Considers competitive landscape and trends
- [ ] **Business-Focused**: Aligns with commercial objectives and constraints
- [ ] **Execution-Ready**: Provides clear next steps and success measures