---
name: concept-clarify
description: Identify underspecified areas in brainstorming artifacts through targeted clarification questions before action planning
usage: /workflow:concept-clarify [--session <session-id>]
argument-hint: "optional: --session <session-id>"
examples:
  - /workflow:concept-clarify
  - /workflow:concept-clarify --session WFS-auth
allowed-tools: Read(*), Write(*), Edit(*), TodoWrite(*), Glob(*), Bash(*)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

**Goal**: Detect and reduce ambiguity or missing decision points in brainstorming artifacts (synthesis-specification.md, topic-framework.md, role analyses) before moving to action planning phase.

**Timing**: This command runs AFTER `/workflow:brainstorm:synthesis` and BEFORE `/workflow:plan`. It serves as a quality gate to ensure conceptual clarity before detailed task planning.

**Execution steps**:

1. **Session Detection & Validation**
   ```bash
   # Detect active workflow session
   IF --session parameter provided:
       session_id = provided session
   ELSE:
       CHECK: .workflow/.active-* marker files
       IF active_session EXISTS:
           session_id = get_active_session()
       ELSE:
           ERROR: "No active workflow session found. Use --session <session-id> or start a session."
           EXIT

   # Validate brainstorming completion
   brainstorm_dir = .workflow/WFS-{session}/.brainstorming/

   CHECK: brainstorm_dir/synthesis-specification.md
   IF NOT EXISTS:
       ERROR: "synthesis-specification.md not found. Run /workflow:brainstorm:synthesis first"
       EXIT

   CHECK: brainstorm_dir/topic-framework.md
   IF NOT EXISTS:
       WARN: "topic-framework.md not found. Verification will be limited."
   ```

2. **Load Brainstorming Artifacts**
   ```bash
   # Load primary artifacts
   synthesis_spec = Read(brainstorm_dir + "/synthesis-specification.md")
   topic_framework = Read(brainstorm_dir + "/topic-framework.md") # if exists

   # Discover role analyses
   role_analyses = Glob(brainstorm_dir + "/*/analysis.md")
   participating_roles = extract_role_names(role_analyses)
   ```

3. **Ambiguity & Coverage Scan**

   Perform structured scan using this taxonomy. For each category, mark status: **Clear** / **Partial** / **Missing**.

   **Requirements Clarity**:
   - Functional requirements specificity and measurability
   - Non-functional requirements with quantified targets
   - Business requirements with success metrics
   - Acceptance criteria completeness

   **Architecture & Design Clarity**:
   - Architecture decisions with rationale
   - Data model completeness (entities, relationships, constraints)
   - Technology stack justification
   - Integration points and API contracts

   **User Experience & Interface**:
   - User journey completeness
   - Critical interaction flows
   - Error/edge case handling
   - Accessibility and localization considerations

   **Implementation Feasibility**:
   - Team capability vs. required skills
   - External dependencies and failure modes
   - Resource constraints (timeline, personnel)
   - Technical constraints and tradeoffs

   **Risk & Mitigation**:
   - Critical risks identified
   - Mitigation strategies defined
   - Success factors clarity
   - Monitoring and quality gates

   **Process & Collaboration**:
   - Role responsibilities and handoffs
   - Collaboration patterns defined
   - Timeline and milestone clarity
   - Dependency management strategy

   **Decision Traceability**:
   - Controversial points documented
   - Alternatives considered and rejected
   - Decision rationale clarity
   - Consensus vs. dissent tracking

   **Terminology & Consistency**:
   - Canonical terms defined
   - Consistent naming across artifacts
   - No unresolved placeholders (TODO, TBD, ???)

   For each category with **Partial** or **Missing** status, add to candidate question queue unless:
   - Clarification would not materially change implementation strategy
   - Information is better deferred to planning phase

4. **Generate Prioritized Question Queue**

   Internally generate prioritized queue of candidate questions (maximum 5):

   **Constraints**:
   - Maximum 5 questions per session
   - Each question must be answerable with:
     * Multiple-choice (2-5 mutually exclusive options), OR
     * Short answer (≤5 words)
   - Only include questions whose answers materially impact:
     * Architecture decisions
     * Data modeling
     * Task decomposition
     * Risk mitigation
     * Success criteria
   - Ensure category coverage balance
   - Favor clarifications that reduce downstream rework risk

   **Prioritization Heuristic**:
   ```
   priority_score = (impact_on_planning * 0.4) +
                    (uncertainty_level * 0.3) +
                    (risk_if_unresolved * 0.3)
   ```

   If zero high-impact ambiguities found, proceed to **Step 8** (report success).

