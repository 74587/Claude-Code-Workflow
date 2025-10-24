---
name: artifacts
description: Interactive clarification generating confirmed guidance specification
argument-hint: "topic or challenge description"
allowed-tools: TodoWrite(*), Read(*), Write(*), AskUserQuestion(*), Glob(*)
---

## Overview

Five-phase interactive workflow collecting user decisions through intelligent questioning, generating **confirmed guidance specification** with declarative statements (no questions).

**Input**: User topic description
**Output**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md` (CONFIRMED/SELECTED format)
**Key Process**: Intent classification → Role selection → Role questions → Cross-role clarification → Generate guidance document

**User Intent Preservation**: Topic description stored in session metadata as authoritative reference throughout workflow lifecycle.

## Usage

### Basic Command
```bash
/workflow:brainstorm:artifacts "<topic>"
```

### Recommended Structured Format
```bash
/workflow:brainstorm:artifacts "GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]"
```

### Example
```bash
/workflow:brainstorm:artifacts "GOAL: Build real-time collaboration platform SCOPE: Support 100 concurrent users CONTEXT: Existing monolithic architecture needs refactoring"
```

## Task Tracking

```json
[
  {"content": "Initialize session and check .workflow/.active-* markers", "status": "pending", "activeForm": "Initializing session"},
  {"content": "Phase 1: Generate and ask intent classification questions (2-3 questions)", "status": "pending", "activeForm": "Collecting intent classification"},
  {"content": "Phase 2: Recommend roles and collect user selection (3-5 roles, multiSelect)", "status": "pending", "activeForm": "Collecting role selection"},
  {"content": "Phase 3: Generate and ask role-specific questions (3-5 questions per role)", "status": "pending", "activeForm": "Collecting role-specific decisions"},
  {"content": "Phase 4: Generate and ask cross-role clarification questions (1-2 questions per role)", "status": "pending", "activeForm": "Collecting cross-role clarifications"},
  {"content": "Phase 5: Transform all answers to declarative statements and generate guidance-specification.md", "status": "pending", "activeForm": "Generating guidance document"},
  {"content": "Update workflow-session.json with all decisions and metadata", "status": "pending", "activeForm": "Updating session metadata"}
]
```

## Execution Phases

### Session Management (First Step)

**⚡ CRITICAL**: Check `.workflow/.active-*` markers before starting

**Logic**:
- Multiple active sessions → Prompt user to select
- Single active session → Use that session
- No active session → Create new `WFS-[topic-slug]`

**Session Storage**:
- Decision data: `workflow-session.json`
- Output file: `.brainstorming/guidance-specification.md`

### Phase 1: Intent Classification

**Purpose**: Understand project type and focus to customize subsequent questions

**Steps**:
1. Generate 2-3 classification questions based on user topic
2. Use AskUserQuestion to collect answers
3. Store to `session.intent_context`

**Question Types** (intelligently generated):
- **Project Type**: New feature / Optimization / Refactoring
- **Value Focus**: UX-driven / Technical capability / Business value
- **System Scale**: Small (MVP) / Medium / Large (Enterprise)

**Example**:
```javascript
AskUserQuestion({
  questions: [{
    question: "What is the project type?",
    header: "Project Type",
    multiSelect: false,
    options: [
      {label: "New Feature Development", description: "Build new features or products from scratch"},
      {label: "System Optimization", description: "Improve performance, experience, or architecture"},
      {label: "Architecture Migration", description: "Technology stack upgrade or system migration"}
    ]
  }]
  // ... 2-3 questions total
})
```

### Phase 2: Role Selection

**Purpose**: Determine which roles participate in analysis

**Steps**:
1. Analyze topic + Phase 1 results to recommend 3-5 relevant roles
2. Use AskUserQuestion (multiSelect) to collect user selection
3. Store to `session.selected_roles`

**Role Recommendation Logic** (keyword-based):
- **Technical**: architecture, system, performance, database → system-architect, data-architect, subject-matter-expert
- **API/Backend**: api, endpoint, rest, graphql, service → api-designer, system-architect, data-architect
- **UX**: user, ui, ux, design, experience → ui-designer, ux-expert, product-manager
- **Business**: business, process, workflow, cost → product-manager, product-owner
- **Agile**: sprint, scrum, team, delivery → scrum-master, product-owner

**Available Roles**:
- **Technical**: system-architect, data-architect, subject-matter-expert, api-designer
- **Product & Design**: ui-designer, ux-expert, product-manager, product-owner
- **Agile & Quality**: scrum-master, test-strategist

### Phase 3: Role-Specific Questions

**Purpose**: Collect professional domain decisions for each role

**Steps**:
FOR each role in selected_roles:
1. Generate 3-5 core questions based on (role + topic + intent_context)
2. Use AskUserQuestion to collect answers
3. Store to `session.role_decisions[role]`

**Question Rules**:
- Exactly 3 options per question (MECE principle)
- Concrete and actionable options
- Avoid vague options like "depends on situation"
- Use multiSelect: false

**Role Question Focus Areas**:

**system-architect**:
- Architecture style (microservices/monolith/hybrid)
- Data consistency (strong/eventual/hybrid)
- Performance priority (latency/throughput/resource)
- Deployment model (cloud-native/VM/serverless)

**ui-designer**:
- Visual style (minimalist/rich/professional)
- Component complexity (simple/moderate/complex)
- Design system maturity (full/basic/lightweight)
- Responsive strategy (mobile-first/desktop-first/adaptive)

**ux-expert**:
- User persona (novice/intermediate/expert)
- Interaction complexity (simple/rich/professional)
- Accessibility level (WCAG AA/AAA/basic)
- Testing strategy (comprehensive/targeted/minimal)

**product-manager**:
- MVP scope (minimal core/core+hooks/full feature set)
- Timeline expectation (fast iteration/standard/robust)
- Priority strategy (user value/technical debt/innovation)
- Success metrics (usage/satisfaction/revenue)

**data-architect**:
- Storage technology (relational/NoSQL/polyglot)
- Data model complexity (simple/moderate/complex domain)
- Analytics needs (basic/moderate/advanced)
- Compliance requirements (GDPR/HIPAA/none)

**Other roles** (api-designer, product-owner, scrum-master, subject-matter-expert, test-strategist): Similar 3-5 questions tailored to their domains.

**Example** (system-architect for "Build real-time collaboration platform"):
```javascript
AskUserQuestion({
  questions: [
    {
      question: "System architecture style preference?",
      header: "Architecture Style",
      multiSelect: false,
      options: [
        {label: "Microservices", description: "Independent service deployment, suitable for large teams"},
        {label: "Modular Monolith", description: "Single deployment unit, suitable for small to medium teams"},
        {label: "Hybrid Architecture", description: "Core monolith + partial microservices"}
      ]
    }
    // ... 3-5 questions total
  ]
})
```

### Phase 4: Cross-Role Clarification

**Purpose**: Ensure consistency across roles and identify potential conflicts

**Steps**:
FOR each role in selected_roles:
1. Generate 1-2 cross-role questions from perspectives of 2-3 related roles
2. Use AskUserQuestion to collect answers
3. Store to `session.cross_role_decisions[role]`

**Cross-Role Relationship Matrix**:

| Current Role | Question from Perspectives | Topics |
|--------------|---------------------------|--------|
| system-architect | ui-designer, product-manager, data-architect | Frontend stack, MVP scope, storage choice |
| ui-designer | ux-expert, system-architect, product-owner | Design system, technical constraints, feature priority |
| product-manager | system-architect, ux-expert, scrum-master | Technical feasibility, user pain points, delivery rhythm |
| ux-expert | ui-designer, product-manager, subject-matter-expert | Visual style, user goals, industry norms |
| data-architect | system-architect, subject-matter-expert, api-designer | Integration patterns, compliance requirements, API design |

**Example** (system-architect from ui-designer perspective):
```javascript
AskUserQuestion({
  questions: [{
    question: "Frontend technology stack choice? (Impacts frontend-backend separation strategy)",
    header: "Frontend Stack",
    multiSelect: false,
    options: [
      {label: "Modern Framework (React/Vue)", description: "Requires dedicated frontend team"},
      {label: "Server-Side Rendering (Next.js)", description: "SEO-friendly"},
      {label: "Lightweight (jQuery)", description: "Backend-driven"}
    ]
  }]
  // ... 1-2 questions per role
})
```

### Phase 5: Generate Guidance Specification

**Purpose**: Transform all user choices into confirmed guidance document with declarative statements

**Steps**:
1. Load all decisions from session metadata:
   - intent_context (Phase 1)
   - selected_roles (Phase 2)
   - role_decisions (Phase 3)
   - cross_role_decisions (Phase 4)

2. Transform Q&A pairs to declarative statements:
   - Questions → Section headers
   - User answers → CONFIRMED/SELECTED statements
   - Rationale from option descriptions

3. Generate document structure (see Output Document Template below)

4. Write to `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md`

5. Validate output (see Validation Checklist below)

**⚠️ CRITICAL CONSTRAINTS**:
- ❌ NEVER skip AskUserQuestion in Phase 1-4
- ❌ NEVER generate guidance-specification.md before Phase 5
- ❌ NEVER use interrogative sentences in guidance-specification.md
- ✅ ALWAYS collect user decisions through AskUserQuestion
- ✅ ALWAYS transform Q&A pairs to declarative statements

## Output Document Template

**File**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md`

