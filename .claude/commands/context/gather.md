---
name: gather
description: Intelligently collect project context based on task description and package into standardized JSON
usage: /context:gather --session <session_id> "<task_description>"
argument-hint: "--session WFS-session-id \"task description\""
examples:
  - /context:gather --session WFS-user-auth "Implement user authentication system"
  - /context:gather --session WFS-payment "Refactor payment module API"
  - /context:gather --session WFS-bugfix "Fix login validation error"
---

# Context Gather Command (/context:gather)

## Overview
Enhanced intelligent context collector that leverages Gemini and Codex CLI tools to perform deep analysis, generate improvement suggestions, design blueprints, and create comprehensive analysis documents. All outputs are systematically organized in the current session's WFS `.process` directory.

## Core Philosophy
- **AI-Driven Analysis**: Use Gemini for architectural analysis and design blueprints
- **Implementation Focus**: Use Codex for practical implementation planning and quality assessment
- **Structured Output**: Generate organized analysis documents in WFS session `.process` folders
- **Synthesis Approach**: Combine all analysis results into a final comprehensive document

## Core Responsibilities
- **Initial Context Collection**: Use MCP tools to gather relevant codebase information
- **Gemini Analysis**: Generate deep architectural analysis and improvement suggestions
- **Design Blueprint Creation**: Create comprehensive design blueprints using Gemini
- **Codex Implementation Planning**: Generate practical implementation roadmaps with Codex
- **Quality Assessment**: Perform code quality analysis and optimization recommendations
- **Synthesis Documentation**: Combine all analysis into comprehensive final document
- **Process Organization**: Structure all outputs in WFS session `.process` directories

## Enhanced CLI Execution Process

### Phase 1: Task Analysis & Context Collection
1. **Initial Context Gathering**
   ```bash
   # Get project structure
   ~/.claude/scripts/get_modules_by_depth.sh

   # Use MCP tools for precise search
   mcp__code-index__find_files(pattern="*{keywords}*")
   mcp__code-index__search_code_advanced(pattern="{keywords}", file_pattern="*.{ts,js,py,go}")

   # Get external context if needed
   mcp__exa__get_code_context_exa(query="{task_type} {tech_stack} examples", tokensNum="dynamic")
   ```

2. **Session Directory Setup**
   ```bash
   # Ensure session .process directory exists
   mkdir -p ".workflow/${session_id}/.process"
   ```

### Phase 2: Gemini Analysis & Planning
1. **Comprehensive Analysis with Gemini**
   ```bash
   cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
   PURPOSE: Deep analysis of task requirements and current codebase state
   TASK: Analyze task '${task_description}' and generate improvement suggestions
   CONTEXT: @{CLAUDE.md,README.md,**/*${keywords}*} Current session: ${session_id}
   EXPECTED: Detailed analysis with improvement suggestions saved to .workflow/${session_id}/.process/
   RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Generate specific improvement recommendations and save to improvement-suggestions.md
   " > ".workflow/${session_id}/.process/gemini-analysis.md"
   ```

2. **Design Blueprint Generation**
   ```bash
   cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
   PURPOSE: Create comprehensive design blueprint for task implementation
   TASK: Design architectural blueprint for '${task_description}'
   CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,CLAUDE.md} Previous analysis results
   EXPECTED: Complete design blueprint with component diagrams and implementation strategy
   RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Create detailed design blueprint and save to design-blueprint.md
   " > ".workflow/${session_id}/.process/design-blueprint.md"
   ```

### Phase 3: Codex Implementation Planning
1. **Implementation Strategy with Codex**
   ```bash
   codex --full-auto exec "
   PURPOSE: Generate detailed implementation plan based on analysis and design
   TASK: Create implementation roadmap for '${task_description}'
   CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,.workflow/${session_id}/.process/design-blueprint.md}
   EXPECTED: Step-by-step implementation plan with code examples
   RULES: Generate practical implementation plan and save to .workflow/${session_id}/.process/implementation-plan.md
   " -s danger-full-access
   ```

2. **Code Quality Assessment**
   ```bash
   codex --full-auto exec "
   PURPOSE: Assess current code quality and identify optimization opportunities
   TASK: Evaluate codebase quality related to '${task_description}'
   CONTEXT: @{**/*${keywords}*,.workflow/${session_id}/.process/design-blueprint.md}
   EXPECTED: Quality assessment report with optimization recommendations
   RULES: Focus on maintainability, performance, and security. Save to .workflow/${session_id}/.process/quality-assessment.md
   " -s danger-full-access
   ```

