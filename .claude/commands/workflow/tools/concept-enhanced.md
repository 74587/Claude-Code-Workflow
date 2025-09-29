---
name: plan-enchanced
description: Enhanced intelligent analysis with parallel CLI execution and design blueprint generation
usage: /workflow:tools:concept-enhanced --session <session_id> --context <context_package_path>
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /workflow:tools:concept-enhanced --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /workflow:tools:concept-enhanced --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Enhanced Planning Command (/workflow:tools:concept-enhanced)

## Overview
Advanced intelligent planning engine with parallel CLI execution that processes standardized context packages, generates enhanced suggestions and design blueprints, and produces comprehensive analysis results with implementation strategies.

## Core Philosophy
- **Context-Driven**: Precise analysis based on comprehensive context
- **Intelligent Tool Selection**: Choose optimal analysis tools based on task characteristics
- **Parallel Execution**: Execute multiple CLI tools simultaneously for efficiency
- **Enhanced Suggestions**: Generate actionable recommendations and design blueprints
- **Write-Enabled**: Tools have full write permissions for implementation suggestions
- **Structured Output**: Generate standardized analysis reports with implementation roadmaps

## Core Responsibilities
- **Context Package Parsing**: Read and validate context-package.json
- **Parallel CLI Orchestration**: Execute multiple analysis tools simultaneously with write permissions
- **Enhanced Suggestions Generation**: Create actionable recommendations and design blueprints
- **Design Blueprint Creation**: Generate comprehensive technical implementation designs
- **Perspective Synthesis**: Collect and organize different tool viewpoints
- **Consensus Analysis**: Identify agreements and conflicts between tools
- **Summary Report Generation**: Output comprehensive ANALYSIS_RESULTS.md with implementation strategies

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
1. **Gemini Comprehensive Analysis & Documentation**
   - **Tool Configuration**:
     ```bash
     cd .workflow/{session_id}/.process && ~/.claude/scripts/gemini-wrapper -p "
     PURPOSE: Generate comprehensive analysis and documentation for {task_description}
     TASK: Analyze codebase, create implementation blueprints, and generate supporting documentation
     CONTEXT: {context_package_assets}
     EXPECTED:
     1. Current State Analysis: Architecture patterns, code quality, technical debt, performance bottlenecks
     2. Enhanced Suggestions: Implementation blueprints, code organization, API specifications, security guidelines
     3. Implementation Roadmap: Phase-by-phase plans, CI/CD blueprints, testing strategies
     4. Actionable Examples: Code templates, configuration scripts, integration patterns
     5. Documentation Generation: Technical documentation, API docs, user guides, and README files
     6. Generate .workflow/{session_id}/.process/gemini-enhanced-analysis.md with all analysis results
     RULES: Create both analysis blueprints AND user-facing documentation. Generate actual documentation files, not just analysis of documentation needs. Focus on planning documents, architectural designs, and specifications - do NOT generate specific code implementations.
     " --approval-mode yolo
     ```
   - **Output Location**: `.workflow/{session_id}/.process/gemini-enhanced-analysis.md` + generated docs

2. **Codex Implementation Validation** (Complex Tasks Only)
   - **Tool Configuration**:
     ```bash
     codex -C .workflow/{session_id}/.process --full-auto exec "
     PURPOSE: Technical feasibility validation with write-enabled blueprint generation
     TASK: Validate implementation feasibility and generate comprehensive blueprints
     CONTEXT: {context_package_assets} and {gemini_analysis_results}
     EXPECTED:
     1. Feasibility Assessment: Complexity analysis, resource requirements, technology compatibility
     2. Implementation Validation: Quality recommendations, security assessments, testing frameworks
     3. Implementation Guides: Step-by-step procedures, configuration management, monitoring setup
     4. Generate .workflow/{session_id}/.process/codex-validation-analysis.md with all validation results
     RULES: Focus on technical validation, security assessments, and implementation planning examples. Create comprehensive validation documentation with architectural guidance and specifications - do NOT generate specific code implementations.
     " --skip-git-repo-check -s danger-full-access
     ```
   - **Output Location**: `.workflow/{session_id}/.process/codex-validation-analysis.md`

3. **Parallel Execution Management**
   - Launch both tools simultaneously for complex tasks
   - Monitor execution progress with timeout controls
   - Handle process completion and error scenarios
   - Maintain execution logs for debugging and recovery

### Phase 4: Results Collection & Validation
1. **Output Validation & Collection**
   - **Gemini Results**: Validate `gemini-enhanced-analysis.md` exists and contains complete analysis
   - **Codex Results**: For complex tasks, validate `codex-validation-analysis.md` with implementation guidance
   - **Fallback Processing**: Use execution logs if primary outputs are incomplete
   - **Status Classification**: Mark each tool as completed, partial, failed, or skipped

