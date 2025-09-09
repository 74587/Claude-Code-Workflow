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

## 📊 **Role Overview: Data Architect**

### Role Definition
Strategic data professional responsible for designing scalable, efficient data architectures that enable data-driven decision making through robust data models, processing pipelines, and analytics platforms.

### Core Responsibilities
- **Data Model Design**: Create efficient and scalable data models and schemas
- **Data Flow Design**: Plan data collection, processing, and storage workflows
- **Data Quality Management**: Ensure data accuracy, completeness, and consistency
- **Analytics and Insights**: Design data analysis and business intelligence solutions

### Focus Areas
- **Data Modeling**: Relational models, NoSQL, data warehouses, lakehouse architectures
- **Data Pipelines**: ETL/ELT processes, real-time processing, batch processing
- **Data Governance**: Data quality, security, privacy, compliance frameworks
- **Analytics Platforms**: BI tools, machine learning infrastructure, reporting systems

### Success Metrics
- Data quality and consistency metrics
- Processing performance and throughput
- Analytics accuracy and business impact
- Data governance and compliance adherence

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/conceptual-planning-agent.md

### Key Analysis Questions

**1. Data Requirements and Sources**
- What data is needed to support business decisions and analytics?
- How reliable and high-quality are the available data sources?
- What is the balance between real-time and historical data needs?

**2. Data Architecture and Storage**
- What is the most appropriate data storage solution for requirements?
- How should we design scalable and maintainable data models?
- What are the optimal data partitioning and indexing strategies?

**3. Data Processing and Workflows**
- What are the performance requirements for data processing?
- How should we design fault-tolerant and resilient data pipelines?
- What data versioning and change management strategies are needed?

**4. Analytics and Reporting**
- How can we support diverse analytical requirements and use cases?
- What balance between real-time dashboards and periodic reports is optimal?
- What self-service analytics and data visualization capabilities are needed?

## ⚙️ **Execution Protocol**

### Phase 1: Session Detection & Initialization
```bash
# Detect active workflow session
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    request_user_for_session_creation()
```

### Phase 2: Directory Structure Creation
```bash
# Create data architect analysis directory
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/data-architect/
```

### Phase 3: Task Tracking Initialization
Initialize data architect perspective analysis tracking:
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

### Phase 4: Conceptual Planning Agent Coordination
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
   - Define data collection requirements and constraints
   - Analyze data volume, velocity, and variety characteristics
   - Map data lineage and dependencies across systems

2. Data Model and Schema Design
   - Design logical and physical data models for optimal performance
   - Plan database schemas, indexes, and partitioning strategies
   - Design data relationships and referential integrity constraints
   - Plan for data archival, retention, and lifecycle management

3. Data Pipeline Architecture
   - Design ETL/ELT processes for data ingestion and transformation
   - Plan real-time and batch processing workflows
   - Design error handling, monitoring, and alerting mechanisms
   - Plan for data pipeline scalability and performance optimization

4. Data Quality and Governance
   - Establish data quality metrics and validation rules
   - Design data governance policies and procedures
   - Plan data security, privacy, and compliance frameworks
   - Create data cataloging and metadata management strategies

5. Analytics and Business Intelligence
   - Design data warehouse and data mart architectures
   - Plan for OLAP cubes, reporting, and dashboard requirements
   - Design self-service analytics and data exploration capabilities
   - Plan for machine learning and advanced analytics integration

6. Performance and Scalability Planning
   - Analyze current and projected data volumes and growth
   - Design horizontal and vertical scaling strategies
   - Plan for high availability and disaster recovery
   - Optimize query performance and resource utilization

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/data-architect/
- analysis.md (main data architecture analysis)
- data-model.md (data models, schemas, and relationships)
- pipeline-design.md (data processing and ETL/ELT workflows)
- governance-plan.md (data quality, security, and governance)

Apply data architecture expertise to create scalable, reliable, and insightful data solutions."
```

## 📊 **Output Specification**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/data-architect/
├── analysis.md                 # Primary data architecture analysis
├── data-model.md               # Data models, schemas, and relationships
├── pipeline-design.md          # Data processing and ETL/ELT workflows
└── governance-plan.md          # Data quality, security, and governance
```

### Document Templates

#### analysis.md Structure
```markdown
# Data Architect Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Key data architecture findings and recommendations overview]

## Current Data Landscape
### Existing Data Sources
### Current Data Architecture
### Data Quality Assessment
### Performance Bottlenecks

## Data Requirements Analysis
### Business Data Needs
### Technical Data Requirements
### Data Volume and Growth Projections
### Real-time vs Batch Processing Needs

## Proposed Data Architecture
### Data Model Design
### Storage Architecture
### Processing Pipeline Design
### Integration Patterns

## Data Quality and Governance
### Data Quality Framework
### Governance Policies
### Security and Privacy Controls
### Compliance Requirements

## Analytics and Reporting Strategy
### Business Intelligence Architecture
### Self-Service Analytics Design
### Performance Monitoring
### Scalability Planning

## Implementation Roadmap
### Migration Strategy
### Technology Stack Recommendations
### Resource Requirements
### Risk Mitigation Plan
```

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "data_architect": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/data-architect/",
        "key_insights": ["data_model_optimization", "pipeline_architecture", "analytics_strategy"]
      }
    }
  }
}
```

### Cross-Role Collaboration
Data architect perspective provides:
- **Data Storage Requirements** → System Architect
- **Analytics Data Requirements** → Product Manager
- **Data Visualization Specifications** → UI Designer
- **Data Security Framework** → Security Expert
- **Feature Data Requirements** → Feature Planner

## ✅ **Quality Assurance**

### Required Architecture Elements
- [ ] Comprehensive data model with clear relationships and constraints
- [ ] Scalable data pipeline design with error handling and monitoring
- [ ] Data quality framework with validation rules and metrics
- [ ] Governance plan addressing security, privacy, and compliance
- [ ] Analytics architecture supporting business intelligence needs

### Data Architecture Principles
- [ ] **Scalability**: Architecture can handle data volume and velocity growth
- [ ] **Quality**: Built-in data validation, cleansing, and quality monitoring
- [ ] **Security**: Data protection, access controls, and privacy compliance
- [ ] **Performance**: Optimized for query performance and processing efficiency
- [ ] **Maintainability**: Clear data lineage, documentation, and change management

### Implementation Validation
- [ ] **Technical Feasibility**: All proposed solutions are technically achievable
- [ ] **Performance Requirements**: Architecture meets processing and query performance needs
- [ ] **Cost Effectiveness**: Storage and processing costs are optimized and sustainable
- [ ] **Governance Compliance**: Meets regulatory and organizational data requirements
- [ ] **Future Readiness**: Design accommodates anticipated growth and changing needs

### Data Quality Standards
- [ ] **Accuracy**: Data validation rules ensure correctness and consistency
- [ ] **Completeness**: Strategies for handling missing data and ensuring coverage
- [ ] **Timeliness**: Data freshness requirements met through appropriate processing
- [ ] **Consistency**: Data definitions and formats standardized across systems
- [ ] **Lineage**: Complete data lineage tracking from source to consumption