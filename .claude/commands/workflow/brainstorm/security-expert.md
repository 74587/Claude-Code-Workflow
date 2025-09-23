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
**Security Expert Perspective Questioning**

Before agent assignment, gather comprehensive security context:

#### 📋 Role-Specific Questions
1. **Threat Assessment & Attack Vectors**
   - Sensitive data types and classification levels?
   - Known threat actors and attack scenarios?
   - Current security vulnerabilities and concerns?

2. **Compliance & Regulatory Requirements**
   - Applicable compliance standards (GDPR, SOX, HIPAA)?
   - Industry-specific security requirements?
   - Audit and reporting obligations?

3. **Security Architecture & Controls**
   - Authentication and authorization needs?
   - Data encryption and protection requirements?
   - Network security and access control strategy?

4. **Incident Response & Monitoring**
   - Security monitoring and detection capabilities?
   - Incident response procedures and team readiness?
   - Business continuity and disaster recovery plans?

#### Context Validation
- **Minimum Response**: Each answer must be ≥50 characters
- **Re-prompting**: Insufficient detail triggers follow-up questions
- **Context Storage**: Save responses to `.brainstorming/security-expert-context.md`

### Step 2: Agent Assignment with Flow Control
**Dedicated Agent Execution**

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute dedicated security-expert conceptual analysis for: {topic}

ASSIGNED_ROLE: security-expert
OUTPUT_LOCATION: .brainstorming/security-expert/
USER_CONTEXT: {validated_responses_from_context_gathering}

Flow Control Steps:
[
  {
    \"step\": \"load_role_template\",
    \"action\": \"Load security-expert planning template\",
    \"command\": \"bash($(cat ~/.claude/workflows/cli-templates/planning-roles/security-expert.md))\",
    \"output_to\": \"role_template\"
  }
]

Conceptual Analysis Requirements:
- Apply security-expert perspective to topic analysis
- Focus on threat modeling, security architecture, and risk assessment
- Use loaded role template framework for analysis structure
- Generate role-specific deliverables in designated output location
- Address all user context from questioning phase

Deliverables:
- analysis.md: Main security analysis
- recommendations.md: Security recommendations
- deliverables/: Security-specific outputs as defined in role template

Embody security-expert role expertise for comprehensive conceptual planning."
```

### Progress Tracking
TodoWrite tracking for two-step process:
```json
[
  {"content": "Gather security expert context through role-specific questioning", "status": "in_progress", "activeForm": "Gathering context"},
  {"content": "Validate context responses and save to security-expert-context.md", "status": "pending", "activeForm": "Validating context"},
  {"content": "Load security-expert planning template via flow control", "status": "pending", "activeForm": "Loading template"},
  {"content": "Execute dedicated conceptual-planning-agent for security-expert role", "status": "pending", "activeForm": "Executing agent"}
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