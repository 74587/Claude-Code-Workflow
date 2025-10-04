---
name: synthesis
description: Generate synthesis-specification.md from topic-framework and role analyses with @ references
usage: /workflow:brainstorm:synthesis
argument-hint: "no arguments required - synthesizes existing framework and role analyses"
examples:
  - /workflow:brainstorm:synthesis
allowed-tools: Read(*), Write(*), TodoWrite(*), Glob(*)
---

## 🧩 **Synthesis Document Generator**

### Core Function
**Specialized command for generating synthesis-specification.md** that integrates topic-framework.md and all role analysis.md files using @ reference system. Creates comprehensive implementation specification with cross-role insights.

### Primary Capabilities
- **Framework Integration**: Reference topic-framework.md discussion points across all roles
- **Role Analysis Integration**: Consolidate all role/analysis.md files using @ references
- **Cross-Framework Comparison**: Compare how each role addressed framework discussion points
- **@ Reference System**: Create structured references to source documents
- **Update Detection**: Smart updates when new role analyses are added

### Document Integration Model
**Three-Document Reference System**:
1. **topic-framework.md** → Structured discussion framework (input)
2. **[role]/analysis.md** → Role-specific analyses addressing framework (input)
3. **synthesis-specification.md** → Complete integrated specification (output)

## ⚙️ **Execution Protocol**

### ⚠️ Direct Execution by Main Claude
**Execution Model**: Main Claude directly executes this command without delegating to sub-agents.

**Rationale**:
- **Full Context Access**: Avoids context transmission loss that occurs with Task tool delegation
- **Complex Cognitive Analysis**: Leverages main Claude's complete reasoning capabilities for cross-role synthesis
- **Tool Usage**: Combines Read/Write/Glob tools with main Claude's analytical intelligence

**DO NOT use Task tool** - Main Claude performs intelligent analysis directly while reading/writing files, ensuring no information loss from context passing.

### Phase 1: Document Discovery & Validation
```bash
# Detect active brainstorming session
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    brainstorm_dir = .workflow/WFS-{session}/.brainstorming/
ELSE:
    ERROR: "No active brainstorming session found"
    EXIT

# Validate required documents
CHECK: brainstorm_dir/topic-framework.md
IF NOT EXISTS:
    ERROR: "topic-framework.md not found. Run /workflow:brainstorm:artifacts first"
    EXIT
```

### Phase 2: Role Analysis Discovery
```bash
# Discover available role analyses
SCAN_DIRECTORY: .workflow/WFS-{session}/.brainstorming/
FIND_ANALYSES: [
    */analysis.md files in role directories
]
LOAD_DOCUMENTS: {
    "topic_framework": topic-framework.md,
    "role_analyses": [discovered analysis.md files],
    "existing_synthesis": synthesis-specification.md (if exists)
}
```

### Phase 3: Update Mechanism Check
```bash
# Check for existing synthesis
IF synthesis-specification.md EXISTS:
    SHOW current synthesis summary to user
    ASK: "Synthesis exists. Do you want to:"
    OPTIONS:
      1. "Regenerate completely" → Create new synthesis
      2. "Update with new analyses" → Integrate new role analyses
      3. "Preserve existing" → Exit without changes
ELSE:
    CREATE new synthesis
```

### Phase 4: Synthesis Generation Process
Initialize synthesis task tracking:
```json
[
  {"content": "Validate topic-framework.md and role analyses availability", "status": "in_progress", "activeForm": "Validating source documents"},
  {"content": "Load topic framework discussion points structure", "status": "pending", "activeForm": "Loading framework structure"},
  {"content": "Cross-analyze role responses to each framework point", "status": "pending", "activeForm": "Cross-analyzing framework responses"},
  {"content": "Generate synthesis-specification.md with @ references", "status": "pending", "activeForm": "Generating synthesis with references"},
  {"content": "Update session metadata with synthesis completion", "status": "pending", "activeForm": "Updating session metadata"}
]
```

### Phase 4: Cross-Role Analysis Execution

#### 4.1 Data Collection and Preprocessing
```pseudo
FOR each role_directory in brainstorming_roles:
    IF role_directory exists:
        role_analysis = Read(role_directory + "/analysis.md")
        role_recommendations = Read(role_directory + "/recommendations.md") IF EXISTS
        role_insights[role] = extract_key_insights(role_analysis)
        role_recommendations[role] = extract_recommendations(role_analysis)
        role_concerns[role] = extract_concerns_risks(role_analysis)
    END IF
END FOR
```

