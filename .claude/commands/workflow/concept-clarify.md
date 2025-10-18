---
name: concept-clarify
description: Identify underspecified areas in brainstorming artifacts through targeted clarification questions before action planning
argument-hint: "[optional: --session session-id]"
allowed-tools: Read(*), Write(*), Edit(*), TodoWrite(*), Glob(*), Bash(*)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

**Goal**: Detect and reduce ambiguity or missing decision points in planning artifacts before moving to task generation. Supports both brainstorm and plan workflows.

**Timing**:
- **Brainstorm mode**: Runs AFTER `/workflow:brainstorm:synthesis` and BEFORE `/workflow:plan`
- **Plan mode**: Runs AFTER Phase 3 (concept-enhanced) and BEFORE Phase 4 (task-generate) within `/workflow:plan`

This serves as a quality gate to ensure conceptual clarity before detailed task planning or generation.

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

   # Mode detection: plan vs brainstorm
   brainstorm_dir = .workflow/WFS-{session}/.brainstorming/
   process_dir = .workflow/WFS-{session}/.process/

   IF EXISTS(process_dir/ANALYSIS_RESULTS.md):
       clarify_mode = "plan"
       primary_artifact = process_dir/ANALYSIS_RESULTS.md
       INFO: "Plan mode: Analyzing ANALYSIS_RESULTS.md"
   ELSE IF EXISTS(brainstorm_dir/synthesis-specification.md):
       clarify_mode = "brainstorm"
       primary_artifact = brainstorm_dir/synthesis-specification.md
       INFO: "Brainstorm mode: Analyzing synthesis-specification.md"
   ELSE:
       ERROR: "No valid artifact found. Run /workflow:brainstorm:synthesis or /workflow:plan first"
       EXIT

   # Mode-specific validation
   IF clarify_mode == "brainstorm":
       CHECK: brainstorm_dir/topic-framework.md
       IF NOT EXISTS:
           WARN: "topic-framework.md not found. Verification will be limited."
   ```

2. **Load Artifacts (Mode-Aware)**
   ```bash
   # Load primary artifact (determined in step 1)
   primary_content = Read(primary_artifact)

   # Load mode-specific supplementary artifacts
   IF clarify_mode == "brainstorm":
       topic_framework = Read(brainstorm_dir + "/topic-framework.md") # if exists
       role_analyses = Glob(brainstorm_dir + "/*/analysis.md")
       participating_roles = extract_role_names(role_analyses)
   # Plan mode: primary_content (ANALYSIS_RESULTS.md) is self-contained
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
   IF primary_content NOT contains "## Clarifications":
       Insert "## Clarifications" section after first heading

   # Create session subsection
   IF NOT contains "### Session YYYY-MM-DD":
       Create "### Session {today's date}" under "## Clarifications"

   # Append clarification entry
   APPEND: "- Q: {question} → A: {answer}"

   # Apply clarification to appropriate section
   CASE category:
       Functional Requirements → Update "## Requirements" or equivalent section
       Architecture → Update "## Architecture" or "## Design" sections
       User Experience → Update "## UI/UX" or "## User Experience" sections
       Risk → Update "## Risks" or "## Risk Assessment" sections
       Process → Update "## Process" or "## Implementation" sections
       Data Model → Update "## Data Model" or "## Database" sections
       Non-Functional → Update "## Non-Functional Requirements" or equivalent

   # Remove obsolete/contradictory statements
   IF clarification invalidates existing statement:
       Replace statement instead of duplicating

   # Save immediately to primary_artifact
   Write(primary_artifact)
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
   **Mode**: {clarify_mode}
   **Questions Asked**: {count}/5
   **Artifacts Updated**: {primary_artifact filename}
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

   ```bash
   # Update metadata based on mode
   IF clarify_mode == "brainstorm":
       phase_key = "BRAINSTORM"
   ELSE: # plan mode
       phase_key = "PLAN"

   # Update session metadata
   {
     "phases": {
       "{phase_key}": {
         "status": "concept_verified",
         "concept_verification": {
           "completed": true,
           "completed_at": "timestamp",
           "mode": "{clarify_mode}",
           "questions_asked": {count},
           "categories_clarified": [{list}],
           "outstanding_items": [],
           "recommendation": "PROCEED" # or "ADDRESS_OUTSTANDING"
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
