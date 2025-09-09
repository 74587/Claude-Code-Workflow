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
@~/.claude/workflows/brainstorming-framework.md

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

## ⚙️ **Execution Protocol**

### Phase 1: Session Detection & Initialization
```bash
# Detect active workflow session
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    request_user_for_session_creation()
```

### Phase 2: Directory Structure Creation
```bash
# Create product manager analysis directory
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/product-manager/
```

### Phase 3: Task Tracking Initialization
Initialize product manager perspective analysis tracking:
```json
[
  {"content": "Initialize product manager brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze user needs and pain points", "status": "in_progress", "activeForm": "Analyzing user needs"},
  {"content": "Evaluate business value and impact", "status": "pending", "activeForm": "Evaluating business impact"},
  {"content": "Assess market opportunities", "status": "pending", "activeForm": "Assessing market opportunities"},
  {"content": "Develop product strategy recommendations", "status": "pending", "activeForm": "Developing strategy"},
  {"content": "Create prioritized action plan", "status": "pending", "activeForm": "Creating action plan"},
  {"content": "Generate comprehensive product analysis", "status": "pending", "activeForm": "Generating analysis"}
]
```

### Phase 4: Conceptual Planning Agent Coordination
```bash
Task(conceptual-planning-agent): "
Conduct product management perspective brainstorming for: {topic}

ROLE CONTEXT: Product Manager
- Focus Areas: User needs, business value, market positioning, product strategy
- Analysis Framework: User-centric approach with business impact assessment
- Success Metrics: User satisfaction, business growth, market differentiation

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. User Needs Analysis
   - Identify core user problems and pain points
   - Define target user segments and personas
   - Map user journey and experience gaps
   - Prioritize user requirements by impact and frequency

2. Business Value Assessment
   - Quantify potential business impact (revenue, growth, efficiency)
   - Analyze cost-benefit ratio and ROI projections
   - Identify key success metrics and KPIs
   - Assess risk factors and mitigation strategies

3. Market Opportunity Analysis
   - Competitive landscape and gap analysis
   - Market trends and emerging opportunities
   - Differentiation strategies and unique value propositions
   - Go-to-market considerations

4. Product Strategy Development
   - Feature prioritization matrix
   - Product roadmap recommendations
   - Resource allocation strategies
   - Implementation timeline and milestones

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/product-manager/
- analysis.md (main product management analysis)
- business-case.md (business justification and metrics)
- user-research.md (user needs and market insights)
- roadmap.md (strategic recommendations and timeline)

Apply product management expertise to generate actionable insights addressing business goals and user needs."
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