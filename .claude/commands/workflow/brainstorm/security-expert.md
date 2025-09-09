---
name: security-expert
description: Security expert perspective brainstorming for threat modeling and security architecture analysis
usage: /workflow:brainstorm:security-expert <topic>
argument-hint: "topic or challenge to analyze from cybersecurity perspective"
examples:
  - /workflow:brainstorm:security-expert "user authentication security review"
  - /workflow:brainstorm:security-expert "API security architecture"
  - /workflow:brainstorm:security-expert "data protection compliance strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🔒 **Role Overview: Security Expert**

### Role Definition
Cybersecurity specialist focused on identifying threats, designing security controls, and ensuring comprehensive protection of systems, data, and users through proactive security architecture and risk management.

### Core Responsibilities
- **Threat Modeling**: Identify and analyze potential security threats and attack vectors
- **Security Architecture**: Design robust security controls and defensive measures
- **Risk Assessment**: Evaluate security risks and develop mitigation strategies
- **Compliance Management**: Ensure adherence to security standards and regulations

### Focus Areas
- **Application Security**: Code security, input validation, authentication, authorization
- **Infrastructure Security**: Network security, system hardening, access controls
- **Data Protection**: Encryption, privacy controls, data classification, compliance
- **Operational Security**: Monitoring, incident response, security awareness, procedures

### Success Metrics
- Vulnerability reduction and remediation rates
- Security incident prevention and response times
- Compliance audit results and regulatory adherence
- Security awareness and training effectiveness

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/brainstorming-framework.md

### Key Analysis Questions

**1. Threat Landscape Assessment**
- What are the primary threat vectors and attack scenarios?
- Who are the potential threat actors and what are their motivations?
- What are the current vulnerabilities and exposure risks?

**2. Security Architecture Design**
- What security controls and defensive measures are needed?
- How should we implement defense-in-depth strategies?
- What authentication and authorization mechanisms are appropriate?

**3. Risk Management and Compliance**
- What are the regulatory and compliance requirements?
- How should we prioritize and manage identified security risks?
- What security policies and procedures need to be established?

