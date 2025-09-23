---
name: feature-planner
description: Feature planner perspective brainstorming for feature development and planning analysis
usage: /workflow:brainstorm:feature-planner <topic>
argument-hint: "topic or challenge to analyze from feature planning perspective"
examples:
  - /workflow:brainstorm:feature-planner "user dashboard enhancement"
  - /workflow:brainstorm:feature-planner "mobile app feature roadmap"
  - /workflow:brainstorm:feature-planner "integration capabilities planning"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🔧 **Role Overview: Feature Planner**

### Role Definition
Feature development specialist responsible for transforming business requirements into actionable feature specifications, managing development priorities, and ensuring successful feature delivery through strategic planning and execution.

### Core Responsibilities
- **Feature Specification**: Transform business requirements into detailed feature specifications
- **Development Planning**: Create development roadmaps and manage feature priorities
- **Quality Assurance**: Design testing strategies and acceptance criteria
- **Delivery Management**: Plan feature releases and manage implementation timelines

### Focus Areas
- **Feature Design**: User stories, acceptance criteria, feature specifications
- **Development Planning**: Sprint planning, milestones, dependency management
- **Quality Assurance**: Testing strategies, quality gates, acceptance processes
- **Release Management**: Release planning, version control, change management

### Success Metrics
- Feature delivery on time and within scope
- Quality standards and acceptance criteria met
- User satisfaction with delivered features
- Development team productivity and efficiency

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md

### Key Analysis Questions

**1. Feature Requirements and Scope**
- What are the core feature requirements and user stories?
- How should MVP and full feature versions be planned?
- What cross-feature dependencies and integration requirements exist?

**2. Implementation Complexity and Feasibility**
- What is the technical implementation complexity and what challenges exist?
- What extensions or modifications to existing systems are required?
- What third-party services and API integrations are needed?

**3. Development Resources and Timeline**
- What are the development effort estimates and time projections?
- What skills and team configurations are required?
- What development risks exist and how can they be mitigated?

**4. Testing and Quality Assurance**
- What testing strategies and test case designs are needed?
- What quality standards and acceptance criteria should be defined?
- What user acceptance and feedback mechanisms are required?

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
**Feature Planner Perspective Questioning**

Before agent assignment, gather comprehensive feature planner context:

#### 📋 Role-Specific Questions

**1. Implementation Complexity and Scope**
- What is the scope and complexity of the features you want to plan?
- Are there existing features or systems that need to be extended or integrated?
- What are the technical constraints or requirements that need to be considered?
- How do these features fit into the overall product roadmap?

**2. Dependency Mapping and Integration**
- What other features, systems, or teams does this depend on?
- Are there any external APIs, services, or third-party integrations required?
- What are the data dependencies and how will data flow between components?
- What are the potential blockers or risks that could impact development?

**3. Risk Assessment and Mitigation**
- What are the main technical, business, or timeline risks?
- Are there any unknowns or areas that need research or prototyping?
- What fallback plans or alternative approaches should be considered?
- How will quality and testing be ensured throughout development?

**4. Technical Feasibility and Resource Planning**
- What is the estimated development effort and timeline?
- What skills, expertise, or team composition is needed?
- Are there any specific technologies, tools, or frameworks required?
- What are the performance, scalability, or maintenance considerations?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/feature-planner-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated feature planner conceptual analysis for: {topic}

ASSIGNED_ROLE: feature-planner
OUTPUT_LOCATION: .brainstorming/feature-planner/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load feature-planner planning template\",
    \"command\": \"bash(~/.claude/scripts/planning-role-load.sh load feature-planner)\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply feature planner perspective to topic analysis
- Focus on implementation complexity, dependency mapping, risk assessment, and technical feasibility
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main feature planner analysis
- recommendations.md: Feature planner recommendations
- deliverables/: Feature planner-specific outputs as defined in role template

Embody feature planner role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather feature planner context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to feature-planner-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load feature-planner planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for feature-planner role", "status": "pending", "activeForm": "Executing agent"}
]
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/feature-planner/
├── analysis.md                 # 主要功能分析和规范
├── user-stories.md             # 详细用户故事和验收标准
├── development-plan.md         # 开发时间线和资源规划
└── testing-strategy.md         # 质量保证和测试方法
```

### 文档模板

#### analysis.md 结构
```markdown
# Feature Planner Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心功能规划发现和建议概述]

## Feature Requirements Overview
### Core Feature Specifications
### User Story Summary
### Feature Scope and Boundaries
### Success Criteria and KPIs

## Feature Architecture Design
### Feature Components and Modules
### Integration Points and Dependencies
### APIs and Data Interfaces
### Configuration and Customization

## Development Planning
### Effort Estimation and Complexity
### Development Phases and Milestones
### Resource Requirements
### Risk Assessment and Mitigation

## Quality Assurance Strategy
### Testing Approach and Coverage
### Performance and Scalability Testing
### User Acceptance Testing Plan
### Quality Gates and Standards

## Delivery and Release Strategy
### Release Planning and Versioning
### Deployment Strategy
### Feature Rollout Plan
### Post-Release Support

## Feature Prioritization
### Priority Matrix (High/Medium/Low)
### Business Value Assessment
### Development Complexity Analysis
### Recommended Implementation Order

## Implementation Roadmap
### Phase 1: Core Features (Weeks 1-4)
### Phase 2: Enhanced Features (Weeks 5-8)
### Phase 3: Advanced Features (Weeks 9-12)
### Continuous Improvement Plan
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "feature_planner": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/feature-planner/",
        "key_insights": ["feature_specification", "development_timeline", "quality_requirement"]
      }
    }
  }
}
```

### 与其他角色的协作
功能规划师视角为其他角色提供：
- **功能优先级和规划** → Product Manager
- **技术实现需求** → System Architect
- **界面功能要求** → UI Designer
- **数据功能需求** → Data Architect
- **功能安全需求** → Security Expert

## ✅ **质量标准**

### 必须包含的规划元素
- [ ] 详细的功能规范和用户故事
- [ ] 现实的开发时间估算
- [ ] 全面的测试策略
- [ ] 明确的质量标准
- [ ] 可执行的发布计划

### 功能规划原则检查
- [ ] 用户价值：每个功能都有明确的用户价值
- [ ] 可测试性：所有功能都有验收标准
- [ ] 可维护性：考虑长期维护和扩展
- [ ] 可交付性：计划符合团队能力和资源
- [ ] 可测量性：有明确的成功指标

### 交付质量评估
- [ ] 功能完整性和正确性
- [ ] 性能和稳定性指标
- [ ] 用户体验和满意度
- [ ] 代码质量和可维护性
- [ ] 文档完整性和准确性