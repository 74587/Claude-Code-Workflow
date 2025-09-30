---
name: concept-enhanced
description: Enhanced intelligent analysis with parallel CLI execution and design blueprint generation
usage: /workflow:tools:concept-enhanced --session <session_id> --context <context_package_path>
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:concept-enhanced --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /workflow:tools:concept-enhanced --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Enhanced Analysis Command (/workflow:tools:concept-enhanced)

## Overview
Advanced solution design and feasibility analysis engine with parallel CLI execution that processes standardized context packages and produces comprehensive technical analysis focused on solution improvements, key design decisions, and critical insights.

**Analysis Focus**: Produces ANALYSIS_RESULTS.md with solution design, architectural rationale, feasibility assessment, and optimization strategies. Does NOT generate task breakdowns or implementation plans.

**Independent Usage**: This command can be called directly by users or as part of the `/workflow:plan` command. It accepts context packages and provides solution-focused technical analysis.

## Core Philosophy
- **Solution-Focused**: Emphasize design decisions, architectural rationale, and critical insights
- **Context-Driven**: Precise analysis based on comprehensive context packages
- **Intelligent Tool Selection**: Choose optimal tools based on task complexity (Gemini for design, Codex for validation)
- **Parallel Execution**: Execute multiple CLI tools simultaneously for efficiency
- **No Task Planning**: Exclude implementation steps, task breakdowns, and project planning
- **Single Output**: Generate only ANALYSIS_RESULTS.md with technical analysis

## Core Responsibilities
- **Context Package Parsing**: Read and validate context-package.json
- **Parallel CLI Orchestration**: Execute Gemini (solution design) and optionally Codex (feasibility validation)
- **Solution Design Analysis**: Evaluate architecture, identify key design decisions with rationale
- **Feasibility Assessment**: Analyze technical complexity, risks, and implementation readiness
- **Optimization Recommendations**: Propose performance, security, and code quality improvements
- **Perspective Synthesis**: Integrate Gemini and Codex insights into unified solution assessment
- **Technical Analysis Report**: Generate ANALYSIS_RESULTS.md focused on design decisions and critical insights (NO task planning)

## Analysis Strategy Selection

### Tool Selection by Task Complexity

**Simple Tasks (≤3 modules)**:
- **Primary Tool**: Gemini (rapid understanding and pattern recognition)
- **Support Tool**: Code-index (structural analysis)
- **Execution Mode**: Single-round analysis, focus on existing patterns

**Medium Tasks (4-6 modules)**:
- **Primary Tool**: Gemini (comprehensive single-round analysis and architecture design)
- **Support Tools**: Code-index + Exa (external best practices)
- **Execution Mode**: Single comprehensive analysis covering understanding + architecture design

**Complex Tasks (>6 modules)**:
- **Primary Tools**: Gemini (single comprehensive analysis) + Codex (implementation validation)
- **Analysis Strategy**: Gemini handles understanding + architecture in one round, Codex validates implementation
- **Execution Mode**: Parallel execution - Gemini comprehensive analysis + Codex validation

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
1. **Session Validation**
   - Verify session directory exists: `.workflow/{session_id}/`
   - Load session metadata from `workflow-session.json`
   - Validate session state and task context

2. **Context Package Validation**
   - Verify context package exists at specified path
   - Validate JSON format and structure
   - Assess context package size and complexity

3. **Task Analysis & Classification**
   - Parse task description and extract keywords
   - Identify technical domain and complexity level
   - Determine required analysis depth and scope
   - Load existing session context and task summaries

4. **Tool Selection Strategy**
   - **Simple/Medium Tasks**: Single Gemini comprehensive analysis
   - **Complex Tasks**: Gemini comprehensive + Codex validation
   - Load appropriate prompt templates and configurations

### Phase 2: Analysis Preparation
1. **Workspace Setup**
   - Create analysis output directory: `.workflow/{session_id}/.process/`
   - Initialize log files and monitoring structures
   - Set process limits and resource management

2. **Context Optimization**
   - Filter high-priority assets from context package
   - Organize project structure and dependencies
   - Prepare template references and rule configurations

3. **Execution Environment**
   - Configure CLI tools with write permissions
   - Set timeout parameters and monitoring intervals
   - Prepare error handling and recovery mechanisms

