---
name: artifacts
description: Multi-phase clarification workflow generating confirmed guidance specification
argument-hint: "topic or challenge description for clarification"
allowed-tools: TodoWrite(*), Read(*), Write(*), AskUserQuestion(*), Bash(*), Glob(*)
---

# Brainstorm Clarification Command

## 📖 Overview

### Purpose
**Multi-phase interactive clarification workflow** that collects user decisions through intelligent questioning, generating a **confirmed guidance specification** (declarative statements) rather than open-ended questions (interrogative sentences).

### Core Philosophy Change
- ❌ **OLD**: Generate guidance-specification.md with open questions ("What are...?", "How should...?")
- ✅ **NEW**: Multi-step clarification → Generate guidance-specification.md with confirmed decisions

### User Intent Preservation
Topic description is stored in session metadata and serves as authoritative reference throughout workflow lifecycle.

---

## 🎯 Usage

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

---

## 🔄 Multi-Phase Workflow

### Workflow Diagram

```
Phase 1: Intent Classification
   │  (Understand project type and focus)
   │  → 2-3 questions, 3 choices each
   ↓
Phase 2: Role Selection
   │  (Determine participating roles)
   │  → Recommend 3-5 roles, multiSelect
   ↓
Phase 3: Role-Specific Questions
   │  (Collect professional domain decisions)
   │  → 3-5 questions per role, 3 choices each
   ↓
Phase 4: Cross-Role Clarification
   │  (Ensure inter-role consistency)
   │  → 1-2 questions per role from related role perspectives
   ↓
Phase 5: Generate Guidance Specification
   │  (Create confirmed guidance document)
   └─→ guidance-specification.md (declarative statements)
```

---

## 📋 Phase 1: Intent Classification

### Purpose
Understand project type and focus areas to customize subsequent questions.

### Implementation
Use **AskUserQuestion** tool to intelligently generate 2-3 classification questions based on user's topic description.

### Question Types (Intelligently Generated)
1. **Project Type**: New feature / Optimization / Refactoring
2. **Value Focus**: UX-driven / Technical capability / Business value
3. **System Scale**: Small (MVP) / Medium / Large (Enterprise)

### Output
- **intent_context**: Classification results
- Stored in session metadata for Phase 2-4 customization

### Example Flow
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
  // ... Generate 2-3 classification questions similarly
})
```

---

## 👥 Phase 2: Role Selection

### Purpose
Determine which roles should participate in analysis.

### Implementation Steps

**1. Analyze Topic + Phase 1 Results**
Intelligently recommend 3-5 relevant roles based on keywords.

**2. Role Recommendation Logic**
- **Technical keywords** (architecture, system, performance, database)
  → system-architect, data-architect, subject-matter-expert
- **API/Backend keywords** (api, endpoint, rest, graphql, service)
  → api-designer, system-architect, data-architect
- **UX keywords** (user, ui, ux, design, experience)
  → ui-designer, ux-expert, product-manager
- **Business keywords** (business, process, workflow, cost)
  → product-manager, product-owner
- **Agile keywords** (sprint, scrum, team, delivery)
  → scrum-master, product-owner

**3. Present to User**
Use AskUserQuestion with multiSelect for role selection.

### Available Roles

**Technical**: `system-architect`, `data-architect`, `subject-matter-expert`, `api-designer`
**Product & Design**: `ui-designer`, `ux-expert`, `product-manager`, `product-owner`
**Agile & Quality**: `scrum-master`, `test-strategist`

**Detailed role descriptions**: See "Reference Information > Available Roles Reference"

### Output
- **selected_roles**: List of user-selected roles
- Stored in session metadata

---

## 🎓 Phase 3: Role-Specific Professional Questions

### Purpose
Collect decisions for each role's professional domain.

### Implementation
For each selected role, **intelligently generate 3-5 core questions** based on:
- Role's professional expertise area
- User's topic description
- Phase 1 intent context

### Question Generation Rules
1. **Exactly 3 options** per question (MECE principle)
2. **Concrete and actionable** options
3. **Avoid vague options** like "depends on situation"
4. **Use AskUserQuestion** with multiSelect: false

### Role Question Focus Areas

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

**Other roles** (api-designer, product-owner, scrum-master, subject-matter-expert, test-strategist):
Similar 3-5 questions tailored to their domains.

### Example: System Architect Questions

For topic "Build real-time collaboration platform":

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
    // ... Generate 3-5 questions similarly
  ]
})
```