### Phase 4: Synthesis & Final Analysis
1. **Comprehensive Analysis Document Generation**
   ```bash
   cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
   PURPOSE: Synthesize all analysis results into comprehensive final document
   TASK: Combine all generated analysis documents into unified comprehensive analysis
   CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,.workflow/${session_id}/.process/design-blueprint.md,.workflow/${session_id}/.process/implementation-plan.md,.workflow/${session_id}/.process/quality-assessment.md}
   EXPECTED: Single comprehensive analysis document with executive summary, detailed findings, and actionable recommendations
   RULES: Create synthesis of all previous analysis. Structure: Executive Summary, Key Findings, Design Recommendations, Implementation Strategy, Quality Improvements, Next Steps
   " > ".workflow/${session_id}/.process/comprehensive-analysis.md"
   ```

2. **Context Package Generation**
   ```bash
   # Generate the final context-package.json based on all analysis
   cat > ".workflow/${session_id}/.process/context-package.json" << EOF
   {
     "metadata": {
       "task_description": "${task_description}",
       "timestamp": "$(date -Iseconds)",
       "session_id": "${session_id}",
       "analysis_files": [
         "gemini-analysis.md",
         "design-blueprint.md",
         "implementation-plan.md",
         "quality-assessment.md",
         "comprehensive-analysis.md"
       ]
     },
     "generated_analysis": {
       "improvement_suggestions": ".workflow/${session_id}/.process/gemini-analysis.md",
       "design_blueprint": ".workflow/${session_id}/.process/design-blueprint.md",
       "implementation_plan": ".workflow/${session_id}/.process/implementation-plan.md",
       "quality_assessment": ".workflow/${session_id}/.process/quality-assessment.md",
       "comprehensive_analysis": ".workflow/${session_id}/.process/comprehensive-analysis.md"
     }
   }
   EOF
   ```

## Enhanced Context Package Format

Generated context package format with analysis documents:

```json
{
  "metadata": {
    "task_description": "Implement user authentication system",
    "timestamp": "2025-09-29T10:30:00Z",
    "session_id": "WFS-user-auth",
    "execution_method": "gemini_codex_analysis",
    "analysis_files": [
      "gemini-analysis.md",
      "design-blueprint.md",
      "implementation-plan.md",
      "quality-assessment.md",
      "comprehensive-analysis.md"
    ]
  },
  "generated_analysis": {
    "improvement_suggestions": {
      "file": ".workflow/WFS-user-auth/.process/gemini-analysis.md",
      "description": "Gemini-generated analysis with improvement recommendations",
      "tool": "gemini-wrapper"
    },
    "design_blueprint": {
      "file": ".workflow/WFS-user-auth/.process/design-blueprint.md",
      "description": "Architectural design blueprint with component diagrams",
      "tool": "gemini-wrapper"
    },
    "implementation_plan": {
      "file": ".workflow/WFS-user-auth/.process/implementation-plan.md",
      "description": "Step-by-step implementation roadmap with code examples",
      "tool": "codex"
    },
    "quality_assessment": {
      "file": ".workflow/WFS-user-auth/.process/quality-assessment.md",
      "description": "Code quality analysis and optimization recommendations",
      "tool": "codex"
    },
    "comprehensive_analysis": {
      "file": ".workflow/WFS-user-auth/.process/comprehensive-analysis.md",
      "description": "Synthesized final analysis document combining all findings",
      "tool": "gemini-wrapper"
    }
  },
  "process_workflow": {
    "phase_1": "Context collection with MCP tools",
    "phase_2": "Gemini analysis and design blueprint generation",
    "phase_3": "Codex implementation planning and quality assessment",
    "phase_4": "Synthesis into comprehensive analysis document"
  },
  "output_location": ".workflow/${session_id}/.process/",
  "final_deliverable": "comprehensive-analysis.md"
}
```

## Integration with MCP Tools

### Code Index Integration
```bash
# Set project path
mcp__code-index__set_project_path(path="{current_project_path}")

# Refresh index to ensure latest
mcp__code-index__refresh_index()

# Search relevant files
mcp__code-index__find_files(pattern="*{keyword}*")

# Search code content
mcp__code-index__search_code_advanced(
  pattern="{keyword_patterns}",
  file_pattern="*.{ts,js,py,go,md}",
  context_lines=3
)
```

### Exa Integration
```bash
# Get external code context
mcp__exa__get_code_context_exa(
  query="{task_type} {tech_stack} implementation examples",
  tokensNum="dynamic"
)

# Get best practices
mcp__exa__get_code_context_exa(
  query="{task_domain} best practices patterns",
  tokensNum="dynamic"
)
```

## Session ID Integration

### Session ID Usage
- **Required Parameter**: `--session WFS-session-id`
- **Session Context Loading**: Load existing session state and task summaries
- **Session Continuity**: Maintain context across pipeline phases

