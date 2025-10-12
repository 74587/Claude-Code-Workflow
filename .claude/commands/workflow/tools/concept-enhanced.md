---
name: concept-enhanced
description: Enhanced intelligent analysis with parallel CLI execution and design blueprint generation
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:concept-enhanced --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /workflow:tools:concept-enhanced --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Enhanced Analysis Command (/workflow:tools:concept-enhanced)

## Overview
Advanced solution design and feasibility analysis engine with parallel CLI execution. Processes standardized context packages to produce ANALYSIS_RESULTS.md focused on solution improvements, key design decisions, and critical insights.

**Scope**: Solution-focused technical analysis only. Does NOT generate task breakdowns or implementation plans.

**Usage**: Standalone command or integrated into `/workflow:plan`. Accepts context packages and orchestrates Gemini/Codex for comprehensive analysis.

## Core Philosophy & Responsibilities
- **Solution-Focused Analysis**: Emphasize design decisions, architectural rationale, and critical insights (exclude task planning)
- **Context-Driven**: Parse and validate context-package.json for precise analysis
- **Intelligent Tool Selection**: Gemini for design (all tasks), Codex for validation (complex tasks only)
- **Parallel Execution**: Execute multiple CLI tools simultaneously for efficiency
- **Solution Design**: Evaluate architecture, identify key design decisions with rationale
- **Feasibility Assessment**: Analyze technical complexity, risks, implementation readiness
- **Optimization Recommendations**: Performance, security, and code quality improvements
- **Perspective Synthesis**: Integrate multi-tool insights into unified assessment
- **Single Output**: Generate only ANALYSIS_RESULTS.md with technical analysis

## Analysis Strategy Selection

### Tool Selection by Task Complexity

**Simple Tasks (≤3 modules)**:
- **Primary**: Gemini (rapid understanding + pattern recognition)
- **Support**: Code-index (structural analysis)
- **Mode**: Single-round analysis

**Medium Tasks (4-6 modules)**:
- **Primary**: Gemini (comprehensive analysis + architecture design)
- **Support**: Code-index + Exa (best practices)
- **Mode**: Single comprehensive round

**Complex Tasks (>6 modules)**:
- **Primary**: Gemini (comprehensive analysis) + Codex (validation)
- **Mode**: Parallel execution - Gemini design + Codex feasibility

### Tool Preferences by Tech Stack

```json
{
  "frontend": {
    "primary": "gemini",
    "secondary": "codex",
    "focus": ["component_design", "state_management", "ui_patterns"]
  },
  "backend": {
    "primary": "codex",
    "secondary": "gemini",
    "focus": ["api_design", "data_flow", "security", "performance"]
  },
  "fullstack": {
    "primary": "gemini",
    "secondary": "codex",
    "focus": ["system_architecture", "integration", "data_consistency"]
  }
}
```

## Execution Lifecycle

### Phase 1: Validation & Preparation
1. **Session Validation**: Verify `.workflow/{session_id}/` exists, load `workflow-session.json`
2. **Context Package Validation**: Verify path, validate JSON format and structure
3. **Task Analysis**: Extract keywords, identify domain/complexity, determine scope
4. **Tool Selection**: Gemini (all tasks), +Codex (complex only), load templates

### Phase 2: Analysis Preparation
1. **Workspace Setup**: Create `.workflow/{session_id}/.process/`, initialize logs, set resource limits
2. **Context Optimization**: Filter high-priority assets, organize structure, prepare templates
3. **Execution Environment**: Configure CLI tools, set timeouts, prepare error handling

