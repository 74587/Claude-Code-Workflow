---
name: artifacts
description: Generate role-specific topic-framework.md dynamically based on selected roles
usage: /workflow:brainstorm:artifacts "<topic>" [--roles "role1,role2,role3"]
argument-hint: "topic or challenge description for framework generation"
examples:
  - /workflow:brainstorm:artifacts "Build real-time collaboration feature"
  - /workflow:brainstorm:artifacts "Optimize database performance" --roles "system-architect,data-architect,subject-matter-expert"
  - /workflow:brainstorm:artifacts "Implement secure authentication system" --roles "ui-designer,ux-expert,subject-matter-expert"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Topic Framework Generator Command

## Usage
```bash
/workflow:brainstorm:artifacts "<topic>" [--roles "role1,role2,role3"]
```

## Purpose
**Generate dynamic topic-framework.md tailored to selected roles**. Creates role-specific discussion frameworks that address relevant perspectives. If no roles specified, generates comprehensive framework covering common analysis areas.

## Role-Based Framework Generation

**Dynamic Generation**: Framework content adapts based on selected roles
- **With roles**: Generate targeted discussion points for specified roles only
- **Without roles**: Generate comprehensive framework covering all common areas

## Core Workflow

### Topic Framework Generation Process

**Phase 1: Session Management** ⚠️ FIRST STEP
- **Active session detection**: Check `.workflow/.active-*` markers
- **Session selection**: Prompt user if multiple active sessions found
- **Auto-creation**: Create `WFS-[topic-slug]` only if no active session exists
- **Framework check**: Check if `topic-framework.md` exists (update vs create mode)

**Phase 2: Role Analysis** ⚠️ NEW
- **Parse roles parameter**: Extract roles from `--roles "role1,role2,role3"` if provided
- **Role validation**: Verify each role is valid (matches available role commands)
- **Store role list**: Save selected roles to session metadata for reference
- **Default behavior**: If no roles specified, use comprehensive coverage

**Phase 3: Dynamic Topic Analysis**
- **Scope definition**: Define topic boundaries and objectives
- **Stakeholder identification**: Identify key users and stakeholders based on selected roles
- **Requirements gathering**: Extract requirements relevant to selected roles
- **Context collection**: Gather context appropriate for role perspectives

**Phase 4: Role-Specific Framework Generation**
- **Discussion points creation**: Generate 3-5 discussion areas **tailored to selected roles**
- **Role-targeted questions**: Create questions specifically for chosen roles
- **Framework document**: Generate `topic-framework.md` with role-specific sections
- **Validation check**: Ensure framework addresses all selected role perspectives

**Phase 5: Metadata Storage**
- **Save role assignment**: Store selected roles in session metadata
- **Framework versioning**: Track which roles framework addresses
- **Update tracking**: Maintain role evolution if framework updated

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

## Framework Template Structures

### Dynamic Role-Based Framework

Framework content adapts based on `--roles` parameter:

#### Option 1: Specific Roles Provided
```markdown
# [Topic] - Discussion Framework

## Topic Overview
- **Scope**: [Topic boundaries relevant to selected roles]
- **Objectives**: [Goals from perspective of selected roles]
- **Context**: [Background focusing on role-specific concerns]
- **Target Roles**: ui-designer, system-architect, subject-matter-expert

## Role-Specific Discussion Points

### For UI Designer
1. **User Interface Requirements**
   - What interface components are needed?
   - What user interactions must be supported?
   - What visual design considerations apply?

2. **User Experience Challenges**
   - What are the key user journeys?
   - What accessibility requirements exist?
   - How to balance aesthetics with functionality?

### For System Architect
1. **Architecture Decisions**
   - What architectural patterns fit this solution?
   - What scalability requirements exist?
   - How does this integrate with existing systems?

2. **Technical Implementation**
   - What technology stack is appropriate?
   - What are the performance requirements?
   - What dependencies must be managed?

### For Subject Matter Expert
1. **Domain Expertise & Standards**
   - What industry standards and best practices apply?
   - What regulatory compliance requirements exist?
   - What domain-specific patterns should be followed?

2. **Technical Quality & Risk**
   - What technical debt considerations exist?
   - What scalability and maintenance implications apply?
   - What knowledge transfer and documentation is needed?

## Cross-Role Integration Points
- How do UI decisions impact architecture?
- How does architecture constrain UI possibilities?
- What domain standards affect both UI and architecture?

## Framework Usage
**For Role Agents**: Address your specific section + integration points
**Reference Format**: @../topic-framework.md in your analysis.md
**Update Process**: Use /workflow:brainstorm:artifacts to update

---
*Generated for roles: ui-designer, system-architect, subject-matter-expert*
*Last updated: [timestamp]*
```

