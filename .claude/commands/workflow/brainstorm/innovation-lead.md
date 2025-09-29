---
name: innovation-lead
description: Generate or update innovation-lead/analysis.md addressing topic-framework discussion points
usage: /workflow:brainstorm:innovation-lead [topic]
argument-hint: "optional topic - uses existing framework if available"
examples:
  - /workflow:brainstorm:innovation-lead
  - /workflow:brainstorm:innovation-lead "AI integration opportunities"
  - /workflow:brainstorm:innovation-lead "future technology trends"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🚀 **Role Overview: Innovation Lead**

### Role Definition
Visionary technology strategist responsible for identifying emerging technology trends, evaluating disruptive innovation opportunities, and designing future-ready solutions that create competitive advantage and drive market transformation.

### Core Responsibilities
- **Trend Identification**: Identify and analyze emerging technology trends and market opportunities
- **Innovation Strategy**: Develop innovation roadmaps and technology development strategies
- **Technology Assessment**: Evaluate new technology application potential and feasibility
- **Future Planning**: Design forward-looking product and service concepts

### Focus Areas
- **Emerging Technologies**: AI, blockchain, IoT, AR/VR, quantum computing, and other frontier technologies
- **Market Trends**: Industry transformation, user behavior evolution, business model innovation
- **Innovation Opportunities**: Disruptive innovation, blue ocean markets, technology convergence opportunities
- **Future Vision**: Long-term technology roadmaps, proof of concepts, prototype development

### Success Metrics
- Innovation impact and market differentiation
- Technology adoption rates and competitive advantage
- Future readiness and strategic positioning
- Breakthrough opportunity identification and validation

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md

### Key Analysis Questions

**1. Emerging Trends and Technology Opportunities**
- Which emerging technologies will have the greatest impact on our industry?
- What is the technology maturity level and adoption timeline?
- What new opportunities does technology convergence create?

**2. Disruption Potential and Innovation Assessment**
- What is the potential for disruptive innovation and its impact?
- What innovation opportunities exist within current solutions?
- What unmet market needs and demands exist?

**3. Competitive Advantage and Market Analysis**
- What are competitors' innovation strategies and directions?
- What market gaps and blue ocean opportunities exist?
- What technological barriers and first-mover advantages are available?

**4. Implementation and Risk Assessment**
- What is the feasibility and risk of technology implementation?
- What are the investment requirements and expected returns?
- What organizational innovation capabilities and adaptability are needed?

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
**Innovation Lead Perspective Questioning**

Before agent assignment, gather comprehensive innovation lead context:

#### 📋 Role-Specific Questions

**1. Emerging Trends and Future Technologies**
- What emerging technologies or trends do you think will be most relevant to this topic?
- Are there any specific industries or markets you want to explore for innovation opportunities?
- What time horizon are you considering (near-term, medium-term, long-term disruption)?
- Are there any particular technology domains you want to focus on (AI, IoT, blockchain, etc.)?

**2. Innovation Opportunities and Market Potential**
- What current limitations or pain points could be addressed through innovation?
- Are there any unmet market needs or underserved segments you're aware of?
- What would disruptive success look like in this context?
- Are there cross-industry innovations that could be applied to this domain?

**3. Disruption Potential and Competitive Landscape**
- Who are the current market leaders and what are their innovation strategies?
- What startup activity or venture capital investment trends are you seeing?
- Are there any potential platform shifts or ecosystem changes on the horizon?
- What would make a solution truly differentiated in the marketplace?

**4. Implementation and Strategic Considerations**
- What organizational capabilities or partnerships would be needed for innovation?
- Are there regulatory, technical, or market barriers to consider?
- What level of risk tolerance exists for breakthrough vs. incremental innovation?
- How important is first-mover advantage versus fast-follower strategies?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/innovation-lead-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated innovation lead conceptual analysis for: {topic}

ASSIGNED_ROLE: innovation-lead
OUTPUT_LOCATION: .brainstorming/innovation-lead/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load innovation-lead planning template\",
    \"command\": \"bash($(cat ~/.claude/workflows/cli-templates/planning-roles/innovation-lead.md))\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply innovation lead perspective to topic analysis
- Focus on emerging trends, disruption potential, competitive advantage, and future opportunities
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main innovation lead analysis
- recommendations.md: Innovation lead recommendations
- deliverables/: Innovation lead-specific outputs as defined in role template

Embody innovation lead role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather innovation lead context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to innovation-lead-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load innovation-lead planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for innovation-lead role", "status": "pending", "activeForm": "Executing agent"}
]
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
      content: "Execute innovation-lead analysis using conceptual-planning-agent with FLOW_CONTROL",
      status: "pending",
      activeForm: "Executing innovation-lead framework analysis"
    },
    {
      content: "Generate analysis.md addressing all framework discussion points",
      status: "pending",
      activeForm: "Generating structured innovation-lead analysis"
    },
    {
      content: "Update session.json with innovation-lead completion status",
      status: "pending",
      activeForm: "Updating session metadata"
    }
  ]
});
```

## 📊 **Output Structure**

### Framework-Based Analysis
```
.workflow/WFS-{session}/.brainstorming/innovation-lead/
└── analysis.md    # Structured analysis addressing topic-framework.md discussion points
```

### Analysis Document Structure
```markdown
# Innovation Lead Analysis: [Topic from Framework]

## Framework Reference
**Topic Framework**: @../topic-framework.md
**Role Focus**: Innovation and Emerging Technology perspective

## Discussion Points Analysis
[Address each point from topic-framework.md with innovation expertise]

### Core Requirements (from framework)
[Innovation perspective on emerging technology requirements]

### Technical Considerations (from framework)
[Future technology and breakthrough considerations]

### User Experience Factors (from framework)
[Future user behavior and interaction trends]

### Implementation Challenges (from framework)
[Innovation implementation and market adoption considerations]

### Success Metrics (from framework)
[Innovation success metrics and breakthrough criteria]

## Innovation Specific Recommendations
[Role-specific innovation opportunities and breakthrough concepts]

---
*Generated by innovation-lead analysis addressing structured framework*
```

## 🔄 **Session Integration**

### Completion Status Update
```json
{
  "innovation_lead": {
    "status": "completed",
    "framework_addressed": true,
    "output_location": ".workflow/WFS-{session}/.brainstorming/innovation-lead/analysis.md",
    "framework_reference": "@../topic-framework.md"
  }
}
```

### Integration Points
- **Framework Reference**: @../topic-framework.md for structured discussion points
- **Cross-Role Synthesis**: Innovation insights available for synthesis-report.md integration
- **Agent Autonomy**: Independent execution with framework guidance