```markdown
# [Project Name] - Confirmed Guidance Specification

**Generated**: [timestamp]
**Project Type**: [from Phase 1]
**Value Focus**: [from Phase 1]
**System Scale**: [from Phase 1]
**Participating Roles**: [from Phase 2]

---

## 1. Project Positioning & Goals

**CONFIRMED Objectives**:
- [Objective 1 from user topic + Phase 1 answers]
- [Objective 2]
- [Objective 3]

**CONFIRMED Success Criteria**:
- [Criterion 1 derived from Phase 1 answers]
- [Criterion 2]

---

## 2. [Role 1] Decisions

### SELECTED Choices

**[Question 1 topic]**: [User's selected option]
- **Rationale**: [From option description + Phase 1 context]
- **Impact**: [Implications for project]

**[Question 2 topic]**: [User's selected option]
- **Rationale**: [From option description]
- **Constraints**: [Technical/business constraints]

[... remaining role-specific questions]

### Cross-Role Considerations

**[Cross-role question topic]**: [User's selected option]
- **Affected Roles**: [Related roles from Phase 4]
- **Dependencies**: [How this impacts other roles]

---

## 3-N. [Role 2-N] Decisions

[Same structure as Role 1 for each participating role]

---

## Cross-Role Integration

**CONFIRMED Integration Points**:
- **API Style**: [Consolidated from api-designer + system-architect]
- **Data Format**: [From data-architect + api-designer]
- **Authentication**: [From system-architect + security considerations]
- **Collaboration Model**: [From scrum-master + product-owner]

**CONFIRMED Consistency Validations**:
- [Consistency check 1 from Phase 4 cross-role questions]
- [Consistency check 2]

---

## Risks & Constraints

**Identified Risks** (from user choices):
- **[Risk 1]**: [From Phase 3/4 answers] → Mitigation: [Approach]
- **[Risk 2]**: [From Phase 3/4 answers] → Mitigation: [Approach]

**CONFIRMED Constraints**:
- **Technical**: [From system-architect/data-architect answers]
- **Business**: [From product-manager answers]
- **Timeline**: [From Phase 1/product-manager answers]

---

## Next Steps

**Immediate Actions**:
1. [Action 1 derived from role decisions]
2. [Action 2 derived from cross-role integration]
3. [Action 3 for risk mitigation]

**Role Assignments**:
- **[Role 1]**: [Specific tasks from their decisions]
- **[Role 2]**: [Specific tasks from their decisions]

**Recommended Workflow**:
```
/workflow:concept-clarify --session WFS-{session-id}  # Optional: Further clarification
/workflow:plan --session WFS-{session-id}             # Generate IMPL_PLAN.md and tasks
/workflow:execute --session WFS-{session-id}          # Start implementation
```

---

## Appendix: Decision Tracking

| Decision ID | Category | Question | Selected Option | Phase | Rationale |
|-------------|----------|----------|-----------------|-------|-----------|
| D-001 | Intent | Project Type | [Answer] | Phase 1 | [Rationale] |
| D-002 | Roles | Participating Roles | [Roles] | Phase 2 | [Rationale] |
| D-003 | [Role] | [Question] | [Answer] | Phase 3 | [Rationale] |
| ... | ... | ... | ... | ... | ... |

**Open Items** (if any):
- [Item 1 requiring follow-up]
- [Item 2 requiring follow-up]
```

