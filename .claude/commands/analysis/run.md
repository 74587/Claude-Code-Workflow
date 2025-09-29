---
name: run
description: Analyze context packages using intelligent tools and generate structured analysis reports
usage: /analysis:run --session <session_id> --context <context_package_path>
argument-hint: "--session WFS-session-id --context path/to/context-package.json"
examples:
  - /analysis:run --session WFS-auth --context .workflow/WFS-auth/.process/context-package.json
  - /analysis:run --session WFS-payment --context .workflow/WFS-payment/.process/context-package.json
---

# Analysis Run Command (/analysis:run)

## Overview
Intelligent analysis engine that processes standardized context packages, executes deep analysis using multiple AI tools, and generates structured analysis reports.

## Core Philosophy
- **Context-Driven**: Precise analysis based on comprehensive context
- **Intelligent Tool Selection**: Choose optimal analysis tools based on task characteristics
- **Structured Output**: Generate standardized analysis reports
- **Configurable Analysis**: Support different depth and focus levels

## Core Responsibilities
- **Context Package Parsing**: Read and validate context-package.json
- **Multi-Tool Orchestration**: Execute parallel analysis using Gemini/Qwen/Codex
- **Perspective Synthesis**: Collect and organize different tool viewpoints
- **Consensus Analysis**: Identify agreements and conflicts between tools
- **Analysis Report Generation**: Output multi-perspective ANALYSIS_RESULTS.md (NOT implementation plan)

## Analysis Strategy Selection

### Tool Selection by Task Complexity

**Simple Tasks (≤3 modules)**:
- **Primary Tool**: Gemini (rapid understanding and pattern recognition)
- **Support Tool**: Code-index (structural analysis)
- **Execution Mode**: Single-round analysis, focus on existing patterns

**Medium Tasks (4-6 modules)**:
- **Primary Tool**: Qwen (architecture analysis and code generation)
- **Support Tools**: Gemini (pattern recognition) + Exa (external best practices)
- **Execution Mode**: Two-round analysis, architecture design + implementation strategy

**Complex Tasks (>6 modules)**:
- **Primary Tools**: Multi-tool collaboration (Gemini+Qwen+Codex)
- **Analysis Strategy**: Layered analysis with progressive refinement
- **Execution Mode**: Three-round analysis, understand + design + validate

### Tool Preferences by Tech Stack

```json
{
  "frontend": {
    "primary": "qwen",
    "secondary": "gemini",
    "focus": ["component_design", "state_management", "ui_patterns"]
  },
  "backend": {
    "primary": "codex",
    "secondary": "qwen",
    "focus": ["api_design", "data_flow", "security", "performance"]
  },
  "fullstack": {
    "primary": "gemini",
    "secondary": "qwen+codex",
    "focus": ["system_architecture", "integration", "data_consistency"]
  }
}
```

## Execution Process

### Phase 1: Session & Context Package Analysis
1. **Session Validation**
   ```bash
   # Validate session exists
   if [ ! -d ".workflow/${session_id}" ]; then
     echo "❌ Session ${session_id} not found"
     exit 1
   fi

   # Load session metadata
   session_metadata=".workflow/${session_id}/workflow-session.json"
   ```

2. **Package Validation**
   ```bash
   # Validate context-package.json format
   jq empty {context_package_path} || error "Invalid JSON format"
   ```

3. **Task Feature Extraction**
   - Parse task description and keywords
   - Load session task summaries for context
   - Identify tech stack and complexity
   - Determine analysis focus and objectives

4. **Resource Inventory**
   - Count files by type
   - Assess context size
   - Define analysis scope

### Phase 2: Analysis Tool Selection & Preparation
1. **Intelligent Tool Selection**
   ```bash
   # Select analysis tools based on complexity and tech stack
   if [ "$complexity" = "simple" ]; then
     analysis_tools=("gemini")
   elif [ "$complexity" = "medium" ]; then
     analysis_tools=("qwen" "gemini")
   else
     analysis_tools=("gemini" "qwen" "codex")
   fi
   ```

2. **Prompt Template Selection**
   - Choose analysis templates based on task type
   - Customize prompts with context information
   - Optimize token usage efficiency

### Phase 3: Multi-Tool Analysis Execution
1. **Gemini Analysis** (Understanding & Pattern Recognition)
   ```bash
   cd "$project_root" && ~/.claude/scripts/gemini-wrapper -p "
   PURPOSE: Deep understanding of project architecture and existing patterns
   TASK: Analyze ${task_description}
   CONTEXT: $(cat ${context_package_path} | jq -r '.assets[] | select(.priority=="high") | .path' | head -10)
   EXPECTED:
   - Existing architecture pattern analysis
   - Relevant code component identification
   - Technical risk assessment
   - Implementation complexity evaluation
   RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on existing patterns and integration points
   "
   ```

2. **Qwen Analysis** (Architecture Design & Code Generation Strategy)
   ```bash
   cd "$project_root" && ~/.claude/scripts/qwen-wrapper -p "
   PURPOSE: Design implementation architecture and code structure
   TASK: Design technical implementation plan for ${task_description}
   CONTEXT: $(cat ${context_package_path} | jq -r '.assets[].path') + Gemini analysis results
   EXPECTED:
   - Detailed technical implementation architecture
   - Code organization structure recommendations
   - Interface design and data flow
   - Specific implementation steps
   RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Design based on existing architecture
   "
   ```

