---
name: artifacts
description: Topic discussion, decomposition, and analysis artifacts generation through structured inquiry
usage: /workflow:brainstorm:artifacts "<topic>"
argument-hint: "topic or challenge description for discussion and analysis"
examples:
  - /workflow:brainstorm:artifacts "Build real-time collaboration feature"
  - /workflow:brainstorm:artifacts "Optimize database performance for millions of users"
  - /workflow:brainstorm:artifacts "Implement secure authentication system"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Workflow Brainstorm Artifacts Command

## Usage
```bash
/workflow:brainstorm:artifacts "<topic>"
```

## Purpose
Dedicated command for topic discussion, decomposition, and analysis artifacts generation. This command focuses on interactive exploration and documentation creation without complex agent workflows.

## Core Workflow

### Discussion & Artifacts Generation Process

**0. Session Management** ⚠️ FIRST STEP
- **MCP Tools Integration**: Use Code Index for technical context, Exa for industry insights
- **Active session detection**: Check `.workflow/.active-*` markers
- **Session selection**: Prompt user if multiple active sessions found
- **Auto-creation**: Create `WFS-[topic-slug]` only if no active session exists
- **Context isolation**: Each session maintains independent analysis state

**1. Topic Discussion & Inquiry**
- **Interactive exploration**: Direct conversation about topic aspects
- **Structured questioning**: Key areas of investigation
- **Context gathering**: User input and requirements clarification
- **Perspective collection**: Multiple viewpoints and considerations

**2. Topic Decomposition**
- **Component identification**: Break down topic into key areas
- **Relationship mapping**: Connections between components
- **Priority assessment**: Importance and urgency evaluation
- **Constraint analysis**: Limitations and requirements

**3. Analysis Artifacts Generation**
- **Discussion summary**: `.workflow/WFS-[topic]/.brainstorming/discussion-summary.md` - Key points and insights
- **Component analysis**: `.workflow/WFS-[topic]/.brainstorming/component-analysis.md` - Detailed decomposition

## Implementation Standards

### Discussion-Driven Analysis
**Interactive Approach**: Direct conversation and exploration without predefined role constraints

**Process Flow**:
1. **Topic introduction**: Understanding scope and context
2. **Exploratory questioning**: Open-ended investigation
3. **Component identification**: Breaking down into manageable pieces
4. **Relationship analysis**: Understanding connections and dependencies
5. **Documentation generation**: Structured capture of insights

**Key Areas of Investigation**:
- **Functional aspects**: What the topic needs to accomplish
- **Technical considerations**: Implementation constraints and requirements
- **User perspectives**: How different stakeholders are affected
- **Business implications**: Cost, timeline, and strategic considerations
- **Risk assessment**: Potential challenges and mitigation strategies

### Document Generation Standards

**Always Created**:
- **discussion-summary.md**: Main conversation points and key insights
- **component-analysis.md**: Detailed breakdown of topic components

## Document Generation

**Workflow**: Topic Discussion → Component Analysis → Documentation

**Document Structure**:
```
.workflow/WFS-[topic]/.brainstorming/
├── discussion-summary.md       # Main conversation and insights
└── component-analysis.md       # Detailed topic breakdown
```

**Document Templates**:

### discussion-summary.md
```markdown
# Topic Discussion Summary: [topic]

## Overview
Brief description of the topic and its scope.

## Key Insights
- Major points discovered during discussion
- Important considerations identified
- Critical success factors

## Questions Explored
- Primary areas of investigation
- User responses and clarifications
- Open questions requiring further research

## Next Steps
- Recommended follow-up actions
- Areas needing deeper analysis
```

### component-analysis.md
```markdown
# Component Analysis: [topic]

## Core Components
Detailed breakdown of main topic elements:

### Component 1: [Name]
- **Purpose**: What it does
- **Dependencies**: What it relies on
- **Interfaces**: How it connects to other components

### Component 2: [Name]
- **Purpose**:
- **Dependencies**:
- **Interfaces**:

## Component Relationships
- How components interact
- Data flow between components
- Critical dependencies
```

## Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before processing
- **Multiple sessions support**: Different Claude instances can have different active sessions
- **User selection**: If multiple active sessions found, prompt user to select which one to work with
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists
- **Session continuity**: MUST use selected active session for all processing
- **Context preservation**: All discussion and analysis stored in session directory
- **Session isolation**: Each session maintains independent state

## Discussion Areas

### Core Investigation Topics
- **Purpose & Goals**: What are we trying to achieve?
- **Scope & Boundaries**: What's included and excluded?
- **Success Criteria**: How do we measure success?
- **Constraints**: What limitations exist?
- **Stakeholders**: Who is affected or involved?

### Technical Considerations
- **Requirements**: What must the solution provide?
- **Dependencies**: What does it rely on?
- **Integration**: How does it connect to existing systems?
- **Performance**: What are the speed/scale requirements?
- **Security**: What protection is needed?

### Implementation Factors
- **Timeline**: When is it needed?
- **Resources**: What people/budget/tools are available?
- **Risks**: What could go wrong?
- **Alternatives**: What other approaches exist?
- **Migration**: How do we transition from current state?

## Quality Standards

### Discussion Excellence
- **Comprehensive exploration**: Cover all relevant aspects of the topic
- **Clear documentation**: Capture insights in structured, readable format
- **Actionable outcomes**: Generate practical next steps and recommendations
- **User-driven**: Follow user interests and priorities in the discussion

### Documentation Quality
- **Structured format**: Use consistent templates for easy navigation
- **Complete coverage**: Document all important discussion points
- **Clear language**: Avoid jargon, explain technical concepts
- **Practical focus**: Emphasize actionable insights and recommendations

## Error Handling
- **Session creation failure**: Provide clear error message and retry option
- **Discussion stalling**: Offer structured prompts to continue exploration
- **Documentation issues**: Graceful handling of file creation problems
- **Missing context**: Prompt for additional information when needed

## Reference Information

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md
**Session Management**: Standard workflow session protocols

### Integration Points
- **Compatible with**: Other brainstorming commands in the same session
- **Builds foundation for**: More detailed planning and implementation phases
- **Outputs used by**: `/workflow:brainstorm:synthesis` command for cross-analysis integration