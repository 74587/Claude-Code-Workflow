---
name: concept-eval
description: Evaluate concept planning before implementation with intelligent tool analysis
usage: /workflow:concept-eval [--tool gemini|codex|both] <input>
argument-hint: [--tool gemini|codex|both] "concept description"|file.md|ISS-001
examples:
  - /workflow:concept-eval "Build microservices architecture"
  - /workflow:concept-eval --tool gemini requirements.md
  - /workflow:concept-eval --tool both ISS-001
allowed-tools: Task(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*)
---

# Workflow Concept Evaluation Command

## Overview
Pre-planning evaluation command that assesses concept feasibility, identifies potential issues, and provides optimization recommendations before formal planning begins. **Works before `/workflow:plan`** to catch conceptual problems early and improve initial design quality.

## Core Responsibilities
- **Concept Analysis**: Evaluate design concepts for architectural soundness
- **Feasibility Assessment**: Technical and resource feasibility evaluation
- **Risk Identification**: Early identification of potential implementation risks
- **Optimization Suggestions**: Generate actionable improvement recommendations
- **Context Integration**: Leverage existing codebase patterns and documentation
- **Tool Selection**: Use gemini for strategic analysis, codex for technical assessment

## Usage
```bash
/workflow:concept-eval [--tool gemini|codex|both] <input>
```

## Parameters
- **--tool**: Specify evaluation tool (default: both)
  - `gemini`: Strategic and architectural evaluation
  - `codex`: Technical feasibility and implementation assessment
  - `both`: Comprehensive dual-perspective analysis
- **input**: Concept description, file path, or issue reference

## Input Detection
- **Files**: `.md/.txt/.json/.yaml/.yml` → Reads content and extracts concept requirements
- **Issues**: `ISS-*`, `ISSUE-*`, `*-request-*` → Loads issue data and requirement specifications
- **Text**: Everything else → Parses natural language concept descriptions

## Core Workflow

### Evaluation Process
The command performs comprehensive concept evaluation through:

**0. Context Preparation** ⚠️ FIRST STEP
- **MCP Tools Integration**: Use Code Index for codebase exploration, Exa for external context
- **Documentation loading**: Automatic context gathering based on concept scope
  - **Always check**: `CLAUDE.md`, `README.md` - Project context and conventions
  - **For architecture concepts**: `.workflow/docs/architecture/`, existing system patterns
  - **For specific modules**: `.workflow/docs/modules/[relevant-module]/` documentation
  - **For API concepts**: `.workflow/docs/api/` specifications
- **Claude Code Memory Integration**: Access conversation history and previous work context
  - **Session Memory**: Current session analysis and decisions
  - **Project Memory**: Previous implementations and lessons learned
  - **Pattern Memory**: Successful approaches and anti-patterns identified
  - **Context Continuity**: Reference previous concept evaluations and outcomes
- **Context-driven selection**: Only load documentation relevant to the concept scope
- **Pattern analysis**: Identify existing implementation patterns and conventions

**1. Input Processing & Context Gathering**
- Parse input to extract concept requirements and scope
- Automatic tool assignment based on evaluation needs:
  - **Strategic evaluation** (gemini): Architectural soundness, design patterns, business alignment
  - **Technical assessment** (codex): Implementation complexity, technical feasibility, resource requirements
  - **Comprehensive analysis** (both): Combined strategic and technical evaluation
- Load relevant project documentation and existing patterns

**2. Concept Analysis** ⚠️ CRITICAL EVALUATION PHASE
- **Conceptual integrity**: Evaluate design coherence and completeness
- **Architectural soundness**: Assess alignment with existing system architecture
- **Technical feasibility**: Analyze implementation complexity and resource requirements
- **Risk assessment**: Identify potential technical and business risks
- **Dependency analysis**: Map required dependencies and integration points

**3. Evaluation Execution**
Based on tool selection, execute appropriate analysis:

