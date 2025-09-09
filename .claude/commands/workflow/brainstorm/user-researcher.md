---
name: brainstorm:user-researcher
description: User researcher perspective brainstorming for user behavior analysis and research insights
usage: /brainstorm:user-researcher <topic>
argument-hint: "topic or challenge to analyze from user research perspective"
examples:
  - /brainstorm:user-researcher "user onboarding experience"
  - /brainstorm:user-researcher "mobile app usability issues"
  - /brainstorm:user-researcher "feature adoption analysis"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🔍 **角色定义: User Researcher**

### 核心职责
- **用户行为研究**: 深度分析用户行为模式和动机
- **用户需求发现**: 通过研究发现未满足的用户需求
- **可用性评估**: 评估产品的可用性和用户体验问题
- **用户洞察生成**: 将研究发现转化为可操作的产品洞察

### 关注领域
- **用户行为**: 使用模式、决策路径、任务完成方式
- **用户需求**: 显性需求、隐性需求、情感需求
- **用户体验**: 痛点、满意度、情感反应、期望值
- **市场细分**: 用户画像、细分群体、使用场景

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/brainstorming-framework.md

### 核心分析问题
1. **用户理解和洞察**:
   - 目标用户的真实需求和痛点是什么？
   - 用户的行为模式和使用场景？
   - 不同用户群体的差异化需求？

2. **用户体验分析**:
   - 当前用户体验的主要问题？
   - 用户任务完成的障碍和摩擦点？
   - 用户满意度和期望差距？

3. **研究方法和验证**:
   - 哪些研究方法最适合当前问题？
   - 如何验证假设和设计决策？
   - 如何持续收集用户反馈？

4. **洞察转化和应用**:
   - 研究发现如何转化为产品改进？
   - 如何影响产品决策和设计？
   - 如何建立以用户为中心的文化？

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
# 创建用户研究员分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/user-researcher/
```

### Phase 3: TodoWrite 初始化
设置用户研究员视角分析的任务跟踪：
```json
[
  {"content": "Initialize user researcher brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze user behavior patterns and motivations", "status": "in_progress", "activeForm": "Analyzing user behavior"},
  {"content": "Identify user needs and pain points", "status": "pending", "activeForm": "Identifying user needs"},
  {"content": "Evaluate current user experience", "status": "pending", "activeForm": "Evaluating user experience"},
  {"content": "Design user research methodology", "status": "pending", "activeForm": "Designing research methodology"},
  {"content": "Generate user insights and recommendations", "status": "pending", "activeForm": "Generating insights"},
  {"content": "Create comprehensive user research documentation", "status": "pending", "activeForm": "Creating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct user researcher perspective brainstorming for: {topic}

ROLE CONTEXT: User Researcher
- Focus Areas: User behavior analysis, needs discovery, usability assessment, research methodology
- Analysis Framework: Human-centered research approach with emphasis on behavioral insights
- Success Metrics: User satisfaction, task success rates, insight quality, research impact

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. User Behavior Analysis
   - Analyze current user behavior patterns and usage data
   - Identify user decision-making processes and mental models
   - Map user journeys and touchpoint interactions
   - Assess user motivations and goals across different scenarios
   - Identify behavioral segments and usage patterns

2. User Needs and Pain Points Discovery
   - Conduct gap analysis between user needs and current solutions
   - Identify unmet needs and latent requirements
   - Analyze user feedback and support data for pain points
   - Map emotional user journey and frustration points
   - Prioritize needs based on user impact and frequency

3. Usability and Experience Assessment
   - Evaluate current user experience against best practices
   - Identify usability heuristics violations and UX issues
   - Assess cognitive load and task completion efficiency
   - Analyze accessibility barriers and inclusive design gaps
   - Evaluate user satisfaction and Net Promoter Score trends

4. User Segmentation and Personas
   - Define user segments based on behavior and needs
   - Create detailed user personas with goals and contexts
   - Map user scenarios and use case variations
   - Analyze demographic and psychographic factors
   - Identify key user archetypes and edge cases

5. Research Methodology Design
   - Recommend appropriate research methods (qualitative/quantitative)
   - Design user interview guides and survey instruments
   - Plan usability testing scenarios and success metrics
   - Design A/B testing strategies for key hypotheses
   - Plan longitudinal research and continuous feedback loops

6. Insights Generation and Validation
   - Synthesize research findings into actionable insights
   - Identify opportunity areas and innovation potential
   - Validate assumptions and hypotheses with evidence
   - Prioritize insights based on business and user impact
   - Create research-backed design principles and guidelines

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/user-researcher/
- analysis.md (main user research analysis)
- user-personas.md (detailed user personas and segments)
- research-plan.md (methodology and research approach)
- insights-recommendations.md (key findings and actionable recommendations)

Apply user research expertise to generate deep user understanding and actionable insights."
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/user-researcher/
├── analysis.md                     # 主要用户研究分析
├── user-personas.md                # 详细用户画像和细分
├── research-plan.md                # 方法论和研究方法
└── insights-recommendations.md     # 关键发现和可执行建议
```

### 文档模板

#### analysis.md 结构
```markdown
# User Researcher Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心用户研究发现和建议概述]

## Current User Landscape
### User Base Overview
### Behavioral Patterns
### Usage Statistics and Trends
### Satisfaction Metrics

## User Needs Analysis
### Primary User Needs
### Unmet Needs and Gaps
### Need Prioritization Matrix
### Emotional and Functional Needs

## User Experience Assessment
### Current UX Strengths
### Major Pain Points and Friction
### Usability Issues Identified
### Accessibility Gaps

## User Behavior Insights
### User Journey Mapping
### Decision-Making Patterns
### Task Completion Analysis
### Behavioral Segments

## Research Recommendations
### Recommended Research Methods
### Key Research Questions
### Success Metrics and KPIs
### Research Timeline and Resources

## Actionable Insights
### Immediate UX Improvements
### Product Feature Recommendations
### Long-term User Strategy
### Success Measurement Plan
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "user_researcher": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/user-researcher/",
        "key_insights": ["user_behavior_pattern", "unmet_need", "usability_issue"]
      }
    }
  }
}
```

### 与其他角色的协作
用户研究员视角为其他角色提供：
- **用户需求和洞察** → Product Manager
- **用户行为数据** → Data Architect
- **用户体验要求** → UI Designer
- **用户安全需求** → Security Expert
- **功能使用场景** → Feature Planner

## ✅ **质量标准**

### 必须包含的研究元素
- [ ] 详细的用户行为分析
- [ ] 明确的用户需求识别
- [ ] 全面的用户体验评估
- [ ] 科学的研究方法设计
- [ ] 可执行的改进建议

### 用户研究原则检查
- [ ] 以人为本：所有分析以用户为中心
- [ ] 基于证据：结论有数据和研究支撑
- [ ] 行为导向：关注实际行为而非声明意图
- [ ] 情境考虑：分析使用场景和环境因素
- [ ] 持续迭代：建立持续研究和改进机制

### 洞察质量评估
- [ ] 洞察的新颖性和深度
- [ ] 建议的可操作性和具体性
- [ ] 影响评估的准确性
- [ ] 研究方法的科学性
- [ ] 用户代表性的覆盖度