---
name: data-architect
description: Data architect perspective brainstorming for data modeling, flow, and analytics analysis
usage: /workflow:brainstorm:data-architect <topic>
argument-hint: "topic or challenge to analyze from data architecture perspective"
examples:
  - /workflow:brainstorm:data-architect "user analytics data pipeline"
  - /workflow:brainstorm:data-architect "real-time data processing system"
  - /workflow:brainstorm:data-architect "data warehouse modernization"
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
**Data Architect Perspective Questioning**

Before agent assignment, gather comprehensive data architect context:

#### 📋 Role-Specific Questions

**1. Data Models and Flow Patterns**
- What types of data will you be working with (structured, semi-structured, unstructured)?
- What are the expected data volumes and growth projections?
- What are the primary data sources and how frequently will data be updated?
- Are there existing data models or schemas that need to be considered?

**2. Storage Strategies and Performance**
- What are the query performance requirements and expected response times?
- Do you need real-time processing, batch processing, or both?
- What are the data retention and archival requirements?
- Are there specific compliance or regulatory requirements for data storage?

**3. Analytics Requirements and Insights**
- What types of analytics and reporting capabilities are needed?
- Who are the primary users of the data and what are their skill levels?
- What business intelligence or machine learning use cases need to be supported?
- Are there specific dashboard or visualization requirements?

**4. Data Governance and Quality**
- What data quality standards and validation rules need to be implemented?
- Who owns the data and what are the access control requirements?
- Are there data privacy or security concerns that need to be addressed?
- What data lineage and auditing capabilities are required?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/data-architect-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated data architect conceptual analysis for: {topic}

ASSIGNED_ROLE: data-architect
OUTPUT_LOCATION: .brainstorming/data-architect/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load data-architect planning template\",
    \"command\": \"bash($(cat ~/.claude/workflows/cli-templates/planning-roles/data-architect.md))\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply data architect perspective to topic analysis
- Focus on data models, flow patterns, storage strategies, and analytics requirements
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main data architect analysis
- recommendations.md: Data architect recommendations
- deliverables/: Data architect-specific outputs as defined in role template

Embody data architect role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather data architect context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to data-architect-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load data-architect planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for data-architect role", "status": "pending", "activeForm": "Executing agent"}
]
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