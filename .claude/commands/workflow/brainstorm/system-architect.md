---
name: system-architect
description: System architect perspective brainstorming for technical architecture and scalability analysis
usage: /workflow:brainstorm:system-architect <topic>
argument-hint: "topic or challenge to analyze from system architecture perspective"
examples:
  - /workflow:brainstorm:system-architect "user authentication redesign"
  - /workflow:brainstorm:system-architect "microservices migration strategy"
  - /workflow:brainstorm:system-architect "system performance optimization"
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
**System Architect Perspective Questioning**

Before agent assignment, gather comprehensive system architecture context:

#### 📋 Role-Specific Questions
1. **Scale & Performance Requirements**
   - Expected user load and traffic patterns?
   - Performance requirements (latency, throughput)?
   - Data volume and growth projections?

2. **Technical Constraints & Environment**
   - Existing technology stack and constraints?
   - Integration requirements with external systems?
   - Infrastructure and deployment environment?

3. **Architecture Complexity & Patterns**
   - Microservices vs monolithic considerations?
   - Data consistency and transaction requirements?
   - Event-driven vs request-response patterns?

4. **Non-Functional Requirements**
   - High availability and disaster recovery needs?
   - Security and compliance requirements?
   - Monitoring and observability expectations?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/system-architect-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated system-architect conceptual analysis for: {topic}

ASSIGNED_ROLE: system-architect
OUTPUT_LOCATION: .brainstorming/system-architect/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load system-architect planning template\",
    \"command\": \"bash(~/.claude/scripts/planning-role-load.sh load system-architect)\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply system-architect perspective to topic analysis
- Focus on architectural patterns, scalability, and integration points
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main system architecture analysis
- recommendations.md: Architecture recommendations
- deliverables/: Architecture-specific outputs as defined in role template

Embody system-architect role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather system architect context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to system-architect-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load system-architect planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for system-architect role", "status": "pending", "activeForm": "Executing agent"}
]
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