**Other roles**: Generate similarly based on professional domains (see "Role Question Focus Areas")

### Output
- **role_decisions**: Map of {role: [answers]} for all selected roles
- Stored in session metadata

---

## 🔗 Phase 4: Cross-Role Clarification Questions

### Purpose
Ensure consistency across roles and identify potential conflicts.

### Implementation
For each selected role, **intelligently generate 1-2 cross-role questions** from perspectives of 2-3 related roles.

### Cross-Role Relationship Matrix

| Current Role | Question from Role Perspectives | Question Topics |
|---------|------------------|---------|
| system-architect | ui-designer, product-manager, data-architect | Frontend stack, MVP scope, storage choice |
| ui-designer | ux-expert, system-architect, product-owner | Design system, technical constraints, feature priority |
| product-manager | system-architect, ux-expert, scrum-master | Technical feasibility, user pain points, delivery rhythm |
| ux-expert | ui-designer, product-manager, subject-matter-expert | Visual style, user goals, industry norms |
| data-architect | system-architect, subject-matter-expert, api-designer | Integration patterns, compliance requirements, API design |

### Example: Cross-Role Question

System-architect asking from ui-designer perspective:

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
  // ... 1-2 cross-role questions per role
})
```

### Output
- **cross_role_decisions**: Map of {role: {from_role: [answers]}}
- Stored in session metadata

---

## 📄 Phase 5: Generate Guidance Specification

### Purpose
Based on all user choices, generate a confirmed guidance document with **declarative statements**, not questions.

### Implementation
1. **Consolidate all decisions**:
   - intent_context (Phase 1)
   - selected_roles (Phase 2)
   - role_decisions (Phase 3)
   - cross_role_decisions (Phase 4)

2. **Generate guidance-specification.md** with confirmed decisions

### Output Document Structure

See **"Output Specification"** section below for complete template.

### Output Location
```
.workflow/WFS-[topic]/.brainstorming/guidance-specification.md
```

**Detailed file structure**: See "Reference Information > File Structure"

---

## 🔧 Implementation Details

### Session Management ⚠️ CRITICAL

**⚡ First Step**: Check `.workflow/.active-*` markers

**Logic**:
- Multiple active sessions → Prompt user to select
- Single active session → Use that session
- No active session → Create new `WFS-[topic-slug]`

**Session Data Storage**:
- Decision data: `workflow-session.json`
- Output file: `.brainstorming/guidance-specification.md`

### Implementation Workflow

**Execution Flow**:
1. **Session Management**: Detect or create session
2. **Phase 1**: Intent classification (2-3 questions)
3. **Phase 2**: Role selection (recommendations + multiSelect)
4. **Phase 3**: Role professional questions (3-5 questions per role)
5. **Phase 4**: Cross-role clarification (1-2 questions per role)
6. **Phase 5**: Generate guidance-specification.md
7. **Update Metadata**: Save all decisions to session

**TodoWrite tracking**: Update progress at each Phase

**Decision storage**: All user choices saved to `workflow-session.json`

---

## 🤖 Intelligent Question Generation

### Core Principle
All questions are **intelligently generated by Claude** based on:
- Role professional domain
- User's topic description
- Previous decision context
- Phase 1 intent classification

**No Template Library Required**: Questions are dynamically created to fit specific task context.

### Question Generation Guidelines

**For Phase 3 (Role Questions)**:
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

**For Phase 4 (Cross-Role Questions)**:
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

---

## ✅ Validation & Quality Assurance

### Output Validation

**Guidance Specification Must Contain**:
- ✅ **All declarative statements**: No question marks in decision sections
- ✅ **Clear decisions**: Every decision point has explicit choice
- ✅ **Decision traceability**: Can trace back to user answers
- ✅ **Cross-role consistency**: Conflicts resolved or noted
- ✅ **Actionability**: Next steps are clear

### Validation Checklist

The generated guidance-specification.md must pass these checks:

✅ **No interrogative sentences**: Decision sections should not end with question marks
✅ **Clear decisions**: Every decision point has explicit choice (not "TBD"/"Pending")
✅ **Traceable**: Every decision can be traced back to user answers
✅ **Cross-role consistency**: Cross-role decision count ≥ number of selected roles
✅ **Actionable**: "Next steps" are clear and specific

**Automatic validation**: Execute checks after generation, prompt if issues found

---

## 📝 Output Specification

### Document Structure Overview

**Output file**: `.workflow/WFS-[topic]/.brainstorming/guidance-specification.md`

### Template Structure

```markdown
# [Project] - Confirmed Guidance Specification