## Question Generation Guidelines

### Core Principle
All questions **intelligently generated** by Claude based on:
- Role professional domain
- User's topic description
- Previous decision context (Phase 1-4)
- No template library required - dynamic generation

### Phase 3 Generation Pattern
```
INPUT: role + topic + intent_context
OUTPUT: 3-5 questions, each with 3 MECE options

Example:
- Role: system-architect
- Topic: "Build real-time collaboration platform"
- Intent: {type: "new_feature", scale: "medium", focus: "technical"}

Generated Questions:
1. Architecture style? [Microservices/Modular Monolith/Hybrid]
2. Real-time communication tech? [WebSocket/SSE/Polling]
3. Data consistency? [Strong/Eventual/Hybrid]
4. Deployment model? [Cloud-native/Traditional VM/Serverless]
```

### Phase 4 Generation Pattern
```
INPUT: current_role + related_role + role_decisions + topic
OUTPUT: 1-2 questions from related_role perspective

Example:
- Current: system-architect
- Related: ui-designer
- Topic: "Build real-time collaboration platform"
- Context: ui-designer chose "Modern Framework (React)"

Generated Question:
"Frontend technology stack choice? (Impacts frontend-backend separation strategy)"
[Modern Framework/Server-Side Rendering/Lightweight]
```

