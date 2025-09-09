---
name: synthesis
description: Synthesize all brainstorming role perspectives into comprehensive analysis and recommendations
usage: /workflow:brainstorm:synthesis
argument-hint: "no arguments required - analyzes existing brainstorming session outputs"
examples:
  - /workflow:brainstorm:synthesis
allowed-tools: Read(*), Write(*), TodoWrite(*), Glob(*)
---

## 🧩 **Command Overview: Brainstorm Synthesis**

### Core Function
Cross-role integration command that synthesizes all brainstorming role perspectives into comprehensive strategic analysis, actionable recommendations, and prioritized implementation roadmaps.

### Primary Capabilities
- **Cross-Role Integration**: Consolidate analysis results from all brainstorming role perspectives
- **Insight Synthesis**: Identify consensus areas, disagreement points, and breakthrough opportunities
- **Decision Support**: Generate prioritized recommendations and strategic action plans
- **Comprehensive Reporting**: Create integrated brainstorming summary reports with implementation guidance

### Analysis Scope Coverage
- **Product Management**: User needs, business value, market opportunities
- **System Architecture**: Technical design, technology selection, implementation feasibility
- **User Experience**: Interface design, usability, accessibility standards
- **Data Architecture**: Data models, processing workflows, analytics capabilities
- **Security Expert**: Threat assessment, security controls, compliance requirements
- **User Research**: Behavioral insights, needs validation, experience optimization
- **Business Analysis**: Process optimization, cost-benefit analysis, change management
- **Innovation Leadership**: Technology trends, innovation opportunities, future planning
- **Feature Planning**: Development planning, quality assurance, delivery management

## ⚙️ **Execution Protocol**

### Phase 1: Session Detection & Data Collection
```bash
# Detect active brainstorming session
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    ERROR: "No active brainstorming session found. Please run role-specific brainstorming commands first."
    EXIT
```

### Phase 2: Role Output Scanning
```bash
# Scan all role brainstorming outputs
SCAN_DIRECTORY: .workflow/WFS-{session}/.brainstorming/
COLLECT_OUTPUTS: [
    product-manager/analysis.md,
    system-architect/analysis.md,
    ui-designer/analysis.md,
    data-architect/analysis.md,
    security-expert/analysis.md,
    user-researcher/analysis.md,
    business-analyst/analysis.md,
    innovation-lead/analysis.md,
    feature-planner/analysis.md
]
```

### Phase 3: Task Tracking Initialization
Initialize synthesis analysis task tracking:
```json
[
  {"content": "Initialize brainstorming synthesis session", "status": "completed", "activeForm": "Initializing synthesis"},
  {"content": "Collect and analyze all role perspectives", "status": "in_progress", "activeForm": "Collecting role analyses"},
  {"content": "Identify cross-role insights and patterns", "status": "pending", "activeForm": "Identifying insights"},
  {"content": "Generate consensus and disagreement analysis", "status": "pending", "activeForm": "Analyzing consensus"},
  {"content": "Create prioritized recommendations matrix", "status": "pending", "activeForm": "Creating recommendations"},
  {"content": "Generate comprehensive synthesis report", "status": "pending", "activeForm": "Generating synthesis report"},
  {"content": "Create action plan with implementation priorities", "status": "pending", "activeForm": "Creating action plan"}
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
```
.workflow/WFS-{topic-slug}/.brainstorming/
├── synthesis-report.md          # Comprehensive synthesis analysis report
├── recommendations-matrix.md    # Priority recommendation matrix
├── action-plan.md              # Implementation action plan
├── consensus-analysis.md       # Consensus and disagreement analysis
└── brainstorm-summary.json     # Machine-readable synthesis data
```

### Core Output Documents

#### synthesis-report.md Structure
```markdown
# Brainstorming Synthesis Report: {Topic}
*Generated: {timestamp} | Session: WFS-{topic-slug}*

