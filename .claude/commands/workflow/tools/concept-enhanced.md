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
- **Agent Coordination**: Delegate analysis execution to specialized agent (cli-execution-agent)
- **Solution-Focused Analysis**: Emphasize design decisions, architectural rationale, and critical insights (exclude task planning)
- **Context-Driven**: Parse and validate context-package.json for precise analysis
- **Agent-Driven Tool Selection**: Agent autonomously selects Gemini/Codex based on task complexity
- **Solution Design**: Evaluate architecture, identify key design decisions with rationale
- **Feasibility Assessment**: Analyze technical complexity, risks, implementation readiness
- **Optimization Recommendations**: Performance, security, and code quality improvements
- **Output Validation**: Verify ANALYSIS_RESULTS.md generation and quality
- **Single Output**: Generate only ANALYSIS_RESULTS.md with technical analysis

## Analysis Strategy Selection

**Agent-Driven Strategy**: cli-execution-agent autonomously determines tool selection based on:
- **Task Complexity**: Number of modules, integration scope, technical depth
- **Tech Stack**: Frontend (Gemini-focused), Backend (Codex-preferred), Fullstack (hybrid)
- **Analysis Focus**: Architecture design (Gemini), Feasibility validation (Codex), Performance optimization (both)

**Complexity Tiers** (Agent decides internally):
- **Simple (≤3 modules)**: Gemini-only analysis
- **Medium (4-6 modules)**: Gemini comprehensive analysis
- **Complex (>6 modules)**: Gemini + Codex parallel execution

## Execution Lifecycle

### Phase 1: Validation & Preparation
1. **Session Validation**: Verify `.workflow/{session_id}/` exists, load `workflow-session.json`
2. **Context Package Validation**: Verify path, validate JSON format and structure
3. **Task Analysis**: Extract keywords, identify domain/complexity, determine scope
4. **Agent Preparation**: Prepare agent task prompt with complete analysis requirements

### Phase 2: Agent-Delegated Analysis