#### Option 2: No Roles Specified (Comprehensive)
```markdown
# [Topic] - Discussion Framework

## Topic Overview
- **Scope**: [Comprehensive topic boundaries]
- **Objectives**: [All-encompassing goals]
- **Context**: [Full background and constraints]
- **Stakeholders**: [All relevant parties]

## Core Discussion Areas

### 1. Requirements & Objectives
- What are the fundamental requirements?
- What are the critical success factors?
- What constraints must be considered?

### 2. Technical & Architecture
- What are the technical challenges?
- What architectural decisions are needed?
- What integration points exist?

### 3. User Experience & Design
- Who are the primary users?
- What are the key user journeys?
- What usability requirements exist?

### 4. Security & Compliance
- What security requirements exist?
- What compliance considerations apply?
- What data protection is needed?

### 5. Implementation & Operations
- What are the implementation risks?
- What resources are required?
- How will this be maintained?

## Available Role Perspectives
Framework supports analysis from any of these roles:
- **Technical**: system-architect, data-architect, subject-matter-expert
- **Product & Design**: ui-designer, ux-expert, product-manager, product-owner
- **Agile & Quality**: scrum-master, test-strategist

---
*Comprehensive framework - adaptable to any role*
*Last updated: [timestamp]*
```

## Role-Specific Content Generation

### Available Roles and Their Focus Areas

**Technical Roles**:
- `system-architect`: Architecture patterns, scalability, technology stack, integration
- `data-architect`: Data modeling, processing workflows, analytics, storage
- `subject-matter-expert`: Domain expertise, industry standards, compliance, best practices

**Product & Design Roles**:
- `ui-designer`: User interface, visual design, interaction patterns, accessibility
- `ux-expert`: User experience optimization, usability testing, interaction design, design systems
- `product-manager`: Business value, feature prioritization, market positioning, roadmap
- `product-owner`: Backlog management, user stories, acceptance criteria, stakeholder alignment

**Agile & Quality Roles**:
- `scrum-master`: Sprint planning, team dynamics, process optimization, delivery management
- `test-strategist`: Testing strategies, quality assurance, test automation, validation approaches

### Dynamic Discussion Point Generation

**For each selected role, generate**:
1. **2-3 core discussion areas** specific to that role's perspective
2. **3-5 targeted questions** per discussion area
3. **Cross-role integration points** showing how roles interact

**Example mapping**:
```javascript
// If roles = ["ui-designer", "system-architect"]
Generate:
- UI Designer section: UI Requirements, UX Challenges
- System Architect section: Architecture Decisions, Technical Implementation
- Integration Points: UI↔Architecture dependencies
```

### Framework Generation Examples

#### Example 1: Architecture-Heavy Topic
```bash
/workflow:brainstorm:artifacts "Design scalable microservices platform" --roles "system-architect,data-architect,subject-matter-expert"
```
**Generated framework focuses on**:
- Service architecture and communication patterns
- Data flow and storage strategies
- Domain standards and best practices

#### Example 2: User-Focused Topic
```bash
/workflow:brainstorm:artifacts "Improve user onboarding experience" --roles "ui-designer,ux-expert,product-manager"
```
**Generated framework focuses on**:
- Onboarding flow and UI components
- User experience optimization and usability
- Business value and success metrics

#### Example 3: Agile Delivery Topic
```bash
/workflow:brainstorm:artifacts "Optimize sprint delivery process" --roles "scrum-master,product-owner,test-strategist"
```
**Generated framework focuses on**:
- Sprint planning and team collaboration
- Backlog management and prioritization
- Quality assurance and testing strategies

#### Example 4: Comprehensive Analysis
```bash
/workflow:brainstorm:artifacts "Build real-time collaboration feature"
```
**Generated framework covers** all aspects (no roles specified)

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