#### 4.2 Cross-Role Insight Analysis
```pseudo
# Consensus identification
consensus_areas = identify_common_themes(role_insights)
agreement_matrix = create_agreement_matrix(role_recommendations)

# Disagreement analysis
disagreement_areas = identify_conflicting_views(role_insights)
tension_points = analyze_role_conflicts(role_recommendations)

# Innovation opportunity extraction
innovation_opportunities = extract_breakthrough_ideas(role_insights)
synergy_opportunities = identify_cross_role_synergies(role_insights)
```

#### 4.3 Priority and Decision Matrix Generation
```pseudo
# Create comprehensive evaluation matrix
FOR each recommendation:
    impact_score = calculate_business_impact(recommendation, role_insights)
    feasibility_score = calculate_technical_feasibility(recommendation, role_insights)
    effort_score = calculate_implementation_effort(recommendation, role_insights)
    risk_score = calculate_associated_risks(recommendation, role_insights)
    
    priority_score = weighted_score(impact_score, feasibility_score, effort_score, risk_score)
END FOR

SORT recommendations BY priority_score DESC
```

## 📊 **Output Specification**

### Output Location
The synthesis process creates **one consolidated document** that integrates all role perspectives:

```
.workflow/WFS-{topic-slug}/.brainstorming/
├── topic-framework.md          # Input: Framework structure
├── [role]/analysis.md          # Input: Role analyses (multiple)
└── synthesis-specification.md  # ★ OUTPUT: Complete integrated specification
```

#### synthesis-specification.md Structure (Complete Specification)

**Document Purpose**: Defines **"WHAT"** to build - comprehensive requirements and design blueprint.
**Scope**: High-level features, requirements, and design specifications. Does NOT include executable task breakdown (that's IMPL_PLAN.md's responsibility).

```markdown
# [Topic] - Integrated Implementation Specification

**Framework Reference**: @topic-framework.md | **Generated**: [timestamp] | **Session**: WFS-[topic-slug]
**Source Integration**: All brainstorming role perspectives consolidated
**Document Type**: Requirements & Design Specification (WHAT to build)

## Executive Summary
Strategic overview with key insights, breakthrough opportunities, and implementation priorities.

## Key Designs & Decisions
### Core Architecture Diagram
```mermaid
graph TD
    A[Component A] --> B[Component B]
    B --> C[Component C]
```
*Reference: @system-architect/analysis.md#architecture-diagram*

### User Journey Map
![User Journey](./assets/user-journey.png)
*Reference: @ux-expert/analysis.md#user-journey*

### Data Model Overview
```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
```
*Reference: @data-architect/analysis.md#data-model*

### Architecture Decision Records (ADRs)
**ADR-01: [Decision Title]**
- **Context**: Background and problem statement
- **Decision**: Chosen approach
- **Rationale**: Why this approach was selected
- **Reference**: @system-architect/analysis.md#adr-01

## Controversial Points & Alternatives
| Point | Adopted Solution | Alternative Solution(s) | Decision Rationale | Dissenting Roles |
|-------|------------------|-------------------------|--------------------| -----------------|
| Authentication | JWT Token (@security-expert) | Session-Cookie (@system-architect) | Stateless API support for multi-platform | System Architect noted session performance benefits |
| UI Framework | React (@ui-designer) | Vue.js (@subject-matter-expert) | Team expertise and ecosystem maturity | Subject Matter Expert preferred Vue for learning curve |

*This section preserves decision context and rejected alternatives for future reference.*

## Requirements & Acceptance Criteria
### Functional Requirements
| ID | Description | Rationale Summary | Source | Priority | Acceptance | Dependencies |
|----|-------------|-------------------|--------|----------|------------|--------------|
| FR-01 | User authentication | Enable secure multi-platform access | @product-manager/analysis.md | High | User can login via email/password | None |
| FR-02 | Data export | User-requested analytics feature | @product-owner/analysis.md | Medium | Export to CSV/JSON | FR-01 |

### Non-Functional Requirements
| ID | Description | Rationale Summary | Target | Validation | Source |
|----|-------------|-------------------|--------|------------|--------|
| NFR-01 | Response time | UX research shows <200ms critical | <200ms | Load testing | @ux-expert/analysis.md |
| NFR-02 | Data encryption | Compliance requirement | AES-256 | Security audit | @security-expert/analysis.md |

### Business Requirements
| ID | Description | Rationale Summary | Value | Success Metric | Source |
|----|-------------|-------------------|-------|----------------|--------|
| BR-01 | User retention | Market analysis shows engagement gap | High | 80% 30-day retention | @product-manager/analysis.md |
| BR-02 | Revenue growth | Business case justification | High | 25% MRR increase | @product-owner/analysis.md |

## Design Specifications
### UI/UX Guidelines
**Consolidated from**: @ui-designer/analysis.md, @ux-expert/analysis.md
- Component specifications and interaction patterns
- Visual design system and accessibility requirements
- User flow and interface specifications

### Architecture Design
**Consolidated from**: @system-architect/analysis.md, @data-architect/analysis.md
- System architecture and component interactions
- Data flow and storage strategy
- Technology stack decisions

### Domain Expertise & Standards
**Consolidated from**: @subject-matter-expert/analysis.md
- Industry standards and best practices
- Compliance requirements and regulations
- Technical quality and domain-specific patterns

## Implementation Roadmap (High-Level)
### Development Phases
**Phase 1** (0-3 months): Foundation and core features
**Phase 2** (3-6 months): Advanced features and integrations
**Phase 3** (6+ months): Optimization and innovation

### Technical Guidelines
- Development standards and code organization
- Testing strategy and quality assurance
- Deployment and monitoring approach

### Feature Grouping (Epic-Level)
- High-level feature grouping and prioritization
- Epic-level dependencies and sequencing
- Strategic milestones and release planning

**Note**: Detailed task breakdown into executable work items is handled by `/workflow:plan` → `IMPL_PLAN.md`

## Risk Assessment & Mitigation
### Critical Risks Identified
1. **Risk**: Description | **Mitigation**: Strategy
2. **Risk**: Description | **Mitigation**: Strategy

### Success Factors
- Key factors for implementation success
- Continuous monitoring requirements
- Quality gates and validation checkpoints

---
*Complete implementation specification consolidating all role perspectives into actionable guidance*
```