**Metadata**: [timestamp, type, focus, roles]

## 1. Project Positioning & Goals
**CONFIRMED**: [objectives, success criteria]

## 2-5. Role-Specific Decisions
Each participating role has one section containing:
- **SELECTED**: [confirmed choices]
- **Rationale**: [reasoning]
- **Constraints/Impact**: [implications]
- **Cross-Role Confirmed**: [dependencies]

## 6. Cross-Role Integration
**CONFIRMED**: [API style, data format, auth, collaboration model]

## 7. Risks & Constraints
**Identified**: [risks with mitigation, constraints]

## 8. Next Steps
**Immediate Actions**: [action items]
**Role Assignments**: [tasks per role]

## Appendix: Decision Tracking
**Key Decisions**: [table]
**Open Items**: [list]
```

**Core principles**:
- All decisions use declarative statements (CONFIRMED/SELECTED)
- Every decision is traceable to user answers
- Cross-role decisions ensure consistency
- Next steps are clear and specific

---

## 🔄 Update Mechanism

### Existing Guidance Update

```bash
IF guidance-specification.md EXISTS:
    SHOW current guidance summary to user
    ASK: "Guidance exists. Do you want to:"
    OPTIONS:
      1. "Regenerate completely" → Start full clarification flow
      2. "Update specific sections" → Target specific roles/decisions
      3. "Cancel" → Exit without changes
ELSE:
    CREATE new guidance through full clarification
```

**Update Strategies**:
1. **Complete Regeneration**: Backup existing → Full clarification flow
2. **Targeted Update**: Update specific role sections or cross-role decisions
3. **Incremental Addition**: Add new roles or decision areas

---

## ⚠️ Error Handling

| Error Type | Handling Strategy |
|-----------|-------------------|
| Session creation failed | Error details + retry option + check permissions |
| AskUserQuestion timeout | Save progress + allow resumption + provide instructions |
| Incomplete clarification | Mark open items + suggest follow-up clarification |
| Conflicting decisions | Highlight conflicts + show disagreeing roles + suggest resolution |

---

## 🔗 Integration with Downstream Workflow

### Core Principles & Governance Rules

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

---

### Next Steps After Guidance Generation

**Standard Workflow**:
```bash
/workflow:concept-clarify --session WFS-{session-id}           # Optional: Further clarification
/workflow:plan --session WFS-{session-id}                      # Generate IMPL_PLAN.md and tasks
/workflow:action-plan-verify --session WFS-{session-id}        # Optional: Verify plan quality
/workflow:execute --session WFS-{session-id}                   # Start implementation
```

---

## 📚 Reference Information

### File Structure
```
.workflow/WFS-[topic]/
├── workflow-session.json                    # Session metadata with all decisions
└── .brainstorming/
    ├── guidance-specification.md           # ★ PRIMARY OUTPUT (declarative statements)
    └── [role]/
        └── analysis.md                     # Role deepening analysis (generated later)
```

### Available Roles Reference

**Technical Roles**:
- `system-architect`: Architecture patterns, scalability, technology stack, integration
- `data-architect`: Data modeling, storage workflows, analytics, compliance
- `subject-matter-expert`: Domain expertise, industry standards, best practices
- `api-designer`: API design, versioning, contracts, authentication

**Product & Design Roles**:
- `ui-designer`: User interface, visual design, components, accessibility
- `ux-expert`: User experience, usability testing, interaction design, design systems
- `product-manager`: Business value, feature prioritization, market positioning, roadmap
- `product-owner`: Backlog management, user stories, acceptance criteria, stakeholder alignment

**Agile & Quality Roles**:
- `scrum-master`: Sprint planning, team dynamics, process optimization, delivery management
- `test-strategist`: Testing strategies, quality assurance, test automation, validation approaches

### Architecture Reference
- **Workflow Architecture**: @~/.claude/workflows/workflow-architecture.md
- **Clarification Plan**: @~/.claude/workflows/brainstorm-clarification-plan.md

### Related Commands
- `/workflow:brainstorm:auto-parallel` - Parallel role analysis execution
- `/workflow:brainstorm:synthesis` - Synthesize role analyses
- `/workflow:brainstorm:[role]` - Individual role analysis commands
- `/workflow:concept-clarify` - Further concept clarification
- `/workflow:plan` - Generate implementation plan