## Executive Summary
### Key Findings Overview
### Strategic Recommendations
### Implementation Priority
### Success Metrics

## Participating Perspectives Analysis
### Roles Analyzed: {list_of_completed_roles}
### Coverage Assessment: {completeness_percentage}%
### Analysis Quality Score: {quality_assessment}

## Cross-Role Insights Synthesis

### 🤝 Consensus Areas
**Strong Agreement (3+ roles)**:
1. **{consensus_theme_1}**
   - Supporting roles: {role1, role2, role3}
   - Key insight: {shared_understanding}
   - Business impact: {impact_assessment}

2. **{consensus_theme_2}**
   - Supporting roles: {role1, role2, role4}
   - Key insight: {shared_understanding}
   - Business impact: {impact_assessment}

### ⚡ Breakthrough Ideas
**Innovation Opportunities**:
1. **{breakthrough_idea_1}**
   - Origin: {source_role}
   - Cross-role support: {supporting_roles}
   - Innovation potential: {potential_assessment}

2. **{breakthrough_idea_2}**
   - Origin: {source_role}
   - Cross-role support: {supporting_roles}
   - Innovation potential: {potential_assessment}

### 🔄 Areas of Disagreement
**Tension Points Requiring Resolution**:
1. **{disagreement_area_1}**
   - Conflicting views: {role1_view} vs {role2_view}
   - Root cause: {underlying_issue}
   - Resolution approach: {recommended_resolution}

2. **{disagreement_area_2}**
   - Conflicting views: {role1_view} vs {role2_view}
   - Root cause: {underlying_issue}
   - Resolution approach: {recommended_resolution}

## Comprehensive Recommendations Matrix

### 🎯 High Priority (Immediate Action)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_1}        | High           | High                 | Medium              | Low        | PM, Arch, UX     |
| {rec_2}        | High           | Medium               | Low                 | Medium     | BA, PM, FP       |

### 📋 Medium Priority (Strategic Planning)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_3}        | Medium         | High                 | High                | Medium     | Arch, DA, Sec    |
| {rec_4}        | Medium         | Medium               | Medium              | Low        | UX, UR, PM       |

### 🔬 Research Priority (Future Investigation)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_5}        | High           | Unknown              | High                | High       | IL, Arch, PM     |
| {rec_6}        | Medium         | Low                  | High                | High       | IL, DA, Sec      |

## Implementation Strategy

### Phase 1: Foundation (0-3 months)
- **Focus**: High-priority, low-effort recommendations
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

### Phase 2: Development (3-9 months)
- **Focus**: Medium-priority strategic initiatives
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

### Phase 3: Innovation (9+ months)
- **Focus**: Research and breakthrough opportunities
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

## Risk Assessment and Mitigation

### Critical Risks Identified
1. **{risk_1}**: {description} | Mitigation: {strategy}
2. **{risk_2}**: {description} | Mitigation: {strategy}

### Success Factors
- {success_factor_1}
- {success_factor_2}
- {success_factor_3}

## Next Steps and Follow-up
### Immediate Actions Required
### Decision Points Needing Resolution
### Continuous Monitoring Requirements
### Future Brainstorming Sessions Recommended

---
*This synthesis integrates insights from {role_count} perspectives to provide comprehensive strategic guidance.*
```

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "completed",
      "synthesis_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["product-manager", "system-architect", "ui-designer", ...],
      "key_outputs": {
        "synthesis_report": ".workflow/WFS-{topic}/.brainstorming/synthesis-report.md",
        "action_plan": ".workflow/WFS-{topic}/.brainstorming/action-plan.md",
        "recommendations_matrix": ".workflow/WFS-{topic}/.brainstorming/recommendations-matrix.md"
      },
      "metrics": {
        "roles_analyzed": 9,
        "consensus_areas": 5,
        "breakthrough_ideas": 3,
        "high_priority_recommendations": 8,
        "implementation_phases": 3
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