**Gemini Strategic Analysis**:
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Strategic evaluation of concept design and architecture
TASK: Analyze concept for architectural soundness, design patterns, and strategic alignment
CONTEXT: @{CLAUDE.md,README.md,.workflow/docs/**/*} Concept requirements and existing patterns | Previous conversation context and Claude Code session memory for continuity and pattern recognition
EXPECTED: Strategic assessment with architectural recommendations informed by session history
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/planning/concept-eval.txt) | Focus on strategic soundness and design quality | Reference previous evaluations and lessons learned
"
```

**Codex Technical Assessment**:
```bash
codex --full-auto exec "
PURPOSE: Technical feasibility assessment of concept implementation
TASK: Evaluate implementation complexity, technical risks, and resource requirements
CONTEXT: @{CLAUDE.md,README.md,src/**/*} Concept requirements and existing codebase | Current session work context and previous technical decisions
EXPECTED: Technical assessment with implementation recommendations building on session memory
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/planning/concept-eval.txt) | Focus on technical feasibility and implementation complexity | Consider previous technical approaches and outcomes
" -s danger-full-access
```

**Combined Analysis** (when --tool both):
Execute both analyses in parallel, then synthesize results for comprehensive evaluation.

**4. Optimization Recommendations**
- **Design improvements**: Architectural and design optimization suggestions
- **Risk mitigation**: Strategies to address identified risks
- **Implementation approach**: Recommended technical approaches and patterns
- **Resource optimization**: Efficient resource utilization strategies
- **Integration suggestions**: Optimal integration with existing systems

## Implementation Standards

### Evaluation Criteria ⚠️ CRITICAL
Concept evaluation focuses on these key dimensions:

**Strategic Evaluation (Gemini)**:
1. **Architectural Soundness**: Design coherence and system integration
2. **Business Alignment**: Concept alignment with business objectives
3. **Scalability Considerations**: Long-term growth and expansion potential
4. **Design Patterns**: Appropriate use of established design patterns
5. **Risk Assessment**: Strategic and business risk identification

**Technical Assessment (Codex)**:
1. **Implementation Complexity**: Technical difficulty and effort estimation
2. **Technical Feasibility**: Availability of required technologies and skills
3. **Resource Requirements**: Development time, infrastructure, and team resources
4. **Integration Challenges**: Technical integration complexity and risks
5. **Performance Implications**: System performance and scalability impact

### Evaluation Context Loading ⚠️ CRITICAL
Context preparation ensures comprehensive evaluation:

```json
// Context loading strategy for concept evaluation
"context_preparation": {
  "required_docs": [
    "CLAUDE.md",
    "README.md"
  ],
  "conditional_docs": {
    "architecture_concepts": [
      ".workflow/docs/architecture/",
      "docs/system-design.md"
    ],
    "api_concepts": [
      ".workflow/docs/api/",
      "api-documentation.md"
    ],
    "module_concepts": [
      ".workflow/docs/modules/[relevant-module]/",
      "src/[module]/**/*.md"
    ]
  },
  "pattern_analysis": {
    "existing_implementations": "src/**/*",
    "configuration_patterns": "config/",
    "test_patterns": "test/**/*"
  },
  "claude_code_memory": {
    "session_context": "Current session conversation history and decisions",
    "project_memory": "Previous implementations and lessons learned across sessions",
    "pattern_memory": "Successful approaches and anti-patterns identified",
    "evaluation_history": "Previous concept evaluations and their outcomes",
    "technical_decisions": "Past technical choices and their rationale",
    "architectural_evolution": "System architecture changes and migration patterns"
  }
}
```

### Analysis Output Structure

**Evaluation Categories**:
```markdown
## Concept Evaluation Summary

### ✅ Strengths Identified
- [ ] **Design Quality**: Well-defined architectural approach
- [ ] **Technical Approach**: Appropriate technology selection
- [ ] **Integration**: Good fit with existing systems

### ⚠️ Areas for Improvement
- [ ] **Complexity**: Reduce implementation complexity in module X
- [ ] **Dependencies**: Simplify dependency management approach
- [ ] **Scalability**: Address potential performance bottlenecks

### ❌ Critical Issues
- [ ] **Architecture**: Conflicts with existing system design
- [ ] **Resources**: Insufficient resources for proposed timeline
- [ ] **Risk**: High technical risk in component Y

