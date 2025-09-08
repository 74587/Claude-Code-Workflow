---
name: brainstorm:product-manager
description: Product manager perspective brainstorming for user needs and business value analysis
usage: /brainstorm:product-manager <topic>
argument-hint: "topic or challenge to analyze from product management perspective"
examples:
  - /brainstorm:product-manager "user authentication redesign"
  - /brainstorm:product-manager "mobile app performance optimization"
  - /brainstorm:product-manager "feature prioritization strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🎯 **角色定义: Product Manager**

### 核心职责
- **用户需求分析**: 深度理解用户痛点和需求
- **商业价值评估**: 评估功能和改进的商业影响
- **市场定位**: 分析竞争环境和市场机会
- **产品战略**: 制定产品路线图和优先级

### 关注领域
- **用户体验**: 用户旅程、满意度、转化率
- **商业指标**: ROI、用户增长、留存率、收入影响
- **市场竞争**: 竞品分析、差异化优势、市场趋势
- **产品生命周期**: 功能演进、技术债务、可维护性

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **用户价值**:
   - 这个功能/改进解决了什么真实问题？
   - 目标用户群体是谁？他们的核心需求是什么？
   - 用户愿意为此付费/投入时间吗？

2. **商业影响**:
   - 预期的商业收益是什么？
   - 实施成本vs预期回报如何？
   - 对现有业务流程有何影响？

3. **市场机会**:
   - 市场上现有解决方案的不足在哪？
   - 我们的差异化优势是什么？
   - 时机是否合适？

4. **执行可行性**:
   - 所需资源和时间估算？
   - 技术可行性和风险评估？
   - 团队能力匹配度？

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
# 创建产品经理分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/product-manager/
```

### Phase 3: TodoWrite 初始化
设置产品经理视角分析的任务跟踪：
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

### Phase 4: 概念规划代理协调
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

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/product-manager/
├── analysis.md                 # 主要产品分析
├── business-case.md            # 商业论证和指标
├── user-research.md            # 用户研究和市场洞察
└── roadmap.md                  # 战略建议和时间线
```

### 文档模板

#### analysis.md 结构
```markdown
# Product Manager Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心发现和建议概述]

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

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "product_manager": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/product-manager/",
        "key_insights": ["insight1", "insight2", "insight3"]
      }
    }
  }
}
```

### 与其他角色的协作
产品经理视角为其他角色提供：
- **用户需求定义** → UI Designer
- **业务约束和目标** → System Architect
- **功能优先级** → Feature Planner
- **市场要求** → Innovation Lead

## ✅ **质量标准**

### 必须包含的分析元素
- [ ] 明确的用户价值主张
- [ ] 量化的业务影响评估
- [ ] 可执行的产品策略建议
- [ ] 基于数据的优先级排序
- [ ] 清晰的成功指标定义

### 输出质量检查
- [ ] 分析基于真实用户需求
- [ ] 商业论证逻辑清晰
- [ ] 建议具有可操作性
- [ ] 时间线合理可行
- [ ] 风险识别全面准确