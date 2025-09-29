---
name: artifacts
description: Generate structured topic-framework.md for role-based brainstorming analysis
usage: /workflow:brainstorm:artifacts "<topic>"
argument-hint: "topic or challenge description for framework generation"
examples:
  - /workflow:brainstorm:artifacts "Build real-time collaboration feature"
  - /workflow:brainstorm:artifacts "Optimize database performance for millions of users"
  - /workflow:brainstorm:artifacts "Implement secure authentication system"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Topic Framework Generator Command

## Usage
```bash
/workflow:brainstorm:artifacts "<topic>"
```

## Purpose
**Specialized command for generating structured topic-framework.md documents** that provide discussion frameworks for role-based brainstorming analysis. Creates the foundation document that all role agents will reference.

## Core Workflow

### Topic Framework Generation Process

**Phase 1: Session Management** ⚠️ FIRST STEP
- **Active session detection**: Check `.workflow/.active-*` markers
- **Session selection**: Prompt user if multiple active sessions found
- **Auto-creation**: Create `WFS-[topic-slug]` only if no active session exists
- **Framework check**: Check if `topic-framework.md` exists (update vs create mode)

**Phase 2: Interactive Topic Analysis**
- **Scope definition**: Define topic boundaries and objectives
- **Stakeholder identification**: Identify key users and stakeholders
- **Requirements gathering**: Extract core requirements and constraints
- **Context collection**: Gather technical and business context

**Phase 3: Structured Framework Generation**
- **Discussion points creation**: Generate 5 key discussion areas
- **Role-specific questions**: Create tailored questions for each relevant role
- **Framework document**: Generate structured `topic-framework.md`
- **Validation check**: Ensure framework completeness and clarity

**Phase 4: Update Mechanism**
- **Existing framework detection**: Check for existing framework
- **Incremental updates**: Add new discussion points if requested
- **Version tracking**: Maintain framework evolution history

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

**Primary Output**: Single structured `topic-framework.md` document

**Document Structure**:
```
.workflow/WFS-[topic]/.brainstorming/
├── topic-framework.md          # ★ STRUCTURED FRAMEWORK DOCUMENT
└── workflow-session.json               # Framework metadata and role assignments
```

**Topic Framework Template**:

### topic-framework.md Structure
```markdown
# [Topic] - Discussion Framework

## Topic Overview
- **Scope**: [Clear topic boundaries and scope definition]
- **Objectives**: [Primary goals and expected outcomes]
- **Context**: [Relevant background and constraints]
- **Stakeholders**: [Key users, roles, and affected parties]

## Key Discussion Points

### 1. Core Requirements
- What are the fundamental requirements?
- What are the critical success factors?
- What constraints must be considered?
- What acceptance criteria define success?

### 2. Technical Considerations
- What are the technical challenges?
- What architectural decisions are needed?
- What technology choices impact the solution?
- What integration points exist?

### 3. User Experience Factors
- Who are the primary users?
- What are the key user journeys?
- What usability requirements exist?
- What accessibility considerations apply?

### 4. Implementation Challenges
- What are the main implementation risks?
- What dependencies exist?
- What resources are required?
- What timeline constraints apply?

### 5. Success Metrics
- How will success be measured?
- What are the acceptance criteria?
- What performance requirements exist?
- What monitoring and analytics are needed?

## Role-Specific Analysis Points
- **System Architect**: Architecture patterns, scalability, technology stack
- **Product Manager**: Business value, user needs, market positioning
- **UI Designer**: User experience, interface design, usability
- **Security Expert**: Security requirements, threat modeling, compliance
- **Data Architect**: Data modeling, processing workflows, analytics
- **Business Analyst**: Process optimization, cost-benefit, change management

## Framework Usage Instructions
**For Role Agents**: Address each discussion point from your role perspective
**Reference Format**: Use @../topic-framework.md in your analysis.md
**Update Process**: Use /workflow:brainstorm:artifacts to update framework

---
*Generated by /workflow:brainstorm:artifacts*
*Last updated: [timestamp]*
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

## Update Mechanism ⚠️ SMART UPDATES

### Framework Update Logic
```bash
# Check existing framework
IF topic-framework.md EXISTS:
    SHOW current framework to user
    ASK: "Framework exists. Do you want to:"
    OPTIONS:
      1. "Replace completely" → Generate new framework
      2. "Add discussion points" → Append to existing
      3. "Refine existing points" → Interactive editing
      4. "Cancel" → Exit without changes
ELSE:
    CREATE new framework
```

### Update Strategies

**1. Complete Replacement**
- Backup existing framework as `topic-framework-[timestamp].md.backup`
- Generate completely new framework
- Preserve role-specific analysis points from previous version

**2. Incremental Addition**
- Load existing framework
- Identify new discussion areas through user interaction
- Add new sections while preserving existing structure
- Update framework usage instructions

**3. Refinement Mode**
- Interactive editing of existing discussion points
- Allow modification of scope, objectives, and questions
- Preserve framework structure and role assignments
- Update timestamp and version info

### Version Control
- **Backup Creation**: Always backup before major changes
- **Change Tracking**: Include change summary in framework footer
- **Rollback Support**: Keep previous version accessible

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