### Phase 3: Parallel Analysis Execution
1. **Gemini Solution Design & Architecture Analysis**
   ```bash
   ~/.claude/scripts/gemini-wrapper -p "
   PURPOSE: Analyze and design optimal solution for {task_description}
   TASK: Evaluate current architecture, propose solution design, identify key design decisions
   CONTEXT: @{.workflow/{session_id}/.process/context-package.json,.workflow/{session_id}/workflow-session.json,CLAUDE.md}

   **MANDATORY**: Read context-package.json to understand task requirements, source files, tech stack, project structure

   **ANALYSIS PRIORITY**:
   1. PRIMARY: Individual role analysis.md files (system-architect, ui-designer, etc.) - technical details, ADRs, decision context
   2. SECONDARY: synthesis-specification.md - integrated requirements, cross-role alignment
   3. REFERENCE: topic-framework.md - discussion context

   EXPECTED:
   1. CURRENT STATE: Existing patterns, code structure, integration points, technical debt
   2. SOLUTION DESIGN: Core principles, system design, key decisions with rationale
   3. CRITICAL INSIGHTS: Strengths, gaps, risks, tradeoffs
   4. OPTIMIZATION: Performance, security, code quality recommendations
   5. FEASIBILITY: Complexity analysis, compatibility, implementation readiness
   6. OUTPUT: Write to .workflow/{session_id}/.process/gemini-solution-design.md

   RULES:
   - Focus on SOLUTION IMPROVEMENTS and KEY DESIGN DECISIONS (NO task planning)
   - Identify code targets: existing "file:function:lines", new files "file"
   - Do NOT create task lists, implementation steps, or code examples
   " --approval-mode yolo
   ```
   Output: `.workflow/{session_id}/.process/gemini-solution-design.md`

2. **Codex Technical Feasibility Validation** (Complex Tasks Only)
   ```bash
   codex --full-auto exec "
   PURPOSE: Validate technical feasibility and identify implementation risks for {task_description}
   TASK: Assess complexity, validate technology choices, evaluate performance/security implications
   CONTEXT: @{.workflow/{session_id}/.process/context-package.json,.workflow/{session_id}/.process/gemini-solution-design.md,.workflow/{session_id}/workflow-session.json,CLAUDE.md}

   **MANDATORY**: Read context-package.json, gemini-solution-design.md, and relevant source files

   EXPECTED:
   1. FEASIBILITY: Complexity rating, resource requirements, technology compatibility
   2. RISK ANALYSIS: Implementation risks, integration challenges, performance/security concerns
   3. VALIDATION: Development approach, quality standards, maintenance implications
   4. RECOMMENDATIONS: Must-have requirements, optimization opportunities, security controls
   5. OUTPUT: Write to .workflow/{session_id}/.process/codex-feasibility-validation.md

   RULES:
   - Focus on TECHNICAL FEASIBILITY and RISK ASSESSMENT (NO implementation planning)
   - Verify code targets: existing "file:function:lines", new files "file"
   - Do NOT create task breakdowns, step-by-step guides, or code examples
   " --skip-git-repo-check -s danger-full-access
   ```
   Output: `.workflow/{session_id}/.process/codex-feasibility-validation.md`

3. **Parallel Execution**: Launch tools simultaneously, monitor progress, handle completion/errors, maintain logs

### Phase 4: Results Collection & Synthesis
1. **Output Validation**: Validate gemini-solution-design.md (all), codex-feasibility-validation.md (complex), use logs if incomplete, classify status
2. **Quality Assessment**: Verify design rationale, insight depth, feasibility rigor, optimization value
3. **Synthesis Strategy**: Direct integration (simple/medium), multi-tool synthesis (complex), resolve conflicts, score confidence

### Phase 5: ANALYSIS_RESULTS.md Generation
1. **Report Sections**: Executive Summary, Current State, Solution Design, Implementation Strategy, Optimization, Success Factors, Confidence Scores
2. **Guidelines**: Focus on solution improvements and design decisions (exclude task planning), emphasize rationale/tradeoffs/risk assessment
3. **Output**: Single file `ANALYSIS_RESULTS.md` at `.workflow/{session_id}/.process/` with technical insights and optimization strategies

## Analysis Results Format

Generated ANALYSIS_RESULTS.md focuses on **solution improvements, key design decisions, and critical insights** (NOT task planning):