2. **Quality Assessment**
   - Verify analysis completeness against expected output structure
   - Assess actionability of recommendations and blueprints
   - Validate presence of concrete implementation examples
   - Check coverage of technical requirements and constraints

3. **Analysis Integration Strategy**
   - **Simple/Medium Tasks**: Direct integration of Gemini comprehensive analysis
   - **Complex Tasks**: Synthesis of Gemini understanding with Codex validation
   - **Conflict Resolution**: Identify and resolve conflicting recommendations
   - **Priority Matrix**: Organize recommendations by implementation priority

### Phase 5: ANALYSIS_RESULTS.md Generation
1. **Structured Report Assembly**
   - **Executive Summary**: Task overview, timestamp, tools used, key findings
   - **Analysis Results**: Complete Gemini analysis with optional Codex validation
   - **Synthesis & Recommendations**: Consolidated implementation strategy with risk mitigation
   - **Implementation Roadmap**: Phase-by-phase development plan with timelines
   - **Quality Assurance**: Testing frameworks, monitoring strategies, success criteria

2. **Supplementary Outputs**
   - **Machine-Readable Summary**: `analysis-summary.json` with structured metadata
   - **Implementation Guidelines**: Phase-specific deliverables and checkpoints
   - **Next Steps Matrix**: Immediate, short-term, and long-term action items

3. **Final Report Generation**
   - **Primary Output**: `ANALYSIS_RESULTS.md` with comprehensive analysis and implementation blueprint
   - **Secondary Output**: `analysis-summary.json` with machine-readable metadata and status
   - **Report Structure**: Executive summary, analysis results, synthesis recommendations, implementation roadmap, quality assurance strategy
   - **Action Items**: Immediate, short-term, and long-term next steps with success criteria

4. **Summary Report Finalization**
   - Generate executive summary with key findings
   - Create implementation priority matrix
   - Provide next steps and action items
   - Generate quality metrics and confidence scores

## Analysis Results Format

Generated ANALYSIS_RESULTS.md format (Multi-Tool Perspective Analysis):

