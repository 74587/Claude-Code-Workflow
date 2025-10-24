---
name: artifacts
description: Interactive clarification generating confirmed guidance specification
argument-hint: "topic or challenge description"
allowed-tools: TodoWrite(*), Read(*), Write(*), AskUserQuestion(*), Glob(*)
---

## Overview

Five-phase workflow: Extract topic challenges → Select roles → Generate task-specific questions → Detect conflicts → Generate confirmed guidance (declarative statements only).

**Input**: `"GOAL: [objective] SCOPE: [boundaries] CONTEXT: [background]"`
**Output**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md` (CONFIRMED/SELECTED format)
**Core Principle**: Questions dynamically generated from topic keywords/challenges, NOT from generic templates

## Task Tracking

```json
[
  {"content": "Initialize session (.workflow/.active-* check)", "status": "pending", "activeForm": "Initializing"},
  {"content": "Phase 1: Extract challenges, generate 2-4 task-specific questions", "status": "pending", "activeForm": "Phase 1 topic analysis"},
  {"content": "Phase 2: Recommend 3-5 roles based on challenges, collect selection", "status": "pending", "activeForm": "Phase 2 role selection"},
  {"content": "Phase 3: Generate 3-5 task-specific questions per role", "status": "pending", "activeForm": "Phase 3 role questions"},
  {"content": "Phase 4: Detect conflicts in Phase 3 answers, generate clarifications", "status": "pending", "activeForm": "Phase 4 conflict resolution"},
  {"content": "Phase 5: Transform Q&A to declarative statements, write guidance-specification.md", "status": "pending", "activeForm": "Phase 5 document generation"}
]
```

## Execution Phases

### Session Management
- Check `.workflow/.active-*` markers first
- Multiple sessions → Prompt selection | Single → Use it | None → Create `WFS-[topic-slug]`
- Store decisions in `workflow-session.json`

### Phase 1: Topic Analysis & Intent Classification

**Goal**: Extract keywords/challenges to drive all subsequent question generation

**Steps**:
1. **Deep topic analysis**: Extract technical entities, identify core challenges (what makes this hard?), constraints (timeline/budget/compliance), success metrics (what defines done?)
2. **Generate 2-4 probing questions** targeting root challenges, trade-off priorities, and risk tolerance (NOT surface-level "Project Type")
3. AskUserQuestion → Store to `session.intent_context` with `{extracted_keywords, identified_challenges, user_answers}`

**Example (Task-Specific)**:
Topic: "Build real-time collaboration platform SCOPE: 100 users"
→ Extract: ["real-time", "collaboration", "100 users"]
→ Challenges: ["data sync", "scalability", "low latency"]
→ Generate: "PRIMARY technical challenge?" → [Real-time data sync / Scalability to 100+ users / Conflict resolution]

**⚠️ CRITICAL**: Questions MUST reference topic keywords. Generic "Project type?" violates dynamic generation.

### Phase 2: Role Selection

**Steps**:
1. Recommend 3-5 roles based on Phase 1 keywords:
   - **Technical** (architecture, system, database) → system-architect, data-architect
   - **API/Backend** (api, service, graphql) → api-designer, system-architect
   - **UX** (user, ui, design) → ui-designer, ux-expert, product-manager
   - **Business** (business, workflow) → product-manager, product-owner
   - **Agile** (sprint, scrum) → scrum-master, product-owner
2. AskUserQuestion (multiSelect) → Store to `session.selected_roles`

### Phase 3: Role-Specific Questions (Dynamic Generation)

**Goal**: Generate deep questions mapping role expertise to Phase 1 challenges

**Algorithm**:
```
FOR each selected role:
  1. Map Phase 1 challenges to role domain:
     - "real-time sync" + system-architect → State management pattern
     - "100 users" + system-architect → Communication protocol
     - "low latency" + system-architect → Conflict resolution

  2. Generate 3-5 questions probing implementation depth, trade-offs, edge cases:
     Q: "How handle real-time state sync for 100+ users?" (explores approach)
     Q: "How resolve conflicts when 2 users edit simultaneously?" (explores edge case)
     Options: [Event Sourcing/Centralized/CRDT] (concrete, explain trade-offs for THIS use case)

  3. AskUserQuestion → Store to session.role_decisions[role]
```

**Rules**:
- ✅ Questions MUST reference Phase 1 keywords (e.g., "real-time", "100 users")
- ✅ Options MUST be concrete approaches, explain relevance to topic
- ❌ NEVER generic "Architecture style?" without task context

**Examples by Role** (for "real-time collaboration platform"):
- **system-architect**: "State sync for 100+ users?" → [Event Sourcing/Centralized/CRDT]
- **ui-designer**: "How indicate real-time collaboration state?" → [Live cursors/Activity feed/Minimal indicators]
- **data-architect**: "Storage for concurrent editing?" → [PostgreSQL+CRDT/Redis+pub-sub/Event store]

### Phase 4: Cross-Role Clarification (Conflict Detection)

**Goal**: Resolve ACTUAL conflicts from Phase 3 answers, not pre-defined relationships

**Algorithm**:
```
1. Analyze Phase 3 answers for conflicts:
   - Contradictory choices: product-manager "fast iteration" vs system-architect "complex Event Sourcing"
   - Missing integration: ui-designer "Optimistic updates" but system-architect didn't address conflict handling
   - Implicit dependencies: ui-designer "Live cursors" but no auth approach defined