3. **Codex Analysis** (Implementation Feasibility & Technical Validation)
   ```bash
   # Only used for complex tasks
   if [ "$complexity" = "complex" ]; then
     codex -C "$project_root" --full-auto exec "
     PURPOSE: Validate technical implementation feasibility
     TASK: Assess implementation risks and technical challenges for ${task_description}
     CONTEXT: Project codebase + Gemini and Qwen analysis results
     EXPECTED: Technical feasibility report and risk assessment
     RULES: Focus on technical risks, performance impact, and maintenance costs
     " -s danger-full-access
   fi
   ```

### Phase 4: Multi-Perspective Analysis Integration
1. **Tool-Specific Result Organization**
   - Organize Gemini analysis (understanding & patterns)
   - Organize Qwen analysis (architecture & design)
   - Organize Codex analysis (feasibility & validation)

2. **Perspective Synthesis**
   - Identify consensus points across tools
   - Document conflicting viewpoints
   - Provide synthesis recommendations

3. **Analysis Report Generation**
   - Generate multi-tool perspective ANALYSIS_RESULTS.md
   - Preserve individual tool insights
   - Provide consolidated recommendations (NOT detailed implementation plan)

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

### 🧠 Gemini Analysis (Understanding & Pattern Recognition)
**Focus**: Existing codebase understanding and pattern identification

#### Current Architecture Assessment
- **Existing Patterns**: {identified_patterns}
- **Code Structure**: {current_structure}
- **Integration Points**: {integration_analysis}
- **Technical Debt**: {debt_assessment}

#### Compatibility Analysis
- **Framework Compatibility**: {framework_analysis}
- **Dependency Impact**: {dependency_analysis}
- **Migration Considerations**: {migration_notes}

### 🏗️ Qwen Analysis (Architecture Design & Code Generation)
**Focus**: Technical architecture and implementation design

#### Proposed Architecture
- **System Design**: {architectural_design}
- **Component Structure**: {component_design}
- **Data Flow**: {data_flow_design}
- **Interface Design**: {api_interface_design}

#### Implementation Strategy
- **Code Organization**: {code_structure_plan}
- **Module Dependencies**: {module_dependencies}
- **Testing Strategy**: {testing_approach}

### 🔧 Codex Analysis (Implementation & Technical Validation)
**Focus**: Implementation feasibility and technical validation

#### Feasibility Assessment
- **Technical Risks**: {implementation_risks}
- **Performance Impact**: {performance_analysis}
- **Resource Requirements**: {resource_assessment}
- **Maintenance Complexity**: {maintenance_analysis}

#### Implementation Recommendations
- **Tool Selection**: {recommended_tools}
- **Development Approach**: {development_strategy}
- **Quality Assurance**: {qa_recommendations}

## Synthesis & Consensus

### Consolidated Recommendations
- **Architecture Approach**: {consensus_architecture}
- **Implementation Priority**: {priority_recommendations}
- **Risk Mitigation**: {risk_mitigation_strategy}

### Tool Agreement Analysis
- **Consensus Points**: {agreed_recommendations}
- **Conflicting Views**: {conflicting_opinions}
- **Resolution Strategy**: {conflict_resolution}

### Task Decomposition Suggestions
1. **Primary Tasks**: {major_task_suggestions}
2. **Task Dependencies**: {dependency_mapping}
3. **Complexity Assessment**: {complexity_evaluation}

## Analysis Quality Metrics
- **Context Coverage**: {coverage_percentage}
- **Tool Consensus**: {consensus_level}
- **Analysis Depth**: {depth_assessment}
- **Confidence Score**: {overall_confidence}
```

## Error Handling & Fallbacks

### Common Error Handling
1. **Context Package Not Found**
   ```bash
   if [ ! -f "$context_package_path" ]; then
     echo "❌ Context package not found: $context_package_path"
     echo "→ Run /context:gather first to generate context package"
     exit 1
   fi
   ```

2. **Tool Unavailability Handling**
   ```bash
   # Use Qwen when Gemini is unavailable
   if ! command -v ~/.claude/scripts/gemini-wrapper; then
     echo "⚠️ Gemini not available, falling back to Qwen"
     analysis_tools=("qwen")
   fi
   ```

3. **Large Context Handling**
   ```bash
   # Batch processing for large contexts
   context_size=$(jq '.assets | length' "$context_package_path")
   if [ "$context_size" -gt 50 ]; then
     echo "⚠️ Large context detected, using batch analysis"
     # Batch analysis logic
   fi
   ```

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
- **Primary**: ANALYSIS_RESULTS.md file
- **Location**: .workflow/{session_id}/.process/ANALYSIS_RESULTS.md
- **Secondary**: analysis-summary.json (machine-readable format)

## Quality Assurance

### Analysis Quality Checks
- **Completeness Check**: Ensure all required analysis sections are completed
- **Consistency Check**: Verify consistency of multi-tool analysis results
- **Feasibility Validation**: Ensure recommended implementation plans are feasible

### Success Criteria
- Generate complete ANALYSIS_RESULTS.md file
- Include specific feasible task decomposition recommendations
- Analysis results highly relevant to context
- Execution time within reasonable range (<10 minutes)

## Related Commands
- `/context:gather` - Generate context packages required by this command
- `/workflow:plan` - Call this command for analysis
- `/task:create` - Create specific tasks based on analysis results