### 🎯 Optimization Recommendations
- [ ] **Alternative Approach**: Consider microservices instead of monolithic design
- [ ] **Technology Stack**: Use existing React patterns instead of Vue
- [ ] **Implementation Strategy**: Phase implementation to reduce risk
```

## Document Generation & Output

**Evaluation Workflow**: Input Processing → Context Loading → Analysis Execution → Report Generation → Recommendations

**Always Created**:
- **CONCEPT_EVALUATION.md**: Complete evaluation results and recommendations
- **evaluation-session.json**: Evaluation metadata and tool configuration
- **OPTIMIZATION_SUGGESTIONS.md**: Actionable improvement recommendations

**Auto-Created (for comprehensive analysis)**:
- **strategic-analysis.md**: Gemini strategic evaluation results
- **technical-assessment.md**: Codex technical feasibility analysis
- **risk-assessment-matrix.md**: Comprehensive risk evaluation
- **implementation-roadmap.md**: Recommended implementation approach

**Document Structure**:
```
.workflow/WFS-[topic]/.evaluation/
├── evaluation-session.json        # Evaluation session metadata
├── CONCEPT_EVALUATION.md          # Complete evaluation results
├── OPTIMIZATION_SUGGESTIONS.md    # Actionable recommendations
├── strategic-analysis.md          # Gemini strategic evaluation
├── technical-assessment.md        # Codex technical assessment
├── risk-assessment-matrix.md      # Risk evaluation matrix
└── implementation-roadmap.md      # Recommended approach
```

### Evaluation Implementation

**Session-Aware Evaluation**:
```bash
# Check for existing sessions and context
active_sessions=$(find .workflow/ -name ".active-*" 2>/dev/null)
if [ -n "$active_sessions" ]; then
  echo "Found active sessions: $active_sessions"
  echo "Concept evaluation will consider existing session context"
fi

# Create evaluation session directory
evaluation_session="CE-$(date +%Y%m%d_%H%M%S)"
mkdir -p ".workflow/.evaluation/$evaluation_session"

# Store evaluation metadata
cat > ".workflow/.evaluation/$evaluation_session/evaluation-session.json" << EOF
{
  "session_id": "$evaluation_session",
  "timestamp": "$(date -Iseconds)",
  "concept_input": "$input_description",
  "tool_selection": "$tool_choice",
  "context_loaded": [
    "CLAUDE.md",
    "README.md"
  ],
  "evaluation_scope": "$evaluation_scope"
}
EOF
```

**Tool Execution Pattern**:
```bash
# Execute based on tool selection
case "$tool_choice" in
  "gemini")
    echo "Performing strategic concept evaluation with Gemini..."
    ~/.claude/scripts/gemini-wrapper -p "$gemini_prompt" > ".workflow/.evaluation/$evaluation_session/strategic-analysis.md"
    ;;
  "codex")
    echo "Performing technical assessment with Codex..."
    codex --full-auto exec "$codex_prompt" -s danger-full-access > ".workflow/.evaluation/$evaluation_session/technical-assessment.md"
    ;;
  "both"|*)
    echo "Performing comprehensive evaluation with both tools..."
    ~/.claude/scripts/gemini-wrapper -p "$gemini_prompt" > ".workflow/.evaluation/$evaluation_session/strategic-analysis.md" &
    codex --full-auto exec "$codex_prompt" -s danger-full-access > ".workflow/.evaluation/$evaluation_session/technical-assessment.md" &
    wait # Wait for both analyses to complete

    # Synthesize results
    ~/.claude/scripts/gemini-wrapper -p "
    PURPOSE: Synthesize strategic and technical concept evaluations
    TASK: Combine analyses and generate integrated recommendations
    CONTEXT: @{.workflow/.evaluation/$evaluation_session/strategic-analysis.md,.workflow/.evaluation/$evaluation_session/technical-assessment.md}
    EXPECTED: Integrated evaluation with prioritized recommendations
    RULES: Focus on actionable insights and clear next steps
    " > ".workflow/.evaluation/$evaluation_session/CONCEPT_EVALUATION.md"
    ;;