```markdown
# Technical Analysis & Solution Design

## Executive Summary
- **Analysis Focus**: {core_problem_or_improvement_area}
- **Analysis Timestamp**: {timestamp}
- **Tools Used**: {analysis_tools}
- **Overall Assessment**: {feasibility_score}/5 - {recommendation_status}

---

## 1. Current State Analysis

### Architecture Overview
- **Existing Patterns**: {key_architectural_patterns}
- **Code Structure**: {current_codebase_organization}
- **Integration Points**: {system_integration_touchpoints}
- **Technical Debt Areas**: {identified_debt_with_impact}

### Compatibility & Dependencies
- **Framework Alignment**: {framework_compatibility_assessment}
- **Dependency Analysis**: {critical_dependencies_and_risks}
- **Migration Considerations**: {backward_compatibility_concerns}

### Critical Findings
- **Strengths**: {what_works_well}
- **Gaps**: {missing_capabilities_or_issues}
- **Risks**: {identified_technical_and_business_risks}

---

## 2. Proposed Solution Design

### Core Architecture Principles
- **Design Philosophy**: {key_design_principles}
- **Architectural Approach**: {chosen_architectural_pattern_with_rationale}
- **Scalability Strategy**: {how_solution_scales}

### System Design
- **Component Architecture**: {high_level_component_design}
- **Data Flow**: {data_flow_patterns_and_state_management}
- **API Design**: {interface_contracts_and_specifications}
- **Integration Strategy**: {how_components_integrate}

### Key Design Decisions
1. **Decision**: {critical_design_choice}
   - **Rationale**: {why_this_approach}
   - **Alternatives Considered**: {other_options_and_tradeoffs}
   - **Impact**: {implications_on_architecture}

2. **Decision**: {another_critical_choice}
   - **Rationale**: {reasoning}
   - **Alternatives Considered**: {tradeoffs}
   - **Impact**: {consequences}

### Technical Specifications
- **Technology Stack**: {chosen_technologies_with_justification}
- **Code Organization**: {module_structure_and_patterns}
- **Testing Strategy**: {testing_approach_and_coverage}
- **Performance Targets**: {performance_requirements_and_benchmarks}

---

## 3. Implementation Strategy

### Development Approach
- **Core Implementation Pattern**: {primary_implementation_strategy}
- **Module Dependencies**: {dependency_graph_and_order}
- **Quality Assurance**: {qa_approach_and_validation}

### Code Modification Targets
**Purpose**: Specific code locations for modification AND new files to create

**Identified Targets**:
1. **Target**: `src/auth/AuthService.ts:login:45-52`
   - **Type**: Modify existing
   - **Modification**: Enhance error handling
   - **Rationale**: Current logic lacks validation

2. **Target**: `src/auth/PasswordReset.ts`
   - **Type**: Create new file
   - **Purpose**: Password reset functionality
   - **Rationale**: New feature requirement

**Format Rules**:
- Existing files: `file:function:lines` (with line numbers)
- New files: `file` (no function or lines)
- Unknown lines: `file:function:*`
- Task generation will refine these targets during `analyze_task_patterns` step

### Feasibility Assessment
- **Technical Complexity**: {complexity_rating_and_analysis}
- **Performance Impact**: {expected_performance_characteristics}
- **Resource Requirements**: {development_resources_needed}
- **Maintenance Burden**: {ongoing_maintenance_considerations}

### Risk Mitigation
- **Technical Risks**: {implementation_risks_and_mitigation}
- **Integration Risks**: {compatibility_challenges_and_solutions}
- **Performance Risks**: {performance_concerns_and_strategies}
- **Security Risks**: {security_vulnerabilities_and_controls}

---

## 4. Solution Optimization

### Performance Optimization
- **Optimization Strategies**: {key_performance_improvements}
- **Caching Strategy**: {caching_approach_and_invalidation}
- **Resource Management**: {resource_utilization_optimization}
- **Bottleneck Mitigation**: {identified_bottlenecks_and_solutions}

### Security Enhancements
- **Security Model**: {authentication_authorization_approach}
- **Data Protection**: {data_security_and_encryption}
- **Vulnerability Mitigation**: {known_vulnerabilities_and_controls}
- **Compliance**: {regulatory_and_compliance_considerations}

### Code Quality
- **Code Standards**: {coding_conventions_and_patterns}
- **Testing Coverage**: {test_strategy_and_coverage_goals}
- **Documentation**: {documentation_requirements}
- **Maintainability**: {maintainability_practices}

---

## 5. Critical Success Factors

### Technical Requirements
- **Must Have**: {essential_technical_capabilities}
- **Should Have**: {important_but_not_critical_features}
- **Nice to Have**: {optional_enhancements}

### Quality Metrics
- **Performance Benchmarks**: {measurable_performance_targets}
- **Code Quality Standards**: {quality_metrics_and_thresholds}
- **Test Coverage Goals**: {testing_coverage_requirements}
- **Security Standards**: {security_compliance_requirements}

### Success Validation
- **Acceptance Criteria**: {how_to_validate_success}
- **Testing Strategy**: {validation_testing_approach}
- **Monitoring Plan**: {production_monitoring_strategy}
- **Rollback Plan**: {failure_recovery_strategy}

---

## 6. Analysis Confidence & Recommendations

### Assessment Scores
- **Conceptual Integrity**: {score}/5 - {brief_assessment}
- **Architectural Soundness**: {score}/5 - {brief_assessment}
- **Technical Feasibility**: {score}/5 - {brief_assessment}
- **Implementation Readiness**: {score}/5 - {brief_assessment}
- **Overall Confidence**: {overall_score}/5

### Final Recommendation
**Status**: {PROCEED|PROCEED_WITH_MODIFICATIONS|RECONSIDER|REJECT}

**Rationale**: {clear_explanation_of_recommendation}

**Critical Prerequisites**: {what_must_be_resolved_before_proceeding}

---

## 7. Reference Information

### Tool Analysis Summary
- **Gemini Insights**: {key_architectural_and_pattern_insights}
- **Codex Validation**: {technical_feasibility_and_implementation_notes}
- **Consensus Points**: {agreements_between_tools}
- **Conflicting Views**: {disagreements_and_resolution}

### Context & Resources
- **Analysis Context**: {context_package_reference}
- **Documentation References**: {relevant_documentation}
- **Related Patterns**: {similar_implementations_in_codebase}
- **External Resources**: {external_references_and_best_practices}
```

