---
name: brainstorm:business-analyst
description: Business analyst perspective brainstorming for process optimization and business efficiency analysis
usage: /brainstorm:business-analyst <topic>
argument-hint: "topic or challenge to analyze from business analysis perspective"
examples:
  - /brainstorm:business-analyst "workflow automation opportunities"
  - /brainstorm:business-analyst "business process optimization"
  - /brainstorm:business-analyst "cost reduction initiatives"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 📊 **角色定义: Business Analyst**

### 核心职责
- **流程分析**: 分析现有业务流程的效率和改进机会
- **需求分析**: 识别和定义业务需求和功能要求
- **效益评估**: 评估解决方案的商业价值和投资回报
- **变更管理**: 规划和管理业务流程变更

### 关注领域
- **流程优化**: 工作流程、自动化机会、效率提升
- **数据分析**: 业务指标、KPI设计、性能测量
- **成本效益**: ROI分析、成本优化、价值创造
- **风险管理**: 业务风险、合规要求、变更风险

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **业务流程分析**:
   - 当前业务流程的瓶颈和低效环节？
   - 哪些流程可以自动化或简化？
   - 跨部门协作中的障碍点？

2. **业务需求识别**:
   - 利益相关者的核心需求？
   - 业务目标和成功指标？
   - 功能和非功能需求优先级？

3. **价值和效益分析**:
   - 解决方案的预期商业价值？
   - 实施成本vs收益对比？
   - 风险评估和缓解策略？

4. **实施和变更管理**:
   - 变更对现有流程的影响？
   - 培训和适应需求？
   - 成功指标和监控机制？

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
# 创建业务分析师分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/business-analyst/
```

### Phase 3: TodoWrite 初始化
设置业务分析师视角分析的任务跟踪：
```json
[
  {"content": "Initialize business analyst brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze current business processes and workflows", "status": "in_progress", "activeForm": "Analyzing business processes"},
  {"content": "Identify business requirements and stakeholder needs", "status": "pending", "activeForm": "Identifying requirements"},
  {"content": "Evaluate cost-benefit and ROI analysis", "status": "pending", "activeForm": "Evaluating cost-benefit"},
  {"content": "Design process improvements and optimizations", "status": "pending", "activeForm": "Designing improvements"},
  {"content": "Plan change management and implementation", "status": "pending", "activeForm": "Planning change management"},
  {"content": "Generate comprehensive business analysis documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct business analyst perspective brainstorming for: {topic}

ROLE CONTEXT: Business Analyst
- Focus Areas: Process optimization, requirements analysis, cost-benefit analysis, change management
- Analysis Framework: Business-centric approach with emphasis on efficiency and value creation
- Success Metrics: Process efficiency, cost reduction, stakeholder satisfaction, ROI achievement

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Current State Business Analysis
   - Map existing business processes and workflows
   - Identify process inefficiencies and bottlenecks
   - Analyze current costs, resources, and time investments
   - Assess stakeholder roles and responsibilities
   - Document pain points and improvement opportunities

2. Requirements Gathering and Analysis
   - Identify key stakeholders and their needs
   - Define functional and non-functional business requirements
   - Prioritize requirements based on business value and urgency
   - Analyze requirement dependencies and constraints
   - Create requirements traceability matrix

3. Process Design and Optimization
   - Design optimized future state processes
   - Identify automation opportunities and digital solutions
   - Plan for process standardization and best practices
   - Design quality gates and control points
   - Create process documentation and standard operating procedures

4. Cost-Benefit and ROI Analysis
   - Calculate implementation costs (people, technology, time)
   - Quantify expected benefits (cost savings, efficiency gains, revenue)
   - Perform ROI analysis and payback period calculation
   - Assess intangible benefits (customer satisfaction, employee morale)
   - Create business case with financial justification

5. Risk Assessment and Mitigation
   - Identify business, operational, and technical risks
   - Assess impact and probability of identified risks
   - Develop risk mitigation strategies and contingency plans
   - Plan for compliance and regulatory requirements
   - Design risk monitoring and control measures

6. Change Management and Implementation Planning
   - Assess organizational change readiness and impact
   - Design change management strategy and communication plan
   - Plan training and knowledge transfer requirements
   - Create implementation timeline with milestones
   - Design success metrics and monitoring framework

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/business-analyst/
- analysis.md (main business analysis and process assessment)
- requirements.md (detailed business requirements and specifications)
- business-case.md (cost-benefit analysis and financial justification)
- implementation-plan.md (change management and implementation strategy)

Apply business analysis expertise to optimize processes and maximize business value."
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/business-analyst/
├── analysis.md                 # 主要业务分析和流程评估
├── requirements.md             # 详细业务需求和规范
├── business-case.md            # 成本效益分析和财务论证
└── implementation-plan.md      # 变更管理和实施策略
```

### 文档模板

#### analysis.md 结构
```markdown
# Business Analyst Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心业务分析发现和建议概述]

## Current State Assessment
### Business Process Mapping
### Stakeholder Analysis
### Performance Metrics Analysis
### Pain Points and Inefficiencies

## Business Requirements
### Functional Requirements
### Non-Functional Requirements
### Stakeholder Needs Analysis
### Requirements Prioritization

## Process Optimization Opportunities
### Automation Potential
### Workflow Improvements
### Resource Optimization
### Quality Enhancements

## Financial Analysis
### Cost-Benefit Analysis
### ROI Calculations
### Budget Requirements
### Financial Projections

## Risk Assessment
### Business Risks
### Operational Risks
### Mitigation Strategies
### Contingency Planning

## Implementation Strategy
### Change Management Plan
### Training Requirements
### Timeline and Milestones
### Success Metrics and KPIs

## Recommendations
### Immediate Actions (0-3 months)
### Medium-term Initiatives (3-12 months)
### Long-term Strategic Goals (12+ months)
### Resource Requirements
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "business_analyst": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/business-analyst/",
        "key_insights": ["process_optimization", "cost_saving", "efficiency_gain"]
      }
    }
  }
}
```

### 与其他角色的协作
业务分析师视角为其他角色提供：
- **业务需求和约束** → Product Manager
- **流程技术化需求** → System Architect
- **业务流程界面需求** → UI Designer
- **业务数据需求** → Data Architect
- **业务安全要求** → Security Expert

## ✅ **质量标准**

### 必须包含的分析元素
- [ ] 详细的业务流程映射
- [ ] 明确的需求规范和优先级
- [ ] 量化的成本效益分析
- [ ] 全面的风险评估
- [ ] 可执行的实施计划

### 业务分析原则检查
- [ ] 以价值为导向：关注商业价值创造
- [ ] 数据驱动：基于事实和数据进行分析
- [ ] 全局思维：考虑整个业务生态系统
- [ ] 风险意识：识别和管理各类风险
- [ ] 可持续性：长期可维护和改进

### 分析质量指标
- [ ] 需求的完整性和准确性
- [ ] 流程优化的量化收益
- [ ] 风险评估的全面性
- [ ] 实施计划的可行性
- [ ] 利益相关者的满意度