esac
```

## Integration with Workflow Commands

### Workflow Position
**Pre-Planning Phase**: Use before formal planning to optimize concept quality
```
concept-eval → plan → plan-verify → execute
```

### Usage Scenarios

**Early Concept Validation**:
```bash
# Validate initial concept before detailed planning
/workflow:concept-eval "Build real-time notification system using WebSockets"
```

**Architecture Review**:
```bash
# Strategic architecture evaluation
/workflow:concept-eval --tool gemini architecture-proposal.md
```

**Technical Feasibility Check**:
```bash
# Technical implementation assessment
/workflow:concept-eval --tool codex "Implement ML-based recommendation engine"
```

**Comprehensive Analysis**:
```bash
# Full strategic and technical evaluation
/workflow:concept-eval --tool both ISS-042
```

### Integration Benefits
- **Early Risk Detection**: Identify issues before detailed planning
- **Quality Improvement**: Optimize concepts before implementation planning
- **Resource Efficiency**: Avoid detailed planning of infeasible concepts
- **Decision Support**: Data-driven concept selection and refinement
- **Team Alignment**: Clear evaluation criteria and recommendations

## Error Handling & Edge Cases

### Input Validation
```bash
# Validate input format and accessibility
if [[ -z "$input" ]]; then
  echo "Error: Concept input required"
  echo "Usage: /workflow:concept-eval [--tool gemini|codex|both] <input>"
  exit 1
fi

# Check file accessibility for file inputs
if [[ "$input" =~ \.(md|txt|json|yaml|yml)$ ]] && [[ ! -f "$input" ]]; then
  echo "Error: File not found: $input"
  echo "Please provide a valid file path or concept description"
  exit 1
fi
```

### Tool Availability
```bash
# Check tool availability
if [[ "$tool_choice" == "gemini" ]] || [[ "$tool_choice" == "both" ]]; then
  if ! command -v ~/.claude/scripts/gemini-wrapper &> /dev/null; then
    echo "Warning: Gemini wrapper not available, using codex only"
    tool_choice="codex"
  fi
fi

if [[ "$tool_choice" == "codex" ]] || [[ "$tool_choice" == "both" ]]; then
  if ! command -v codex &> /dev/null; then
    echo "Warning: Codex not available, using gemini only"
    tool_choice="gemini"
  fi
fi
```

### Recovery Strategies
```bash
# Fallback to manual evaluation if tools fail
if [[ "$evaluation_failed" == "true" ]]; then
  echo "Automated evaluation failed, generating manual evaluation template..."
  cat > ".workflow/.evaluation/$evaluation_session/manual-evaluation-template.md" << EOF
# Manual Concept Evaluation

## Concept Description
$input_description

## Evaluation Checklist
- [ ] **Architectural Soundness**: Does the concept align with existing architecture?
- [ ] **Technical Feasibility**: Are required technologies available and mature?
- [ ] **Resource Requirements**: Are time and team resources realistic?
- [ ] **Integration Complexity**: How complex is integration with existing systems?
- [ ] **Risk Assessment**: What are the main technical and business risks?

## Recommendations
[Provide manual evaluation and recommendations]
EOF
fi
```

## Quality Standards

### Evaluation Excellence
- **Comprehensive Analysis**: Consider all aspects of concept feasibility
- **Context-Rich Assessment**: Leverage full project context and existing patterns
- **Actionable Recommendations**: Provide specific, implementable suggestions
- **Risk-Aware Evaluation**: Identify and assess potential implementation risks

### User Experience Excellence
- **Clear Results**: Present evaluation results in actionable format
- **Focused Recommendations**: Prioritize most critical optimization suggestions
- **Integration Guidance**: Provide clear next steps for concept refinement
- **Tool Transparency**: Clear indication of which tools were used and why

### Output Quality
- **Structured Reports**: Consistent, well-organized evaluation documentation
- **Evidence-Based**: All recommendations backed by analysis and reasoning
- **Prioritized Actions**: Clear indication of critical vs. optional improvements
- **Implementation Ready**: Evaluation results directly usable for planning phase