### Phase 3: Parallel Analysis Execution
1. **Gemini Solution Design & Architecture Analysis**
   - **Tool Configuration**:
     ```bash
     cd .workflow/{session_id}/.process && ~/.claude/scripts/gemini-wrapper -p "
     PURPOSE: Analyze and design optimal solution for {task_description}
     TASK: Evaluate current architecture, propose solution design, and identify key design decisions
     CONTEXT: {context_package_assets}
     EXPECTED:
     1. CURRENT STATE: Existing patterns, code structure, integration points, technical debt
     2. SOLUTION DESIGN: Core architecture principles, system design, key design decisions with rationale
     3. CRITICAL INSIGHTS: What works well, identified gaps, technical risks, architectural tradeoffs
     4. OPTIMIZATION STRATEGIES: Performance improvements, security enhancements, code quality recommendations
     5. FEASIBILITY ASSESSMENT: Complexity analysis, compatibility evaluation, implementation readiness
     6. Generate .workflow/{session_id}/.process/gemini-solution-design.md with complete analysis
     RULES: Focus on SOLUTION IMPROVEMENTS and KEY DESIGN DECISIONS, not task planning. Provide architectural rationale, evaluate alternatives, assess tradeoffs. Do NOT create task lists or implementation plans. Output ONLY ANALYSIS_RESULTS.md.
     " --approval-mode yolo
     ```
   - **Output Location**: `.workflow/{session_id}/.process/gemini-solution-design.md`

2. **Codex Technical Feasibility Validation** (Complex Tasks Only)
   - **Tool Configuration**:
     ```bash
     codex -C .workflow/{session_id}/.process --full-auto exec "
     PURPOSE: Validate technical feasibility and identify implementation risks for {task_description}
     TASK: Assess implementation complexity, validate technology choices, evaluate performance and security implications
     CONTEXT: {context_package_assets} and {gemini_solution_design}
     EXPECTED:
     1. FEASIBILITY ASSESSMENT: Technical complexity rating, resource requirements, technology compatibility
     2. RISK ANALYSIS: Implementation risks, integration challenges, performance concerns, security vulnerabilities
     3. TECHNICAL VALIDATION: Development approach validation, quality standards assessment, maintenance implications
     4. CRITICAL RECOMMENDATIONS: Must-have requirements, optimization opportunities, security controls
     5. Generate .workflow/{session_id}/.process/codex-feasibility-validation.md with validation results
     RULES: Focus on TECHNICAL FEASIBILITY and RISK ASSESSMENT, not implementation planning. Validate architectural decisions, identify potential issues, recommend optimizations. Do NOT create task breakdowns or step-by-step guides. Output ONLY feasibility analysis.
     " --skip-git-repo-check -s danger-full-access
     ```
   - **Output Location**: `.workflow/{session_id}/.process/codex-feasibility-validation.md`

3. **Parallel Execution Management**
   - Launch both tools simultaneously for complex tasks
   - Monitor execution progress with timeout controls
   - Handle process completion and error scenarios
   - Maintain execution logs for debugging and recovery

### Phase 4: Results Collection & Synthesis
1. **Output Validation & Collection**
   - **Gemini Results**: Validate `gemini-solution-design.md` contains complete solution analysis
   - **Codex Results**: For complex tasks, validate `codex-feasibility-validation.md` with technical assessment
   - **Fallback Processing**: Use execution logs if primary outputs are incomplete
   - **Status Classification**: Mark each tool as completed, partial, failed, or skipped

2. **Quality Assessment**
   - **Design Quality**: Verify architectural decisions have clear rationale and alternatives analysis
   - **Insight Depth**: Assess quality of critical insights and risk identification
   - **Feasibility Rigor**: Validate completeness of technical feasibility assessment
   - **Optimization Value**: Check actionability of optimization recommendations

3. **Analysis Synthesis Strategy**
   - **Simple/Medium Tasks**: Direct integration of Gemini solution design
   - **Complex Tasks**: Synthesis of Gemini design with Codex feasibility validation
   - **Conflict Resolution**: Identify architectural disagreements and provide balanced resolution
   - **Confidence Scoring**: Assess overall solution confidence based on multi-tool consensus

### Phase 5: ANALYSIS_RESULTS.md Generation
1. **Structured Report Assembly**
   - **Executive Summary**: Analysis focus, overall assessment, recommendation status
   - **Current State Analysis**: Architecture overview, compatibility, critical findings
   - **Proposed Solution Design**: Core principles, system design, key design decisions with rationale
   - **Implementation Strategy**: Development approach, feasibility assessment, risk mitigation
   - **Solution Optimization**: Performance, security, code quality recommendations
   - **Critical Success Factors**: Technical requirements, quality metrics, success validation
   - **Confidence & Recommendations**: Assessment scores, final recommendation with rationale

2. **Report Generation Guidelines**
   - **Focus**: Solution improvements, key design decisions, critical insights
   - **Exclude**: Task breakdowns, implementation steps, project planning
   - **Emphasize**: Architectural rationale, tradeoff analysis, risk assessment
   - **Structure**: Clear sections with decision justification and feasibility scoring