## 🔄 **Session Integration**

### Streamlined Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "completed",
      "synthesis_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["product-manager", "product-owner", "scrum-master", "system-architect", "ui-designer", "ux-expert", "data-architect", "subject-matter-expert", "test-strategist"],
      "consolidated_output": {
        "synthesis_specification": ".workflow/WFS-{topic}/.brainstorming/synthesis-specification.md"
      },
      "synthesis_quality": {
        "role_integration": "complete",
        "requirement_coverage": "comprehensive",
        "implementation_readiness": "ready"
      },
      "content_metrics": {
        "roles_synthesized": 9,
        "functional_requirements": 25,
        "non_functional_requirements": 12,
        "business_requirements": 8,
        "implementation_phases": 3,
        "risk_factors_identified": 8
      }
    }
  }
}
```

## ✅ **Quality Assurance**

### Required Synthesis Elements
- [ ] Integration of all available role analyses with comprehensive coverage
- [ ] Clear identification of consensus areas and disagreement points
- [ ] Quantified priority recommendation matrix with evaluation criteria
- [ ] Actionable implementation plan with phased approach
- [ ] Comprehensive risk assessment with mitigation strategies

### Synthesis Analysis Quality Standards
- [ ] **Completeness**: Integrates all available role analyses without gaps
- [ ] **Insight Generation**: Identifies cross-role patterns and deep insights
- [ ] **Actionability**: Provides specific, executable recommendations and next steps
- [ ] **Balance**: Considers all role perspectives and addresses concerns
- [ ] **Forward-Looking**: Includes long-term strategic and innovation considerations

### Output Validation Criteria
- [ ] **Priority-Based**: Recommendations prioritized using multi-dimensional evaluation
- [ ] **Resource-Aware**: Implementation plans consider resource and time constraints
- [ ] **Risk-Managed**: Comprehensive risk assessment with mitigation strategies
- [ ] **Measurable Success**: Clear success metrics and monitoring frameworks
- [ ] **Clear Actions**: Specific next steps with assigned responsibilities and timelines

### Integration Excellence Standards
- [ ] **Cross-Role Synthesis**: Successfully identifies and resolves role perspective conflicts
- [ ] **Strategic Coherence**: Recommendations form coherent strategic direction
- [ ] **Implementation Readiness**: Plans are detailed enough for immediate execution
- [ ] **Stakeholder Alignment**: Addresses needs and concerns of all key stakeholders
- [ ] **Continuous Improvement**: Establishes framework for ongoing optimization and learning