---
name: innovation-lead
description: Innovation lead perspective brainstorming for emerging technologies and future opportunities analysis
usage: /workflow:brainstorm:innovation-lead <topic>
argument-hint: "topic or challenge to analyze from innovation and emerging technology perspective"
examples:
  - /workflow:brainstorm:innovation-lead "AI integration opportunities"
  - /workflow:brainstorm:innovation-lead "future technology trends"
  - /workflow:brainstorm:innovation-lead "disruptive innovation strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
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
    \"command\": \"bash(~/.claude/scripts/planning-role-load.sh load innovation-lead)\",
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

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/innovation-lead/
├── analysis.md                 # 主要创新分析和机会评估
├── technology-roadmap.md       # 技术趋势和未来场景
├── innovation-concepts.md      # 突破性想法和概念开发
└── strategy-implementation.md  # 创新策略和执行计划
```

### 文档模板

#### analysis.md 结构
```markdown
# Innovation Lead Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心创新机会和战略建议概述]

## Technology Landscape Assessment
### Emerging Technologies Overview
### Technology Maturity Analysis
### Convergence Opportunities
### Disruptive Potential Assessment

## Innovation Opportunity Analysis
### Market Whitespace Identification
### Unmet Needs and Pain Points
### Disruptive Innovation Potential
### Blue Ocean Opportunities

## Competitive Intelligence
### Competitor Innovation Strategies
### Patent Landscape Analysis
### Startup Ecosystem Insights
### Investment and Funding Trends

## Future Scenarios and Trends
### Short-term Innovations (0-2 years)
### Medium-term Disruptions (2-5 years)
### Long-term Transformations (5+ years)
### Wild Card Scenarios

## Innovation Concepts
### Breakthrough Ideas
### Proof-of-Concept Opportunities
### Platform Innovation Possibilities
### Ecosystem Partnership Ideas

## Strategic Recommendations
### Innovation Investment Priorities
### Technology Partnership Strategy
### Capability Building Requirements
### Risk Mitigation Approaches

## Implementation Roadmap
### Innovation Pilot Programs
### Technology Validation Milestones
### Scaling and Commercialization Plan
### Success Metrics and KPIs
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "innovation_lead": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/innovation-lead/",
        "key_insights": ["breakthrough_opportunity", "emerging_technology", "disruptive_potential"]
      }
    }
  }
}
```

### 与其他角色的协作
创新领导视角为其他角色提供：
- **创新机会和趋势** → Product Manager
- **新技术可行性** → System Architect
- **未来用户体验趋势** → UI Designer
- **新兴数据技术** → Data Architect
- **创新安全挑战** → Security Expert

## ✅ **质量标准**

### 必须包含的创新元素
- [ ] 全面的技术趋势分析
- [ ] 明确的创新机会识别
- [ ] 具体的概念验证方案
- [ ] 现实的实施路线图
- [ ] 前瞻性的风险评估

### 创新思维原则检查
- [ ] 前瞻性：关注未来3-10年趋势
- [ ] 颠覆性：寻找破坏性创新机会
- [ ] 系统性：考虑技术生态系统影响
- [ ] 可行性：平衡愿景与现实可能
- [ ] 差异化：创造独特竞争优势

### 创新价值评估
- [ ] 市场影响的潜在规模
- [ ] 技术可行性和成熟度
- [ ] 竞争优势的可持续性
- [ ] 投资回报的时间框架
- [ ] 组织实施的复杂度