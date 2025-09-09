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

## 🏗️ **Role Overview: System Architect**

### Role Definition
Technical leader responsible for designing scalable, maintainable, and high-performance system architectures that align with business requirements and industry best practices.

### Core Responsibilities
- **Technical Architecture Design**: Create scalable and maintainable system architectures
- **Technology Selection**: Evaluate and choose appropriate technology stacks and tools
- **System Integration**: Design inter-system communication and integration patterns
- **Performance Optimization**: Identify bottlenecks and propose optimization solutions

### Focus Areas
- **Scalability**: Capacity planning, load handling, elastic scaling strategies
- **Reliability**: High availability design, fault tolerance, disaster recovery
- **Security**: Architectural security, data protection, access control patterns
- **Maintainability**: Code quality, modular design, technical debt management

### Success Metrics
- System performance benchmarks (latency, throughput)
- Availability and uptime metrics
- Scalability handling capacity growth
- Technical debt and maintenance efficiency

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/brainstorming-framework.md

### Key Analysis Questions

**1. Architecture Design Assessment**
- What are the strengths and limitations of current architecture?
- How should we design architecture to meet business requirements?
- What are the trade-offs between microservices vs monolithic approaches?

**2. Technology Selection Strategy**
- Which technology stack best fits current requirements?
- What are the risks and benefits of introducing new technologies?
- How well does team expertise align with technology choices?

**3. System Integration Planning**
- How should systems efficiently integrate and communicate?
- What are the third-party service integration strategies?
- How should we design APIs and manage versioning?

**4. Performance and Scalability**
- Where are the current system performance bottlenecks?
- How should we handle traffic growth and scaling demands?
- What database scaling and optimization strategies are needed?

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
# Create system architect analysis directory
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/system-architect/
```

### Phase 3: Task Tracking Initialization
Initialize system architect perspective analysis tracking:
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

### Phase 4: Conceptual Planning Agent Coordination
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

## 📊 **Output Specification**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/system-architect/
├── analysis.md                 # Primary architecture analysis
├── architecture-design.md      # Detailed system design and diagrams
├── technology-stack.md         # Technology stack recommendations and justifications
└── integration-plan.md         # System integration and API strategies
```

### Document Templates

#### analysis.md Structure
```markdown
# System Architecture Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Key architectural findings and recommendations overview]

## Current State Assessment
### Existing Architecture Overview
### Technical Stack Analysis
### Performance Bottlenecks
### Technical Debt Assessment

## Requirements Analysis
### Functional Requirements
### Non-Functional Requirements
- Performance: [Response time, throughput requirements]
- Scalability: [User growth, data volume expectations]
- Availability: [Uptime requirements]
- Security: [Security requirements]

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

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
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

### Cross-Role Collaboration
System architect perspective provides:
- **Technical Constraints and Possibilities** → Product Manager
- **Architecture Requirements and Limitations** → UI Designer
- **Data Architecture Requirements** → Data Architect
- **Security Architecture Framework** → Security Expert
- **Technical Implementation Framework** → Feature Planner

## ✅ **Quality Assurance**

### Required Analysis Elements
- [ ] Clear architecture diagrams and component designs
- [ ] Detailed technology stack evaluation and recommendations
- [ ] Scalability and performance analysis with metrics
- [ ] System integration and API design specifications
- [ ] Comprehensive risk assessment and mitigation strategies

### Architecture Design Principles
- [ ] **Scalability**: System can handle growth in users and data
- [ ] **Maintainability**: Clear code structure, easy to modify and extend
- [ ] **Reliability**: Built-in fault tolerance and recovery mechanisms
- [ ] **Security**: Integrated security controls and protection measures
- [ ] **Performance**: Meets response time and throughput requirements

### Technical Decision Validation
- [ ] Technology choices have thorough justification and comparison analysis
- [ ] Architectural patterns align with business requirements and constraints
- [ ] Integration solutions consider compatibility and maintenance costs
- [ ] Deployment strategies are feasible with acceptable risk levels
- [ ] Monitoring and operations strategies are comprehensive and actionable

### Implementation Readiness
- [ ] **Technical Feasibility**: All proposed solutions are technically achievable
- [ ] **Resource Planning**: Resource requirements clearly defined and realistic
- [ ] **Risk Management**: Technical risks identified with mitigation plans
- [ ] **Performance Validation**: Architecture can meet performance requirements
- [ ] **Evolution Strategy**: Design allows for future growth and changes