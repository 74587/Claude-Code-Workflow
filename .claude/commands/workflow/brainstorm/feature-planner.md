---
name: brainstorm:feature-planner
description: Feature planner perspective brainstorming for feature development and planning analysis
usage: /brainstorm:feature-planner <topic>
argument-hint: "topic or challenge to analyze from feature planning perspective"
examples:
  - /brainstorm:feature-planner "user dashboard enhancement"
  - /brainstorm:feature-planner "mobile app feature roadmap"
  - /brainstorm:feature-planner "integration capabilities planning"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🔧 **角色定义: Feature Planner**

### 核心职责
- **功能规划**: 设计和规划产品功能的开发路线图
- **需求转化**: 将业务需求转化为具体的功能规范
- **优先级排序**: 基于价值和资源平衡功能开发优先级
- **交付规划**: 制定功能开发和发布时间表

### 关注领域
- **功能设计**: 功能规范、用户故事、验收标准
- **开发规划**: 迭代计划、里程碑、依赖关系管理
- **质量保证**: 测试策略、质量标准、验收流程
- **发布管理**: 发布策略、版本控制、变更管理

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **功能需求分析**:
   - 核心功能需求和用户故事？
   - 功能的MVP和完整版本规划？
   - 跨功能依赖和集成需求？

2. **技术可行性评估**:
   - 技术实现的复杂度和挑战？
   - 现有系统的扩展和改造需求？
   - 第三方服务和API集成？

3. **开发资源和时间估算**:
   - 开发工作量和时间预估？
   - 所需技能和团队配置？
   - 开发风险和缓解策略？

4. **测试和质量保证**:
   - 测试策略和测试用例设计？
   - 质量标准和验收条件？
   - 用户验收和反馈机制？

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
# 创建功能规划师分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/feature-planner/
```

### Phase 3: TodoWrite 初始化
设置功能规划师视角分析的任务跟踪：
```json
[
  {"content": "Initialize feature planner brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze feature requirements and user stories", "status": "in_progress", "activeForm": "Analyzing feature requirements"},
  {"content": "Design feature architecture and specifications", "status": "pending", "activeForm": "Designing feature architecture"},
  {"content": "Plan development phases and prioritization", "status": "pending", "activeForm": "Planning development phases"},
  {"content": "Evaluate testing strategy and quality assurance", "status": "pending", "activeForm": "Evaluating testing strategy"},
  {"content": "Create implementation timeline and milestones", "status": "pending", "activeForm": "Creating timeline"},
  {"content": "Generate comprehensive feature planning documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct feature planner perspective brainstorming for: {topic}

ROLE CONTEXT: Feature Planner
- Focus Areas: Feature specification, development planning, quality assurance, delivery management
- Analysis Framework: Feature-centric approach with emphasis on deliverability and user value
- Success Metrics: Feature completion, quality standards, user satisfaction, delivery timeline

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Feature Requirements Analysis
   - Break down high-level requirements into specific feature specifications
   - Create detailed user stories with acceptance criteria
   - Identify feature dependencies and integration requirements
   - Map features to user personas and use cases
   - Define feature scope and boundaries (MVP vs full feature)

2. Feature Architecture and Design
   - Design feature workflows and user interaction patterns
   - Plan feature integration with existing system components
   - Define APIs and data interfaces required
   - Plan for feature configuration and customization options
   - Design feature monitoring and analytics capabilities

3. Development Planning and Estimation
   - Estimate development effort and complexity for each feature
   - Identify technical risks and implementation challenges
   - Plan feature development phases and incremental delivery
   - Define development milestones and checkpoints
   - Assess resource requirements and team capacity

4. Quality Assurance and Testing Strategy
   - Design comprehensive testing strategy (unit, integration, E2E)
   - Create test scenarios and edge case coverage
   - Plan performance testing and scalability validation
   - Design user acceptance testing procedures
   - Plan for accessibility and usability testing

5. Feature Prioritization and Roadmap
   - Apply prioritization frameworks (MoSCoW, Kano, RICE)
   - Balance business value with development complexity
   - Create feature release planning and versioning strategy
   - Plan for feature flags and gradual rollout
   - Design feature deprecation and sunset strategies

6. Delivery and Release Management
   - Plan feature delivery timeline and release schedule
   - Design change management and deployment strategies
   - Plan for feature documentation and user training
   - Create feature success metrics and KPIs
   - Design post-release monitoring and support plans

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/feature-planner/
- analysis.md (main feature analysis and specifications)
- user-stories.md (detailed user stories and acceptance criteria)
- development-plan.md (development timeline and resource planning)
- testing-strategy.md (quality assurance and testing approach)

Apply feature planning expertise to create deliverable, high-quality feature implementations."
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