```markdown
# Multi-Tool Analysis Results

## Task Overview
- **Description**: {task_description}
- **Context Package**: {context_package_path}
- **Analysis Tools**: {tools_used}
- **Analysis Timestamp**: {timestamp}

## Tool-Specific Analysis

### 🧠 Gemini Analysis (Enhanced Understanding & Architecture Blueprint)
**Focus**: Existing codebase understanding, enhanced suggestions, and comprehensive technical architecture design with actionable improvements
**Write Permissions**: Enabled for suggestion generation and blueprint creation

#### Current Architecture Assessment
- **Existing Patterns**: {identified_patterns}
- **Code Structure**: {current_structure}
- **Integration Points**: {integration_analysis}
- **Technical Debt**: {debt_assessment}

#### Compatibility Analysis
- **Framework Compatibility**: {framework_analysis}
- **Dependency Impact**: {dependency_analysis}
- **Migration Considerations**: {migration_notes}

#### Proposed Architecture
- **System Design**: {architectural_design}
- **Component Structure**: {component_design}
- **Data Flow**: {data_flow_design}
- **Interface Design**: {api_interface_design}

#### Implementation Strategy
- **Code Organization**: {code_structure_plan}
- **Module Dependencies**: {module_dependencies}
- **Testing Strategy**: {testing_approach}

### 🔧 Codex Analysis (Implementation Blueprints & Enhanced Validation)
**Focus**: Implementation feasibility, write-enabled blueprints, and comprehensive technical validation with concrete examples
**Write Permissions**: Full access for implementation suggestion generation

#### Feasibility Assessment
- **Technical Risks**: {implementation_risks}
- **Performance Impact**: {performance_analysis}
- **Resource Requirements**: {resource_assessment}
- **Maintenance Complexity**: {maintenance_analysis}

#### Enhanced Implementation Blueprints
- **Tool Selection**: {recommended_tools_with_examples}
- **Development Approach**: {detailed_development_strategy}
- **Quality Assurance**: {comprehensive_qa_recommendations}
- **Code Examples**: {implementation_code_samples}
- **Testing Blueprints**: {automated_testing_strategies}
- **Deployment Guidelines**: {deployment_implementation_guide}


## Synthesis & Consensus

### Enhanced Consolidated Recommendations
- **Architecture Approach**: {consensus_architecture_with_blueprints}
- **Implementation Priority**: {detailed_priority_matrix}
- **Risk Mitigation**: {comprehensive_risk_mitigation_strategy}
- **Performance Optimization**: {optimization_recommendations}
- **Security Enhancements**: {security_implementation_guide}

## Implementation Roadmap

### Phase 1: Foundation Setup
- **Infrastructure**: {infrastructure_setup_blueprint}
- **Development Environment**: {dev_env_configuration}
- **Initial Architecture**: {foundational_architecture}

### Phase 2: Core Implementation
- **Priority Features**: {core_feature_implementation}
- **Testing Framework**: {testing_implementation_strategy}
- **Quality Gates**: {quality_assurance_checkpoints}

### Phase 3: Enhancement & Optimization
- **Performance Tuning**: {performance_enhancement_plan}
- **Security Hardening**: {security_implementation_steps}
- **Scalability Improvements**: {scalability_enhancement_strategy}

## Enhanced Quality Assurance Strategy

### Automated Testing Blueprint
- **Unit Testing**: {unit_test_implementation}
- **Integration Testing**: {integration_test_strategy}
- **Performance Testing**: {performance_test_blueprint}
- **Security Testing**: {security_test_framework}

### Continuous Quality Monitoring
- **Code Quality Metrics**: {quality_monitoring_setup}
- **Performance Monitoring**: {performance_tracking_implementation}
- **Security Monitoring**: {security_monitoring_blueprint}

### Tool Agreement Analysis
- **Consensus Points**: {agreed_recommendations}
- **Conflicting Views**: {conflicting_opinions}
- **Resolution Strategy**: {conflict_resolution}

### Task Decomposition Suggestions
1. **Primary Tasks**: {major_task_suggestions}
2. **Task Dependencies**: {dependency_mapping}
3. **Complexity Assessment**: {complexity_evaluation}

## Enhanced Analysis Quality Metrics
- **Context Coverage**: {coverage_percentage}
- **Multi-Tool Consensus**: {three_tool_consensus_level}
- **Analysis Depth**: {comprehensive_depth_assessment}
- **Implementation Feasibility**: {feasibility_confidence_score}
- **Blueprint Completeness**: {blueprint_coverage_score}
- **Actionability Score**: {suggestion_actionability_rating}
- **Overall Confidence**: {enhanced_confidence_score}

## Implementation Success Indicators
- **Technical Feasibility**: {technical_implementation_confidence}
- **Resource Adequacy**: {resource_requirement_assessment}
- **Timeline Realism**: {timeline_feasibility_score}
- **Risk Management**: {risk_mitigation_effectiveness}

## Next Steps & Action Items
1. **Immediate Actions**: {immediate_implementation_steps}
2. **Short-term Goals**: {short_term_objectives}
3. **Long-term Strategy**: {long_term_implementation_plan}
4. **Success Metrics**: {implementation_success_criteria}
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
- **Primary**: Enhanced ANALYSIS_RESULTS.md file with implementation blueprints
- **Location**: .workflow/{session_id}/.process/ANALYSIS_RESULTS.md
- **Secondary**: analysis-summary.json (machine-readable format)
- **Tertiary**: implementation-roadmap.md (detailed implementation guide)
- **Quaternary**: blueprint-templates/ directory (code templates and examples)

## Quality Assurance

### Analysis Quality Checks
- **Completeness Check**: Ensure all required analysis sections are completed
- **Consistency Check**: Verify consistency of multi-tool analysis results
- **Feasibility Validation**: Ensure recommended implementation plans are feasible

### Success Criteria
- ✅ **Enhanced Output Generation**: Comprehensive ANALYSIS_RESULTS.md with implementation blueprints and machine-readable summary
- ✅ **Write-Enabled CLI Tools**: Full write permissions for Gemini (--approval-mode yolo) and Codex (exec ... --skip-git-repo-check -s danger-full-access)
- ✅ **Enhanced Suggestions**: Concrete implementation examples, configuration templates, and step-by-step procedures
- ✅ **Design Blueprints**: Detailed technical architecture with component diagrams and API specifications
- ✅ **Parallel Execution**: Efficient concurrent tool execution with proper monitoring and timeout handling
- ✅ **Robust Error Handling**: Comprehensive validation, timeout management, and partial result recovery
- ✅ **Actionable Results**: Implementation roadmap with phase-by-phase development strategy and success criteria
- ✅ **Quality Assurance**: Automated testing frameworks, CI/CD blueprints, and monitoring strategies
- ✅ **Performance Optimization**: Execution completes within 30 minutes with resource management

## Related Commands
- `/context:gather` - Generate context packages required by this command
- `/workflow:plan` - Call this command for analysis
- `/task:create` - Create specific tasks based on analysis results