2. FOR each detected conflict:
   Generate 1-3 clarification questions referencing SPECIFIC Phase 3 choices

3. AskUserQuestion → Store to session.cross_role_decisions

4. If NO conflicts: Skip Phase 4 (inform user)
```

**Example Conflict**:
- Detect: system-architect "CRDT sync" (conflict-free) + ui-designer "Rollback on conflict" (expects conflicts)
- Generate: "CRDT conflicts with UI rollback expectation. Resolve?" → [CRDTs auto-merge/Show merge UI/Switch to OT]

**⚠️ CRITICAL**: NEVER use static "Cross-Role Matrix". ALWAYS analyze actual Phase 3 answers.

### Phase 5: Generate Guidance Specification

**Steps**:
1. Load all decisions: `intent_context` + `selected_roles` + `role_decisions` + `cross_role_decisions`
2. Transform Q&A pairs to declarative: Questions → Headers, Answers → CONFIRMED/SELECTED statements
3. Generate guidance-specification.md (template below)
4. Validate: No interrogative sentences, all decisions traceable

**⚠️ CRITICAL**: NO questions in output. Use CONFIRMED/SELECTED format only.

## Output Document Template

**File**: `.workflow/WFS-{topic}/.brainstorming/guidance-specification.md`

```markdown
# [Project] - Confirmed Guidance Specification

**Metadata**: [timestamp, type, focus, roles]

## 1. Project Positioning & Goals
**CONFIRMED Objectives**: [from topic + Phase 1]
**CONFIRMED Success Criteria**: [from Phase 1 answers]

## 2-N. [Role] Decisions
### SELECTED Choices
**[Question topic]**: [User's answer]
- **Rationale**: [From option description]
- **Impact**: [Implications]

### Cross-Role Considerations
**[Conflict resolved]**: [Resolution from Phase 4]
- **Affected Roles**: [Roles involved]

## Cross-Role Integration
**CONFIRMED Integration Points**: [API/Data/Auth from multiple roles]

## Risks & Constraints
**Identified Risks**: [From answers] → Mitigation: [Approach]

## Next Steps
**Immediate Actions**: [Derived from decisions]
**Recommended Workflow**:
```bash
/workflow:concept-clarify --session WFS-{id}  # Optional
/workflow:plan --session WFS-{id}
```

## Appendix: Decision Tracking
| Decision ID | Category | Question | Selected | Phase | Rationale |
|-------------|----------|----------|----------|-------|-----------|
| D-001 | Intent | [Q] | [A] | 1 | [Why] |
| D-002 | Roles | [Selected] | [Roles] | 2 | [Why] |
| D-003+ | [Role] | [Q] | [A] | 3 | [Why] |
```

## Question Generation Guidelines

### Core Principle
**Dynamic Generation from Topic**: Extract keywords → Map to roles → Generate task-specific questions

**Process**:
1. **Phase 1**: Extract challenges from topic → Generate questions about challenges (NOT "Project type?")
2. **Phase 3**: Map challenges to role expertise → Generate questions addressing role's challenge solution
3. **Phase 4**: Analyze Phase 3 answers → Detect conflicts → Generate resolution questions

**Anti-Pattern**:
```javascript

// ✅ CORRECT: Dynamic generation
function generate(role, challenges) {
  return challenges.map(c => mapChallengeToRoleQuestion(c, role, topic));
}
```

**Quality Rules**:
- ✅ Reference topic keywords in every question
- ✅ Options are concrete technical choices (not abstract categories)
- ✅ Descriptions explain relevance to topic
- ❌ Generic questions that apply to any project

**Examples** (Topic: "real-time collaboration, 100 users"):
- ❌ Generic: "Architecture style?" → [Microservices/Monolith/Hybrid]
- ✅ Task-specific: "State sync for 100+ real-time users?" → [Event Sourcing/Centralized/CRDT]

## Validation Checklist

Generated guidance-specification.md MUST:
- ✅ No interrogative sentences (use CONFIRMED/SELECTED)
- ✅ Every decision traceable to user answer
- ✅ Cross-role conflicts resolved or documented
- ✅ Next steps concrete and specific
- ✅ All Phase 1-4 decisions in session metadata

## Update Mechanism

```
IF guidance-specification.md EXISTS:
  Prompt: "Regenerate completely / Update sections / Cancel"
ELSE:
  Run full Phase 1-5 flow
```

## Governance Rules

**Output Requirements**:
- All decisions MUST use CONFIRMED/SELECTED (NO "?" in decision sections)
- Every decision MUST trace to user answer
- Conflicts MUST be resolved (not marked "TBD")
- Next steps MUST be actionable
- Topic preserved as authoritative reference in session

**CRITICAL**: Guidance is single source of truth for downstream phases. Ambiguity violates governance.

## File Structure

```
.workflow/WFS-[topic]/
├── .active-brainstorming
├── workflow-session.json              # All decisions
└── .brainstorming/
    └── guidance-specification.md      # Output
```

