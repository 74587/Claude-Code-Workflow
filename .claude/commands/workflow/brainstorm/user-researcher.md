---
name: user-researcher
description: User researcher perspective brainstorming for user behavior analysis and research insights
usage: /workflow:brainstorm:user-researcher <topic>
argument-hint: "topic or challenge to analyze from user research perspective"
examples:
  - /workflow:brainstorm:user-researcher "user onboarding experience"
  - /workflow:brainstorm:user-researcher "mobile app usability issues"
  - /workflow:brainstorm:user-researcher "feature adoption analysis"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🔍 **Role Overview: User Researcher**

### Role Definition
User experience research specialist responsible for understanding user behavior, identifying needs and pain points, and transforming research insights into actionable product improvements that enhance user satisfaction and engagement.

### Core Responsibilities
- **User Behavior Research**: Deep analysis of user behavior patterns and motivations
- **User Needs Discovery**: Research to discover unmet user needs and requirements
- **Usability Assessment**: Evaluate product usability and user experience issues
- **User Insights Generation**: Transform research findings into actionable product insights

### Focus Areas
- **User Behavior**: Usage patterns, decision paths, task completion methods
- **User Needs**: Explicit needs, implicit needs, emotional requirements
- **User Experience**: Pain points, satisfaction levels, emotional responses, expectations
- **Market Segmentation**: User personas, demographic segments, usage scenarios

### Success Metrics
- User satisfaction and engagement scores
- Task success rates and completion times
- Quality and actionability of research insights
- Impact of research on product decisions

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md

### Key Analysis Questions

**1. User Understanding and Insights**
- What are the real needs and pain points of target users?
- What are the user behavior patterns and usage scenarios?
- What are the differentiated needs of various user groups?

**2. User Experience Analysis**
- What are the main issues with the current user experience?
- What obstacles and friction points exist in user task completion?
- What gaps exist between user satisfaction and expectations?

**3. Research Methods and Validation**
- Which research methods are most suitable for the current problem?
- How can hypotheses and design decisions be validated?
- How can continuous user feedback be collected?

**4. Insights Translation and Application**
- How can research findings be translated into product improvements?
- How can product decisions and design be influenced?
- How can a user-centered culture be established?

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
**User Researcher Perspective Questioning**

Before agent assignment, gather comprehensive user researcher context:

#### 📋 Role-Specific Questions

**1. User Behavior Patterns and Insights**
- Who are the primary users and what are their key characteristics?
- What user behaviors, patterns, or pain points have you observed?
- Are there specific user segments or personas you're particularly interested in?
- What user feedback or data do you already have available?

**2. Research Focus and Pain Points**
- What specific user experience problems or questions need to be addressed?
- Are there particular user tasks, workflows, or touchpoints to focus on?
- What assumptions about users need to be validated or challenged?
- What gaps exist in your current understanding of user needs?

**3. Research Context and Constraints**
- What research has been done previously and what were the key findings?
- Are there specific research methods you prefer or want to avoid?
- What timeline and resources are available for user research?
- Who are the key stakeholders that need to understand user insights?

**4. User Testing Strategy and Goals**
- What specific user experience improvements are you hoping to achieve?
- How do you currently measure user satisfaction or success?
- Are there competitive products or experiences you want to benchmark against?
- What would successful user research outcomes look like for this project?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/user-researcher-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated user researcher conceptual analysis for: {topic}

ASSIGNED_ROLE: user-researcher
OUTPUT_LOCATION: .brainstorming/user-researcher/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load user-researcher planning template\",
    \"command\": \"bash($(cat ~/.claude/workflows/cli-templates/planning-roles/user-researcher.md))\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply user researcher perspective to topic analysis
- Focus on user behavior patterns, pain points, research insights, and user testing strategy
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main user researcher analysis
- recommendations.md: User researcher recommendations
- deliverables/: User researcher-specific outputs as defined in role template

Embody user researcher role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather user researcher context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to user-researcher-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load user-researcher planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for user-researcher role", "status": "pending", "activeForm": "Executing agent"}
]
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