**4. Implementation and Operations**
- How should we integrate security into development and operations?
- What monitoring and detection capabilities are required?
- How should we plan for incident response and recovery?

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
# Create security expert analysis directory
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/security-expert/
```

### Phase 3: Task Tracking Initialization
Initialize security expert perspective analysis tracking:
```json
[
  {"content": "Initialize security expert brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Conduct threat modeling and risk assessment", "status": "in_progress", "activeForm": "Conducting threat modeling"},
  {"content": "Design security architecture and controls", "status": "pending", "activeForm": "Designing security architecture"},
  {"content": "Evaluate compliance and regulatory requirements", "status": "pending", "activeForm": "Evaluating compliance"},
  {"content": "Plan security implementation and integration", "status": "pending", "activeForm": "Planning implementation"},
  {"content": "Design monitoring and incident response", "status": "pending", "activeForm": "Designing monitoring"},
  {"content": "Generate comprehensive security documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: Conceptual Planning Agent Coordination
```bash
Task(conceptual-planning-agent): "
Conduct security expert perspective brainstorming for: {topic}

ROLE CONTEXT: Security Expert
- Focus Areas: Threat modeling, security architecture, risk management, compliance
- Analysis Framework: Security-first approach with emphasis on defense-in-depth and risk mitigation
- Success Metrics: Vulnerability reduction, incident prevention, compliance adherence, security maturity

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. Threat Modeling and Risk Assessment
   - Identify potential threat actors and their capabilities
   - Map attack vectors and potential attack paths
   - Analyze system vulnerabilities and exposure points
   - Assess business impact and likelihood of security incidents

2. Security Architecture Design
   - Design authentication and authorization mechanisms
   - Plan encryption and data protection strategies
   - Design network security and access controls
   - Plan security monitoring and logging architecture

3. Application Security Analysis
   - Review secure coding practices and input validation
   - Analyze session management and state security
   - Assess API security and integration points
   - Plan for secure software development lifecycle

4. Infrastructure and Operations Security
   - Design system hardening and configuration management
   - Plan security monitoring and SIEM integration
   - Design incident response and recovery procedures
   - Plan security awareness and training programs

5. Compliance and Regulatory Analysis
   - Identify applicable compliance frameworks (GDPR, SOX, PCI-DSS, etc.)
   - Map security controls to regulatory requirements
   - Plan compliance monitoring and audit procedures
   - Design privacy protection and data handling policies

6. Security Implementation Planning
   - Prioritize security controls based on risk assessment
   - Plan phased security implementation approach
   - Design security testing and validation procedures
   - Plan ongoing security maintenance and updates

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/security-expert/
- analysis.md (main security analysis and threat model)
- security-architecture.md (security controls and defensive measures)
- compliance-plan.md (regulatory compliance and policy framework)
- implementation-guide.md (security implementation and operational procedures)

Apply cybersecurity expertise to create comprehensive security solutions that protect against threats while enabling business objectives."
```

## 📊 **Output Specification**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/security-expert/
├── analysis.md                 # Primary security analysis and threat modeling
├── security-architecture.md    # Security controls and defensive measures
├── compliance-plan.md          # Regulatory compliance and policy framework
└── implementation-guide.md     # Security implementation and operational procedures
```

### Document Templates

#### analysis.md Structure
```markdown
# Security Expert Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Key security findings and recommendations overview]

## Threat Landscape Assessment
### Threat Actor Analysis
### Attack Vector Identification
### Vulnerability Assessment
### Risk Prioritization Matrix

## Security Requirements Analysis
### Functional Security Requirements
### Compliance and Regulatory Requirements
### Business Continuity Requirements
### Privacy and Data Protection Needs

## Security Architecture Design
### Authentication and Authorization Framework
### Data Protection and Encryption Strategy
### Network Security and Access Controls
### Monitoring and Detection Capabilities

## Risk Management Strategy
### Risk Assessment Methodology
### Risk Mitigation Controls
### Residual Risk Acceptance Criteria
### Continuous Risk Monitoring Plan

## Implementation Security Plan
### Security Control Implementation Priorities
### Security Testing and Validation Approach
### Incident Response and Recovery Procedures
### Security Awareness and Training Program

## Compliance and Governance
### Regulatory Compliance Framework
### Security Policy and Procedure Requirements
### Audit and Assessment Planning
### Governance and Oversight Structure
```

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "security_expert": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/security-expert/",
        "key_insights": ["threat_model", "security_controls", "compliance_requirements"]
      }
    }
  }
}
```

### Cross-Role Collaboration
Security expert perspective provides:
- **Security Architecture Requirements** → System Architect
- **Security Compliance Constraints** → Product Manager
- **Secure Interface Design Requirements** → UI Designer
- **Data Protection Requirements** → Data Architect
- **Security Feature Specifications** → Feature Planner

## ✅ **Quality Assurance**

### Required Security Elements
- [ ] Comprehensive threat model with identified attack vectors and mitigations
- [ ] Security architecture design with layered defensive controls
- [ ] Risk assessment with prioritized mitigation strategies
- [ ] Compliance framework addressing all relevant regulatory requirements
- [ ] Implementation plan with security testing and validation procedures

### Security Architecture Principles
- [ ] **Defense-in-Depth**: Multiple layers of security controls and protective measures
- [ ] **Least Privilege**: Minimal access rights granted based on need-to-know basis
- [ ] **Zero Trust**: Verify and validate all access requests regardless of location
- [ ] **Security by Design**: Security considerations integrated from initial design phase
- [ ] **Fail Secure**: System failures default to secure state with controlled recovery

### Risk Management Standards
- [ ] **Threat Coverage**: All identified threats have corresponding mitigation controls
- [ ] **Risk Tolerance**: Security risks align with organizational risk appetite
- [ ] **Continuous Monitoring**: Ongoing security monitoring and threat detection capabilities
- [ ] **Incident Response**: Comprehensive incident response and recovery procedures
- [ ] **Compliance Adherence**: Full compliance with applicable regulatory frameworks

### Implementation Readiness
- [ ] **Control Effectiveness**: Security controls are tested and validated for effectiveness
- [ ] **Integration Planning**: Security solutions integrate with existing infrastructure
- [ ] **Operational Procedures**: Clear procedures for security operations and maintenance
- [ ] **Training and Awareness**: Security awareness programs for all stakeholders
- [ ] **Continuous Improvement**: Framework for ongoing security assessment and enhancement