### Session State Management
```bash
# Validate session exists
if [ ! -d ".workflow/${session_id}" ]; then
  echo "❌ Session ${session_id} not found"
  exit 1
fi

# Load session metadata
session_metadata=".workflow/${session_id}/workflow-session.json"
```

## Output Location

Context package output location:
```
.workflow/{session_id}/.process/context-package.json
```

## Error Handling

### Common Error Handling
1. **No Active Session**: Create temporary session directory
2. **MCP Tools Unavailable**: Fallback to traditional bash commands
3. **Permission Errors**: Prompt user to check file permissions
4. **Large Project Optimization**: Limit file count, prioritize high-relevance files

### Graceful Degradation Strategy
```bash
# Fallback when MCP unavailable
if ! command -v mcp__code-index__find_files; then
  # Use find command
  find . -name "*{keyword}*" -type f
fi

# Use ripgrep instead of MCP search
rg "{keywords}" --type-add 'source:*.{ts,js,py,go}' -t source
```

## Performance Optimization

### Large Project Optimization Strategy
- **File Count Limit**: Maximum 50 files per type
- **Size Filtering**: Skip oversized files (>10MB)
- **Depth Limit**: Maximum search depth of 3 levels
- **Caching Strategy**: Cache project structure analysis results

### Parallel Processing
- Documentation collection and code search in parallel
- MCP tool calls and traditional commands in parallel
- Reduce I/O wait time

## Practical Execution Summary

### Quick Start CLI Commands
```bash
# Example usage for authentication task
session_id="WFS-user-auth"
task_description="Implement user authentication system"

# 1. Setup and context collection
mkdir -p ".workflow/${session_id}/.process"
~/.claude/scripts/get_modules_by_depth.sh

# 2. Gemini analysis and design
cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Deep analysis of task requirements and current codebase state
TASK: Analyze task '${task_description}' and generate improvement suggestions
CONTEXT: @{CLAUDE.md,README.md,**/*auth*} Current session: ${session_id}
EXPECTED: Detailed analysis with improvement suggestions
RULES: Generate specific improvement recommendations and save results
" > ".workflow/${session_id}/.process/gemini-analysis.md"

cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Create comprehensive design blueprint
TASK: Design architectural blueprint for '${task_description}'
CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,CLAUDE.md}
EXPECTED: Complete design blueprint with component diagrams
RULES: Create detailed design blueprint
" > ".workflow/${session_id}/.process/design-blueprint.md"

# 3. Codex implementation and quality
codex --full-auto exec "
PURPOSE: Generate implementation plan based on analysis
TASK: Create implementation roadmap for '${task_description}'
CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,.workflow/${session_id}/.process/design-blueprint.md}
EXPECTED: Step-by-step implementation plan with code examples
RULES: Generate practical implementation plan and save to .workflow/${session_id}/.process/implementation-plan.md
" -s danger-full-access

codex --full-auto exec "
PURPOSE: Assess code quality and optimization opportunities
TASK: Evaluate codebase quality related to '${task_description}'
CONTEXT: @{**/*auth*,.workflow/${session_id}/.process/design-blueprint.md}
EXPECTED: Quality assessment with optimization recommendations
RULES: Save to .workflow/${session_id}/.process/quality-assessment.md
" -s danger-full-access

# 4. Final synthesis
cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Synthesize all analysis results into comprehensive document
TASK: Combine all analysis documents into unified comprehensive analysis
CONTEXT: @{.workflow/${session_id}/.process/gemini-analysis.md,.workflow/${session_id}/.process/design-blueprint.md,.workflow/${session_id}/.process/implementation-plan.md,.workflow/${session_id}/.process/quality-assessment.md}
EXPECTED: Comprehensive analysis with executive summary and recommendations
RULES: Structure: Executive Summary, Key Findings, Design Recommendations, Implementation Strategy, Quality Improvements, Next Steps
" > ".workflow/${session_id}/.process/comprehensive-analysis.md"
```

### Expected Output Structure
```
.workflow/${session_id}/.process/
├── gemini-analysis.md           # Improvement suggestions
├── design-blueprint.md          # Architectural design
├── implementation-plan.md       # Implementation roadmap
├── quality-assessment.md        # Code quality analysis
├── comprehensive-analysis.md    # Final synthesis document
└── context-package.json        # Metadata package
```

## Success Criteria
- Generate comprehensive analysis documents in WFS `.process` directory
- Produce actionable improvement suggestions and design blueprints
- Create practical implementation plans with Codex
- Synthesize all findings into unified comprehensive analysis
- Complete execution within reasonable timeframe (5-10 minutes)

## Related Commands
- `/analysis:run` - Consumes output of this command for further analysis
- `/workflow:plan` - Integrates with this command for context gathering
- `/workflow:status` - Can display analysis generation status