**Agent Invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Enhanced solution design and feasibility analysis",
  prompt=`
## Execution Context

**Session ID**: {session_id}
**Mode**: Enhanced Analysis with CLI Tool Orchestration

## Input Context

**Context Package**: {context_path}
**Session State**: .workflow/{session_id}/workflow-session.json
**Project Standards**: CLAUDE.md

## Analysis Task

### Analysis Templates (Use these to guide CLI tool execution)
- **Document Structure**: ~/.claude/workflows/cli-templates/prompts/workflow/analysis-results-structure.txt
- **Gemini Analysis**: ~/.claude/workflows/cli-templates/prompts/workflow/gemini-solution-design.txt
- **Codex Validation**: ~/.claude/workflows/cli-templates/prompts/workflow/codex-feasibility-validation.txt

### Execution Strategy
1. **Load Context**: Read context-package.json to determine task complexity (module count, integration scope)
2. **Gemini Analysis** (ALL tasks): Execute using gemini-solution-design.txt template
   - Output: .workflow/{session_id}/.process/gemini-solution-design.md
3. **Codex Validation** (COMPLEX tasks >6 modules only): Execute using codex-feasibility-validation.txt template
   - Output: .workflow/{session_id}/.process/codex-feasibility-validation.md
4. **Synthesize Results**: Combine outputs into ANALYSIS_RESULTS.md following analysis-results-structure.txt

### Output Requirements

**Intermediate Outputs**:
- Gemini: \`.workflow/{session_id}/.process/gemini-solution-design.md\` (always required)
- Codex: \`.workflow/{session_id}/.process/codex-feasibility-validation.md\` (complex tasks only)

**Final Output**:
- \`.workflow/{session_id}/.process/ANALYSIS_RESULTS.md\` (synthesized, required)

**Required Sections** (7 sections per analysis-results-structure.txt):
1. Executive Summary
2. Current State Analysis
3. Proposed Solution Design
4. Implementation Strategy
5. Solution Optimization
6. Critical Success Factors
7. Reference Information

### Synthesis Rules
- Follow 7-section structure from analysis-results-structure.txt
- Integrate Gemini insights as primary content
- Incorporate Codex validation findings (if executed)
- Resolve conflicts between tools with clear rationale
- Generate confidence scores (1-5 scale) for all assessment dimensions
- Provide final recommendation: PROCEED | PROCEED_WITH_MODIFICATIONS | RECONSIDER | REJECT

## Output
Generate final ANALYSIS_RESULTS.md and report completion status:
- Gemini analysis: [completed/failed]
- Codex validation: [completed/skipped/failed]
- Synthesis: [completed/failed]
- Final output: .workflow/{session_id}/.process/ANALYSIS_RESULTS.md
`
)
```

**Agent Execution Flow** (Internal to cli-execution-agent):
1. Parse session ID and context path, load context-package.json
2. Analyze task complexity (module count, integration scope)
3. Discover additional context via MCP code-index
4. Execute Gemini analysis (all tasks) with template-guided prompt
5. Execute Codex validation (complex tasks >6 modules) with template-guided prompt
6. Synthesize Gemini + Codex outputs into ANALYSIS_RESULTS.md
7. Verify output file exists at correct path
8. Return execution log path

**Command Execution**: Launch agent via Task tool, wait for completion

### Phase 3: Output Validation
1. **File Verification**: Confirm `.workflow/{session_id}/.process/ANALYSIS_RESULTS.md` exists
2. **Content Validation**: Verify required sections present (Executive Summary, Solution Design, etc.)
3. **Quality Check**: Ensure design rationale, feasibility assessment, confidence scores included
4. **Agent Log**: Retrieve agent execution log from `.workflow/{session_id}/.chat/`
5. **Success Criteria**: File exists, contains all required sections, meets quality standards

## Analysis Results Format

**Template Reference**: `~/.claude/workflows/cli-templates/prompts/workflow/analysis-results-structure.txt`

Generated ANALYSIS_RESULTS.md focuses on **solution improvements, key design decisions, and critical insights** (NOT task planning).

### Required Structure (7 Sections)

1. **Executive Summary**: Analysis focus, tools used, overall assessment (X/5), recommendation status
2. **Current State Analysis**: Architecture overview, compatibility/dependencies, critical findings
3. **Proposed Solution Design**: Core principles, system design, key decisions with rationale, technical specs
4. **Implementation Strategy**: Development approach, code modification targets, feasibility assessment, risk mitigation
5. **Solution Optimization**: Performance, security, code quality recommendations
6. **Critical Success Factors**: Technical requirements, quality metrics, success validation
7. **Reference Information**: Tool analysis summary, context & resources

### Key Requirements

**Code Modification Targets**:
- Existing files: `file:function:lines` (e.g., `src/auth/login.ts:validateUser:45-52`)
- New files: `file` only (e.g., `src/auth/PasswordReset.ts`)
- Unknown lines: `file:function:*`

**Key Design Decisions** (minimum 2):
- Decision statement
- Rationale (why this approach)
- Alternatives considered (tradeoffs)
- Impact (implications on architecture)

**Assessment Scores** (1-5 scale):
- Conceptual Integrity, Architectural Soundness, Technical Feasibility, Implementation Readiness
- Overall Confidence score
- Final Recommendation: PROCEED | PROCEED_WITH_MODIFICATIONS | RECONSIDER | REJECT

### Content Focus
- ✅ Solution improvements and architectural decisions
- ✅ Design rationale, alternatives, and tradeoffs
- ✅ Risk assessment with mitigation strategies
- ✅ Optimization opportunities (performance, security, quality)
- ❌ Task lists or implementation steps
- ❌ Code examples or snippets
- ❌ Project management timelines

## Execution Management

### Error Handling & Recovery
1. **Pre-execution**: Verify session/context package exists and is valid
2. **Agent Monitoring**: Track agent execution status via Task tool
3. **Validation**: Check ANALYSIS_RESULTS.md generation on completion
4. **Error Recovery**:
   - Agent execution failure → report error, check agent logs
   - Missing output file → retry agent execution once
   - Incomplete output → use agent logs to diagnose issue
5. **Graceful Degradation**: If agent fails, report specific error and suggest manual analysis

### Agent Delegation Benefits
- **Autonomous Tool Selection**: Agent decides Gemini/Codex based on complexity
- **Context Discovery**: Agent discovers additional relevant files via MCP
- **Prompt Enhancement**: Agent optimizes prompts with discovered patterns
- **Error Handling**: Agent manages CLI tool failures internally
- **Log Tracking**: Agent execution logs saved to `.workflow/{session_id}/.chat/`

## Integration & Success Criteria

### Input/Output Interface
**Input**:
- `--session` (required): Session ID (e.g., WFS-auth)
- `--context` (required): Context package path

**Output**:
- Single file: `ANALYSIS_RESULTS.md` at `.workflow/{session_id}/.process/`
- No supplementary files (JSON, roadmap, templates)

### Quality & Success Validation
**Quality Checks**: Completeness, consistency, feasibility validation

**Success Criteria**:
- ✅ Solution-focused analysis (design decisions, critical insights, NO task planning)
- ✅ Single output file only (ANALYSIS_RESULTS.md)
- ✅ Design decision depth with rationale/alternatives/tradeoffs
- ✅ Feasibility assessment (complexity, risks, readiness)
- ✅ Optimization strategies (performance, security, quality)
- ✅ Agent-driven tool selection (autonomous Gemini/Codex execution)
- ✅ Robust error handling (validation, retry, graceful degradation)
- ✅ Confidence scoring with clear recommendation status
- ✅ Agent execution log saved to session chat directory

## Related Commands
- `/context:gather` - Generate context packages required by this command
- `/workflow:plan` - Call this command for analysis
- `/task:create` - Create specific tasks based on analysis results