---
name: brainstorm:innovation-lead
description: Innovation lead perspective brainstorming for emerging technologies and future opportunities analysis
usage: /brainstorm:innovation-lead <topic>
argument-hint: "topic or challenge to analyze from innovation and emerging technology perspective"
examples:
  - /brainstorm:innovation-lead "AI integration opportunities"
  - /brainstorm:innovation-lead "future technology trends"
  - /brainstorm:innovation-lead "disruptive innovation strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🚀 **角色定义: Innovation Lead**

### 核心职责
- **趋势识别**: 识别和分析新兴技术趋势和市场机会
- **创新策略**: 制定创新路线图和技术发展战略
- **技术评估**: 评估新技术的应用潜力和可行性
- **未来规划**: 设计面向未来的产品和服务概念

### 关注领域
- **新兴技术**: AI、区块链、IoT、AR/VR、量子计算等前沿技术
- **市场趋势**: 行业变革、用户行为演进、商业模式创新
- **创新机会**: 破坏性创新、蓝海市场、技术融合机会
- **未来愿景**: 长期技术路线图、概念验证、原型开发

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **技术趋势和机会**:
   - 哪些新兴技术对我们的行业最有影响？
   - 技术成熟度和采用时间轴？
   - 技术融合创造的新机会？

2. **创新潜力评估**:
   - 破坏性创新的可能性和影响？
   - 现有解决方案的创新空间？
   - 未被满足的市场需求？

3. **竞争和市场分析**:
   - 竞争对手的创新动向？
   - 市场空白和蓝海机会？
   - 技术壁垒和先发优势？

4. **实施和风险评估**:
   - 技术实施的可行性和风险？
   - 投资需求和预期回报？
   - 组织创新能力和适应性？

## ⚙️ **执行协议**

### Phase 1: 会话检测与初始化
```bash
# 自动检测活动会话
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    request_user_for_session_creation()
```

### Phase 2: 目录结构创建
```bash
# 创建创新领导分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/innovation-lead/
```

### Phase 3: TodoWrite 初始化
设置创新领导视角分析的任务跟踪：
```json
[
  {"content": "Initialize innovation lead brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Research emerging technology trends and opportunities", "status": "in_progress", "activeForm": "Researching technology trends"},
  {"content": "Analyze innovation potential and market disruption", "status": "pending", "activeForm": "Analyzing innovation potential"},
  {"content": "Evaluate competitive landscape and positioning", "status": "pending", "activeForm": "Evaluating competitive landscape"},
  {"content": "Design future-oriented solutions and concepts", "status": "pending", "activeForm": "Designing future solutions"},
  {"content": "Assess implementation feasibility and roadmap", "status": "pending", "activeForm": "Assessing implementation"},
  {"content": "Generate comprehensive innovation strategy documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct innovation lead perspective brainstorming for: {topic}

ROLE CONTEXT: Innovation Lead
- Focus Areas: Emerging technologies, market disruption, future opportunities, innovation strategy
- Analysis Framework: Forward-thinking approach with emphasis on breakthrough innovation and competitive advantage
- Success Metrics: Innovation impact, market differentiation, technology adoption, future readiness

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Emerging Technology Landscape Analysis
   - Research current and emerging technology trends relevant to the topic
   - Analyze technology maturity levels and adoption curves
   - Identify breakthrough technologies with disruptive potential
   - Assess technology convergence opportunities and synergies
   - Map technology evolution timelines and critical milestones

2. Innovation Opportunity Assessment
   - Identify unmet market needs and whitespace opportunities
   - Analyze potential for disruptive innovation vs incremental improvement
   - Assess blue ocean market opportunities and new value propositions
   - Evaluate cross-industry innovation transfer possibilities
   - Identify platform and ecosystem innovation opportunities

3. Competitive Intelligence and Market Analysis
   - Analyze competitor innovation strategies and technology investments
   - Identify market leaders and emerging disruptors
   - Assess patent landscapes and intellectual property opportunities
   - Evaluate startup ecosystem and potential acquisition targets
   - Analyze venture capital and funding trends in related areas

4. Future Scenario Planning
   - Design multiple future scenarios based on technology trends
   - Create technology roadmaps with short, medium, and long-term horizons
   - Identify potential black swan events and wild card scenarios
   - Plan for technology convergence and platform shifts
   - Design adaptive strategies for uncertain futures

5. Innovation Concept Development
   - Generate breakthrough product and service concepts
   - Design minimum viable innovation experiments
   - Create proof-of-concept prototyping strategies
   - Plan innovation pilot programs and validation approaches
   - Design scalable innovation frameworks and processes

6. Implementation Strategy and Risk Assessment
   - Assess organizational innovation readiness and capabilities
   - Identify required technology investments and partnerships
   - Evaluate risks including technology, market, and execution risks
   - Design innovation governance and decision-making frameworks
   - Plan talent acquisition and capability building strategies

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/innovation-lead/
- analysis.md (main innovation analysis and opportunity assessment)
- technology-roadmap.md (technology trends and future scenarios)
- innovation-concepts.md (breakthrough ideas and concept development)
- strategy-implementation.md (innovation strategy and execution plan)

Apply innovation leadership expertise to identify breakthrough opportunities and design future-ready strategies."
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