## Validation Checklist

The generated guidance-specification.md MUST pass these checks:

✅ **No interrogative sentences**: Decision sections use CONFIRMED/SELECTED, not questions
✅ **Clear decisions**: Every decision point has explicit choice (not "TBD"/"Pending")
✅ **Traceable**: Every decision traces back to specific user answer
✅ **Cross-role consistency**: Cross-role decisions ≥ number of selected roles
✅ **Actionable**: Next steps are concrete and specific
✅ **Complete metadata**: All Phase 1-4 decisions stored in session

**Validation Process**: Execute checks after Phase 5, prompt user if issues found

## Update Mechanism

### Existing Guidance Update

```
IF guidance-specification.md EXISTS:
  SHOW current guidance summary to user
  ASK: "Guidance exists. Do you want to:"
  OPTIONS:
    1. "Regenerate completely" → Backup existing → Full Phase 1-5 flow
    2. "Update specific sections" → Target specific roles/decisions → Partial re-run
    3. "Cancel" → Exit without changes
ELSE:
  CREATE new guidance through full Phase 1-5 clarification
```

**Update Strategies**:
1. **Complete Regeneration**: Backup existing → Full clarification flow
2. **Targeted Update**: Re-run Phase 3/4 for specific roles only
3. **Incremental Addition**: Add new roles via Phase 2 → Phase 3 → Phase 4 for new roles

## Error Handling

| Error Type | Handling Strategy |
|-----------|-------------------|
| Session creation failed | Show error details + retry option + check .workflow/ permissions |
| AskUserQuestion timeout | Save progress to session + allow resumption from last completed Phase |
| Incomplete clarification | Mark open items in guidance document + suggest follow-up `/workflow:concept-clarify` |
| Conflicting decisions | Highlight conflicts in guidance document + show disagreeing roles + suggest resolution questions |

## Governance Rules

**GOVERNANCE_RULES** for guidance-specification.md output:

✅ **Declarative Statements Only**
- All decisions MUST use CONFIRMED/SELECTED format
- NO interrogative sentences (no "?" in decision sections)
- NO open questions or TBD items in confirmed decisions

✅ **Decision Traceability**
- Every decision MUST trace back to specific user answer
- Cross-reference to Phase 1-4 clarification responses
- Document rationale for each confirmed choice

✅ **Cross-Role Consistency**
- Cross-role decisions count ≥ number of selected roles
- Conflicts MUST be resolved or explicitly documented
- Dependencies between roles clearly stated

✅ **Actionability Requirements**
- Next steps MUST be concrete and specific
- Role assignments clearly defined
- Success criteria measurable and verifiable

✅ **Session Integrity**
- All decisions stored in `workflow-session.json`
- Topic description preserved as authoritative reference
- Session lifecycle properly managed (active markers, metadata)

**CRITICAL**: Generated guidance is the **single source of truth** for all downstream workflow phases. Any ambiguity violates governance rules and MUST be resolved before proceeding.

## File Structure

```
.workflow/WFS-[topic]/
├── .active-brainstorming              # Active session marker
├── workflow-session.json              # Session metadata with all decisions
└── .brainstorming/
    ├── guidance-specification.md      # ★ PRIMARY OUTPUT (declarative statements)
    └── [role]/                        # Role analysis directories (generated later by other commands)
        └── analysis.md
```


