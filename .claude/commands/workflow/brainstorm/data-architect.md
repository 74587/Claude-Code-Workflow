---
name: brainstorm:data-architect
description: Data architect perspective brainstorming for data modeling, flow, and analytics analysis
usage: /brainstorm:data-architect <topic>
argument-hint: "topic or challenge to analyze from data architecture perspective"
examples:
  - /brainstorm:data-architect "user analytics data pipeline"
  - /brainstorm:data-architect "real-time data processing system"
  - /brainstorm:data-architect "data warehouse modernization"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 📊 **角色定义: Data Architect**

### 核心职责
- **数据模型设计**: 设计高效、可扩展的数据模型
- **数据流程设计**: 规划数据采集、处理、存储流程
- **数据质量管理**: 确保数据准确性、完整性、一致性
- **分析和洞察**: 设计数据分析和商业智能解决方案

### 关注领域
- **数据建模**: 关系模型、NoSQL、数据仓库、湖仓一体
- **数据管道**: ETL/ELT流程、实时处理、批处理
- **数据治理**: 数据质量、安全、隐私、合规
- **分析平台**: BI工具、机器学习、报表系统

## 🧠 **分析框架**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### 核心分析问题
1. **数据需求和来源**:
   - 需要哪些数据来支持业务决策？
   - 数据来源的可靠性和质量如何？
   - 实时数据vs历史数据的需求平衡？

2. **数据架构和存储**:
   - 最适合的数据存储方案是什么？
   - 如何设计可扩展的数据模型？
   - 数据分区和索引策略？

3. **数据处理和流程**:
   - 数据处理的性能要求？
   - 如何设计容错的数据管道？
   - 数据变更和版本控制策略？

4. **分析和报告**:
   - 如何支持不同的分析需求？
   - 实时仪表板vs定期报告？
   - 数据可视化和自助分析能力？

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
# 创建数据架构师分析目录
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/data-architect/
```

### Phase 3: TodoWrite 初始化
设置数据架构师视角分析的任务跟踪：
```json
[
  {"content": "Initialize data architect brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze data requirements and sources", "status": "in_progress", "activeForm": "Analyzing data requirements"},
  {"content": "Design optimal data model and schema", "status": "pending", "activeForm": "Designing data model"},
  {"content": "Plan data pipeline and processing workflows", "status": "pending", "activeForm": "Planning data pipelines"},
  {"content": "Evaluate data quality and governance", "status": "pending", "activeForm": "Evaluating data governance"},
  {"content": "Design analytics and reporting solutions", "status": "pending", "activeForm": "Designing analytics"},
  {"content": "Generate comprehensive data architecture documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: 概念规划代理协调
```bash
Task(conceptual-planning-agent): "
Conduct data architect perspective brainstorming for: {topic}

ROLE CONTEXT: Data Architect
- Focus Areas: Data modeling, data flow, storage optimization, analytics infrastructure
- Analysis Framework: Data-driven approach with emphasis on scalability, quality, and insights
- Success Metrics: Data quality, processing efficiency, analytics accuracy, scalability

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Data Requirements Analysis
   - Identify all data sources (internal, external, third-party)
   - Analyze data types, volumes, and velocity requirements
   - Define data freshness and latency requirements
   - Assess data quality and completeness standards

2. Data Architecture Design
   - Design logical and physical data models
   - Plan data storage strategy (relational, NoSQL, data lake, warehouse)
   - Design data partitioning and sharding strategies
   - Plan for data archival and retention policies

3. Data Pipeline and Processing
   - Design ETL/ELT processes and data transformation workflows
   - Plan real-time vs batch processing requirements
   - Design error handling and data recovery mechanisms
   - Plan for data lineage and audit trails

4. Data Quality and Governance
   - Design data validation and quality monitoring
   - Plan data governance framework and policies
   - Assess privacy and compliance requirements (GDPR, CCPA, etc.)
   - Design data access controls and security measures

5. Analytics and Reporting Infrastructure
   - Design data warehouse/data mart architecture
   - Plan business intelligence and reporting solutions
   - Design self-service analytics capabilities
   - Plan for machine learning and advanced analytics integration

6. Performance and Scalability
   - Analyze current and projected data volumes
   - Design indexing and query optimization strategies
   - Plan horizontal and vertical scaling approaches
   - Design monitoring and alerting for data systems

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/data-architect/
- analysis.md (main data architecture analysis)
- data-model.md (detailed data models and schemas)
- pipeline-design.md (data processing workflows and ETL design)
- governance-plan.md (data quality, security, and compliance framework)

Apply data architecture expertise to create scalable, reliable, and insightful data solutions."
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/data-architect/
├── analysis.md                 # 主要数据架构分析
├── data-model.md               # 详细数据模型和架构
├── pipeline-design.md          # 数据处理工作流和ETL设计
└── governance-plan.md          # 数据质量、安全和合规框架
```

### 文档模板

#### analysis.md 结构
```markdown
# Data Architect Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[核心数据架构发现和建议概述]

## Current Data Landscape Assessment
### Existing Data Sources
### Data Quality Issues
### Performance Bottlenecks
### Integration Challenges

## Data Requirements Analysis
### Business Data Requirements
### Technical Data Requirements
- Volume: [预期数据量和增长]
- Velocity: [数据更新频率]
- Variety: [数据类型和格式]
- Veracity: [数据质量要求]

## Proposed Data Architecture
### Data Storage Strategy
### Data Model Design
### Integration Architecture
### Analytics Infrastructure

## Data Pipeline Design
### Data Ingestion Strategy
### Processing Workflows
### Transformation Rules
### Quality Assurance

## Governance and Compliance
### Data Quality Framework
### Security and Privacy
### Audit and Lineage
### Compliance Requirements

## Performance and Scalability
### Optimization Strategies
### Scaling Plans
### Monitoring and Alerting
### Disaster Recovery
```

## 🔄 **会话集成**

### 状态同步
分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "data_architect": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/data-architect/",
        "key_insights": ["data_model_optimization", "pipeline_efficiency", "governance_requirement"]
      }
    }
  }
}
```

### 与其他角色的协作
数据架构师视角为其他角色提供：
- **数据能力和限制** → Product Manager
- **数据存储要求** → System Architect
- **数据展示能力** → UI Designer
- **数据安全要求** → Security Expert
- **功能数据支持** → Feature Planner

## ✅ **质量标准**

### 必须包含的架构元素
- [ ] 完整的数据模型设计
- [ ] 详细的数据流程图
- [ ] 数据质量保证方案
- [ ] 可扩展性和性能优化
- [ ] 合规和安全控制

### 数据架构原则检查
- [ ] 可扩展性：支持数据量和用户增长
- [ ] 可靠性：具有容错和恢复机制
- [ ] 可维护性：清晰的数据模型和流程
- [ ] 安全性：数据保护和访问控制
- [ ] 高效性：优化的查询和处理性能

### 数据质量指标
- [ ] 数据准确性和完整性标准
- [ ] 数据一致性检查机制
- [ ] 数据时效性和新鲜度要求
- [ ] 数据可追溯性和审计能力
- [ ] 合规性检查和报告机制