## Execution Management

### Error Handling & Recovery
1. **Pre-execution**: Verify session/context package, confirm CLI tools, validate dependencies
2. **Monitoring & Timeout**: Track progress, 30-min limit, manage parallel execution, maintain status
3. **Partial Recovery**: Generate results with incomplete outputs, use logs, provide next steps
4. **Error Recovery**: Auto error detection, structured workflows, graceful degradation

### Performance & Resource Optimization
- **Parallel Analysis**: Execute multiple tools simultaneously to reduce time
- **Context Sharding**: Analyze large projects by module shards
- **Caching**: Reuse results for similar contexts
- **Resource Management**: Monitor disk/CPU/memory, set limits, cleanup temporary files
- **Timeout Control**: `timeout 600s` with partial result generation on failure

## Integration & Success Criteria

### Input/Output Interface
**Input**:
- `--session` (required): Session ID (e.g., WFS-auth)
- `--context` (required): Context package path
- `--depth` (optional): Analysis depth (quick|full|deep)
- `--focus` (optional): Analysis focus areas

**Output**:
- Single file: `ANALYSIS_RESULTS.md` at `.workflow/{session_id}/.process/`
- No supplementary files (JSON, roadmap, templates)

### Quality & Success Validation
**Quality Checks**: Completeness, consistency, feasibility validation

**Success Criteria**:
- ✅ Solution-focused analysis (design decisions, critical insights, NO task planning)
- ✅ Single output file only
- ✅ Design decision depth with rationale/alternatives/tradeoffs
- ✅ Feasibility assessment (complexity, risks, readiness)
- ✅ Optimization strategies (performance, security, quality)
- ✅ Parallel execution efficiency (Gemini + Codex for complex tasks)
- ✅ Robust error handling (validation, timeout, partial recovery)
- ✅ Confidence scoring with clear recommendation status

## Related Commands
- `/context:gather` - Generate context packages required by this command
- `/workflow:plan` - Call this command for analysis
- `/task:create` - Create specific tasks based on analysis results