5. **Sequential Question Loop** (Interactive)

   Present **EXACTLY ONE** question at a time:

   **Multiple-choice format**:
   ```markdown
   **Question {N}/5**: {Question text}

   | Option | Description |
   |--------|-------------|
   | A | {Option A description} |
   | B | {Option B description} |
   | C | {Option C description} |
   | D | {Option D description} |
   | Short | Provide different answer (≤5 words) |
   ```

   **Short-answer format**:
   ```markdown
   **Question {N}/5**: {Question text}

   Format: Short answer (≤5 words)
   ```

   **Answer Validation**:
   - Validate answer maps to option or fits ≤5 word constraint
   - If ambiguous, ask quick disambiguation (doesn't count as new question)
   - Once satisfactory, record in working memory and proceed to next question

   **Stop Conditions**:
   - All critical ambiguities resolved
   - User signals completion ("done", "no more", "proceed")
   - Reached 5 questions

   **Never reveal future queued questions in advance**.

6. **Integration After Each Answer** (Incremental Update)

   After each accepted answer:

   ```bash
   # Ensure Clarifications section exists
   IF synthesis_spec NOT contains "## Clarifications":
       Insert "## Clarifications" section after "# [Topic]" heading

   # Create session subsection
   IF NOT contains "### Session YYYY-MM-DD":
       Create "### Session {today's date}" under "## Clarifications"

   # Append clarification entry
   APPEND: "- Q: {question} → A: {answer}"

   # Apply clarification to appropriate section
   CASE category:
       Functional Requirements → Update "## Requirements & Acceptance Criteria"
       Architecture → Update "## Key Designs & Decisions" or "## Design Specifications"
       User Experience → Update "## Design Specifications > UI/UX Guidelines"
       Risk → Update "## Risk Assessment & Mitigation"
       Process → Update "## Process & Collaboration Concerns"
       Data Model → Update "## Key Designs & Decisions > Data Model Overview"
       Non-Functional → Update "## Requirements & Acceptance Criteria > Non-Functional Requirements"

   # Remove obsolete/contradictory statements
   IF clarification invalidates existing statement:
       Replace statement instead of duplicating

   # Save immediately
   Write(synthesis_specification.md)
   ```

7. **Validation After Each Write**

   - [ ] Clarifications section contains exactly one bullet per accepted answer
   - [ ] Total asked questions ≤ 5
   - [ ] Updated sections contain no lingering placeholders
   - [ ] No contradictory earlier statements remain
   - [ ] Markdown structure valid
   - [ ] Terminology consistent across all updated sections

8. **Completion Report**

   After questioning loop ends or early termination:

   ```markdown
   ## ✅ Concept Verification Complete

   **Session**: WFS-{session-id}
   **Questions Asked**: {count}/5
   **Artifacts Updated**: synthesis-specification.md
   **Sections Touched**: {list section names}

   ### Coverage Summary

   | Category | Status | Notes |
   |----------|--------|-------|
   | Requirements Clarity | ✅ Resolved | Acceptance criteria quantified |
   | Architecture & Design | ✅ Clear | No ambiguities found |
   | Implementation Feasibility | ⚠️ Deferred | Team training plan to be defined in IMPL_PLAN |
   | Risk & Mitigation | ✅ Resolved | Critical risks now have mitigation strategies |
   | ... | ... | ... |

   **Legend**:
   - ✅ Resolved: Was Partial/Missing, now addressed
   - ✅ Clear: Already sufficient
   - ⚠️ Deferred: Low impact, better suited for planning phase
   - ❌ Outstanding: Still Partial/Missing but question quota reached

   ### Recommendations

   - ✅ **PROCEED to /workflow:plan**: Conceptual foundation is clear
   - OR ⚠️ **Address Outstanding Items First**: {list critical outstanding items}
   - OR 🔄 **Run /workflow:concept-clarify Again**: If new information available

   ### Next Steps
   ```bash
   /workflow:plan  # Generate IMPL_PLAN.md and task.json
   ```
   ```

9. **Update Session Metadata**

   ```json
   {
     "phases": {
       "BRAINSTORM": {
         "status": "completed",
         "concept_verification": {
           "completed": true,
           "completed_at": "timestamp",
           "questions_asked": 3,
           "categories_clarified": ["Requirements", "Risk", "Architecture"],
           "outstanding_items": [],
           "recommendation": "PROCEED_TO_PLANNING"
         }
       }
     }
   }
   ```

## Behavior Rules

- **If no meaningful ambiguities found**: Report "No critical ambiguities detected. Conceptual foundation is clear." and suggest proceeding to `/workflow:plan`.
- **If synthesis-specification.md missing**: Instruct user to run `/workflow:brainstorm:synthesis` first.
- **Never exceed 5 questions** (disambiguation retries don't count as new questions).
- **Respect user early termination**: Signals like "stop", "done", "proceed" should stop questioning.
- **If quota reached with high-impact items unresolved**: Explicitly flag them under "Outstanding" with recommendation to address before planning.
- **Avoid speculative tech stack questions** unless absence blocks conceptual clarity.

## Operating Principles

### Context Efficiency
- **Minimal high-signal tokens**: Focus on actionable clarifications
- **Progressive disclosure**: Load artifacts incrementally
- **Deterministic results**: Rerunning without changes produces consistent analysis

### Verification Guidelines
- **NEVER hallucinate missing sections**: Report them accurately
- **Prioritize high-impact ambiguities**: Focus on what affects planning
- **Use examples over exhaustive rules**: Cite specific instances
- **Report zero issues gracefully**: Emit success report with coverage statistics
- **Update incrementally**: Save after each answer to minimize context loss

## Context

{ARGS}
