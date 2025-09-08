---
name: brainstorm:system-architect
description: System architect perspective brainstorming for technical architecture and scalability analysis
usage: /brainstorm:system-architect <topic>
argument-hint: "topic or challenge to analyze from system architecture perspective"
examples:
  - /brainstorm:system-architect "user authentication redesign"
  - /brainstorm:system-architect "microservices migration strategy"
  - /brainstorm:system-architect "system performance optimization"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🏗️ **角色定义: System Architect**

### 核心职责
- **技术架构设计**: 设计可扩展、可维护的系统架构
- **技术选型**: 评估和选择合适的技术栈和工具
- **系统集成**: 设计系统间的集成和通信机制
- **性能优化**: 识别性能瓶颈并提出优化方案

### 关注领域
- **可扩展性**: 系统容量规划、负载处理、弹性扩展
- **可靠性**: 高可用性、容错设计、灾难恢复
- **安全性**: 架构安全、数据保护、访问控制
- **维护性**: 代码质量、模块化设计、技术债务管理

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **架构设计**:
   - 当前架构的优势和局限性是什么？
   - 如何设计满足业务需求的技术架构？
   - 微服务vs单体架构的权衡？

2. **技术选型**:
   - 哪些技术栈最适合当前需求？
   - 新技术的引入风险和收益？
   - 团队技术能力与选型的匹配度？

3. **系统集成**:
   - 系统间如何高效集成和通信？
   - 第三方服务集成策略？
   - API设计和版本管理？

4. **性能和扩展**:
   - 系统性能瓶颈在哪里？
   - 如何应对流量增长？
   - 数据库扩展和优化策略？

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
# 创建系统架构师分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/system-architect/
```

### Phase 3: TodoWrite 初始化
设置系统架构师视角分析的任务跟踪：
```json
[
  {"content": "Initialize system architect brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze current system architecture", "status": "in_progress", "activeForm": "Analyzing architecture"},
  {"content": "Evaluate technical requirements and constraints", "status": "pending", "activeForm": "Evaluating requirements"},
  {"content": "Design optimal system architecture", "status": "pending", "activeForm": "Designing architecture"},
  {"content": "Assess scalability and performance", "status": "pending", "activeForm": "Assessing scalability"},
  {"content": "Plan technology stack and integration", "status": "pending", "activeForm": "Planning technology"},
  {"content": "Generate comprehensive architecture documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct system architecture perspective brainstorming for: {topic}

ROLE CONTEXT: System Architect
- Focus Areas: Technical architecture, scalability, system integration, performance
- Analysis Framework: Architecture-first approach with scalability and maintainability focus
- Success Metrics: System performance, availability, maintainability, technical debt reduction

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Current Architecture Assessment
   - Analyze existing system architecture and identify pain points
   - Evaluate current technology stack effectiveness
   - Assess technical debt and maintenance overhead
   - Identify architectural bottlenecks and limitations

2. Requirements and Constraints Analysis
   - Define functional and non-functional requirements
   - Identify performance, scalability, and availability requirements
   - Analyze security and compliance constraints
   - Assess resource and budget limitations

3. Architecture Design and Strategy
   - Design optimal system architecture for the given requirements
   - Recommend technology stack and architectural patterns
   - Plan for microservices vs monolithic architecture decisions
   - Design data architecture and storage strategies

4. Integration and Scalability Planning
   - Design system integration patterns and APIs
   - Plan for horizontal and vertical scaling strategies
   - Design monitoring, logging, and observability systems
   - Plan deployment and DevOps strategies

5. Risk Assessment and Mitigation
   - Identify technical risks and failure points
   - Design fault tolerance and disaster recovery strategies
   - Plan for security vulnerabilities and mitigations
   - Assess migration risks and strategies

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/system-architect/
- analysis.md (main architecture analysis)
- architecture-design.md (detailed system design and diagrams)
- technology-stack.md (technology recommendations and justifications)
- integration-plan.md (system integration and API strategies)

Apply system architecture expertise to generate scalable, maintainable, and performant solutions."
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/system-architect/
├── analysis.md                 # 主要架构分析
├── architecture-design.md      # 详细系统设计和图表
├── technology-stack.md         # 技术栈建议和理由
└── integration-plan.md         # 系统集成和API策略
```

### 文档模板

#### analysis.md 结构
```markdown
# System Architecture Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心架构发现和建议概述]

## Current State Assessment
### Existing Architecture Overview
### Technical Stack Analysis
### Performance Bottlenecks
### Technical Debt Assessment

## Requirements Analysis
### Functional Requirements
### Non-Functional Requirements
- Performance: [响应时间、吞吐量要求]
- Scalability: [用户量、数据量增长预期]
- Availability: [可用性要求]
- Security: [安全要求]

## Proposed Architecture
### High-Level Architecture Design
### Component Breakdown
### Data Flow Diagrams
### Technology Stack Recommendations

## Implementation Strategy
### Migration Planning
### Risk Mitigation
### Performance Optimization
### Security Considerations

## Scalability and Maintenance
### Horizontal Scaling Strategy
### Monitoring and Observability
### Deployment Strategy
### Long-term Maintenance Plan
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "system_architect": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/system-architect/",
        "key_insights": ["scalability_bottleneck", "architecture_pattern", "technology_recommendation"]
      }
    }
  }
}
```

### 与其他角色的协作
系统架构师视角为其他角色提供：
- **技术约束和可能性** → Product Manager
- **架构要求和限制** → UI Designer  
- **数据架构需求** → Data Architect
- **安全架构框架** → Security Expert
- **技术实现框架** → Feature Planner

## ✅ **质量标准**

### 必须包含的分析元素
- [ ] 清晰的架构图和组件设计
- [ ] 详细的技术栈评估和推荐
- [ ] 可扩展性和性能分析
- [ ] 系统集成和API设计
- [ ] 风险评估和缓解策略

### 架构设计原则检查
- [ ] 可扩展性：系统能够处理增长
- [ ] 可维护性：代码结构清晰，易于修改
- [ ] 可靠性：具有容错和恢复机制
- [ ] 安全性：内置安全控制和保护
- [ ] 性能优化：满足响应时间和吞吐量要求

### 技术决策验证
- [ ] 技术选型有充分理由和对比分析
- [ ] 架构模式适合业务需求
- [ ] 集成方案考虑了兼容性和维护成本
- [ ] 部署策略可行且风险可控
- [ ] 监控和运维策略完整