3. **Final Output**
   - **Primary Output**: `ANALYSIS_RESULTS.md` - comprehensive solution design and technical analysis
   - **Single File Policy**: Only generate ANALYSIS_RESULTS.md, no supplementary files
   - **Report Location**: `.workflow/{session_id}/.process/ANALYSIS_RESULTS.md`
   - **Content Focus**: Technical insights, design decisions, optimization strategies

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

## Error Handling & Fallbacks

### Error Handling & Recovery Strategies

1. **Pre-execution Validation**
   - **Session Verification**: Ensure session directory and metadata exist
   - **Context Package Validation**: Verify JSON format and content structure
   - **Tool Availability**: Confirm CLI tools are accessible and configured
   - **Prerequisite Checks**: Validate all required dependencies and permissions

2. **Execution Monitoring & Timeout Management**
   - **Progress Monitoring**: Track analysis execution with regular status checks
   - **Timeout Controls**: 30-minute execution limit with graceful termination
   - **Process Management**: Handle parallel tool execution and resource limits
   - **Status Tracking**: Maintain real-time execution state and completion status

3. **Partial Results Recovery**
   - **Fallback Strategy**: Generate analysis results even with incomplete outputs
   - **Log Integration**: Use execution logs when primary outputs are unavailable
   - **Recovery Mode**: Create partial analysis reports with available data
   - **Guidance Generation**: Provide next steps and retry recommendations

4. **Resource Management**
   - **Disk Space Monitoring**: Check available storage and cleanup temporary files
   - **Process Limits**: Set CPU and memory constraints for analysis execution
   - **Performance Optimization**: Manage resource utilization and system load
   - **Cleanup Procedures**: Remove outdated logs and temporary files

5. **Comprehensive Error Recovery**
   - **Error Detection**: Automatic error identification and classification
   - **Recovery Workflows**: Structured approach to handling different failure modes
   - **Status Reporting**: Clear communication of issues and resolution attempts
   - **Graceful Degradation**: Provide useful outputs even with partial failures

## Performance Optimization

### Analysis Optimization Strategies
- **Parallel Analysis**: Execute multiple tools in parallel to reduce total time
- **Context Sharding**: Analyze large projects by module shards
- **Caching Mechanism**: Reuse analysis results for similar contexts
- **Incremental Analysis**: Perform incremental analysis based on changes

### Resource Management
```bash
# Set analysis timeout
timeout 600s analysis_command || {
  echo "⚠️ Analysis timeout, generating partial results"
  # Generate partial results
}

# Memory usage monitoring
memory_usage=$(ps -o pid,vsz,rss,comm -p $$)
if [ "$memory_usage" -gt "$memory_limit" ]; then
  echo "⚠️ High memory usage detected, optimizing..."
fi
```

## Integration Points

### Input Interface
- **Required**: `--session` parameter specifying session ID (e.g., WFS-auth)
- **Required**: `--context` parameter specifying context package path
- **Optional**: `--depth` specify analysis depth (quick|full|deep)
- **Optional**: `--focus` specify analysis focus areas

### Output Interface
- **Primary**: ANALYSIS_RESULTS.md - solution design and technical analysis
- **Location**: .workflow/{session_id}/.process/ANALYSIS_RESULTS.md
- **Single Output Policy**: Only ANALYSIS_RESULTS.md is generated
- **No Supplementary Files**: No additional JSON, roadmap, or template files

## Quality Assurance

### Analysis Quality Checks
- **Completeness Check**: Ensure all required analysis sections are completed
- **Consistency Check**: Verify consistency of multi-tool analysis results
- **Feasibility Validation**: Ensure recommended implementation plans are feasible

### Success Criteria
- ✅ **Solution-Focused Analysis**: ANALYSIS_RESULTS.md emphasizes solution improvements, design decisions, and critical insights
- ✅ **Single Output File**: Only ANALYSIS_RESULTS.md generated, no supplementary files
- ✅ **Design Decision Depth**: Clear rationale for architectural choices with alternatives and tradeoffs
- ✅ **Feasibility Assessment**: Technical complexity, risk analysis, and implementation readiness evaluation
- ✅ **Optimization Strategies**: Performance, security, and code quality recommendations
- ✅ **Parallel Execution**: Efficient concurrent tool execution (Gemini + Codex for complex tasks)
- ✅ **Robust Error Handling**: Comprehensive validation, timeout management, and partial result recovery
- ✅ **Confidence Scoring**: Multi-dimensional assessment with clear recommendation status
- ✅ **No Task Planning**: Exclude task breakdowns, implementation steps, and project planning details

## Related Commands
- `/context:gather` - Generate context packages required by this command
- `/workflow:plan` - Call this command for analysis
- `/task:create` - Create specific tasks based on analysis results