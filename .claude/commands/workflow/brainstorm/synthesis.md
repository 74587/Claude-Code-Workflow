---
name: synthesis
description: Clarify and refine role analyses through intelligent Q&A and targeted updates
argument-hint: "[optional: --session session-id]"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Edit(*), Glob(*), AskUserQuestion(*)
---

## Overview

Three-phase workflow to eliminate ambiguities and enhance conceptual depth in role analyses:

**Phase 1-2 (Main Flow)**: Session detection → File discovery → Path preparation

**Phase 3A (Analysis Agent)**: Cross-role analysis → CLI concept enhancement → Generate recommendations

**Phase 4 (Main Flow)**: User selects enhancements → User answers clarifications → Build update plan

**Phase 5 (Parallel Update Agents)**: Each agent updates ONE role document → Parallel execution

**Phase 6 (Main Flow)**: Metadata update → Completion report

**Key Features**:
- Multi-agent architecture (analysis agent + parallel update agents)
- Clear separation: Agent analysis vs Main flow interaction
- CLI-powered concept enhancement (Gemini)
- Parallel document updates (one agent per role)
- User intent alignment validation

**Document Flow**:
- Input: `[role]/analysis*.md`, `guidance-specification.md`, session metadata
- Output: Updated `[role]/analysis*.md` with Enhancements + Clarifications sections

## Task Tracking

```json
[
  {"content": "Detect session and validate analyses", "status": "in_progress", "activeForm": "Detecting session"},
  {"content": "Discover role analysis file paths", "status": "pending", "activeForm": "Discovering paths"},
  {"content": "Execute analysis agent (cross-role + CLI enhancement)", "status": "pending", "activeForm": "Executing analysis agent"},
  {"content": "Present enhancements for user selection", "status": "pending", "activeForm": "Presenting enhancements"},
  {"content": "Generate and present clarification questions", "status": "pending", "activeForm": "Clarifying with user"},
  {"content": "Build update plan from user input", "status": "pending", "activeForm": "Building update plan"},
  {"content": "Execute parallel update agents (one per role)", "status": "pending", "activeForm": "Updating documents in parallel"},
  {"content": "Update session metadata and generate report", "status": "pending", "activeForm": "Finalizing session"}
]
```

## Execution Phases

### Phase 1: Discovery & Validation

1. **Detect Session**: Use `--session` parameter or `.workflow/.active-*` marker
2. **Validate Files**:
   - `guidance-specification.md` (optional, warn if missing)
   - `*/analysis*.md` (required, error if empty)
3. **Load User Intent**: Extract from `workflow-session.json` (project/description field)

### Phase 2: Role Discovery & Path Preparation

**Main flow prepares file paths for Agent**:

1. **Discover Analysis Files**:
   - Glob(.workflow/WFS-{session}/.brainstorming/*/analysis*.md)
   - Supports: analysis.md, analysis-1.md, analysis-2.md, analysis-3.md
   - Validate: At least one file exists (error if empty)

2. **Extract Role Information**:
   - `role_analysis_paths`: Relative paths from brainstorm_dir
   - `participating_roles`: Role names extracted from directory paths

3. **Pass to Agent** (Phase 3):
   - `session_id`
   - `brainstorm_dir`: .workflow/WFS-{session}/.brainstorming/
   - `role_analysis_paths`: ["product-manager/analysis.md", "system-architect/analysis-1.md", ...]
   - `participating_roles`: ["product-manager", "system-architect", ...]

**Main Flow Responsibility**: File discovery and path preparation only (NO file content reading)

### Phase 3A: Analysis & Enhancement Agent

**First agent call**: Cross-role analysis and generate enhancement recommendations

```bash
Task(conceptual-planning-agent): "
## Agent Mission
Analyze role documents, identify conflicts/gaps, and generate enhancement recommendations

## Input from Main Flow
- brainstorm_dir: {brainstorm_dir}
- role_analysis_paths: {role_analysis_paths}
- participating_roles: {participating_roles}

## Execution Instructions
[FLOW_CONTROL]

### Flow Control Steps
**AGENT RESPONSIBILITY**: Execute these analysis steps sequentially with context accumulation:

1. **load_session_metadata**
   - Action: Load original user intent as primary reference
   - Command: Read({brainstorm_dir}/../workflow-session.json)
   - Output: original_user_intent (from project/description field)

2. **load_role_analyses**
   - Action: Load all role analysis documents
   - Command: For each path in role_analysis_paths: Read({brainstorm_dir}/{path})
   - Output: role_analyses_content_map = {role_name: content}

3. **cross_role_analysis**
   - Action: Identify consensus themes, conflicts, gaps, underspecified areas
   - Output: consensus_themes, conflicting_views, gaps_list, ambiguities

4. **cli_concept_enhancement**
   - Action: Execute intelligent CLI analysis with fallback chain
   - Dynamic Prompt: \"PURPOSE: Cross-role synthesis | TASK: conflicts/gaps/enhancements | MODE: analysis | CONTEXT: @**/* | EXPECTED: EP-001,EP-002,... | RULES: Eliminate ambiguities\"
   - Fallback Chain: `cd {brainstorm_dir} && gemini -p \"$PROMPT\" -m gemini-2.5-pro` → (if fail) `qwen -p \"$PROMPT\"` → (if fail) `codex -C {brainstorm_dir} --full-auto exec \"$PROMPT\" -m gpt-5`
   - Error Handling: Gemini 429 OK if results exist | 40min timeout | One attempt per tool
   - Output: cli_enhancement_points

5. **generate_recommendations**
   - Action: Combine cross-role analysis + CLI enhancements into structured recommendations
   - Format: EP-001, EP-002, ... (sequential numbering)
   - Fields: id, title, affected_roles, category, current_state, enhancement, rationale, priority
   - Taxonomy: Map to 9 categories (User Intent, Requirements, Architecture, UX, Feasibility, Risk, Process, Decisions, Terminology)
   - Output: enhancement_recommendations (JSON array)

### Output to Main Flow
Return JSON array:
[
  {
    \"id\": \"EP-001\",
    \"title\": \"API Contract Specification\",
    \"affected_roles\": [\"system-architect\", \"api-designer\"],
    \"category\": \"Architecture\",
    \"current_state\": \"High-level API descriptions\",
    \"enhancement\": \"Add detailed contract definitions with request/response schemas\",
    \"rationale\": \"Enables precise implementation and testing\",
    \"priority\": \"High\"
  },
  ...
]

### Agent Context Summary
**Tools Used**: Gemini (primary) → Qwen (fallback) → Codex (last resort)
**Mode**: analysis (read-only)
**Timeout**: 40min
**Dependencies**: @intelligent-tools-strategy.md
**Validation**: Enhancement recommendations + 9-category taxonomy mapping
"
```

### Phase 4: Main Flow User Interaction

**Main flow handles all user interaction**:

1. **Present Enhancement Options**:
```python
AskUserQuestion(
  questions=[{
    "question": "Which enhancements would you like to apply?",
    "header": "Enhancements",
    "multiSelect": true,
    "options": [
      {"label": "EP-001: ...", "description": "... (affects: role1, role2)"},
      {"label": "EP-002: ...", "description": "..."},
      ...
    ]
  }]
)
```

2. **Generate Clarification Questions** (based on analysis agent output):
   - Use 9-category taxonomy scan results
   - Create max 5 prioritized questions
   - Each with 2-4 options + descriptions

3. **Interactive Clarification Loop**:
```python
# Present ONE question at a time
FOR question in clarification_questions (max 5):
  AskUserQuestion(
    questions=[{
      "question": "Question {N}/5: {text}",
      "header": "Clarification",
      "multiSelect": false,
      "options": [
        {"label": "Option A", "description": "..."},
        {"label": "Option B", "description": "..."},
        ...
      ]
    }]
  )
  # Record answer
  # Continue to next question
```

4. **Build Update Plan**:
```python
update_plan = {
  "role1": {
    "enhancements": [EP-001, EP-003],
    "clarifications": [
      {"question": "...", "answer": "...", "category": "..."},
      ...
    ]
  },
  "role2": {
    "enhancements": [EP-002],
    "clarifications": [...]
  },
  ...
}
```

### Phase 5: Parallel Document Update Agents

**Parallel agent calls** (one per role needing updates):

```bash
# Execute in parallel using single message with multiple Task calls

Task(conceptual-planning-agent): "
## Agent Mission
Apply user-confirmed enhancements and clarifications to {role1} analysis document

## Agent Intent
- **Goal**: Integrate synthesis results into role-specific analysis
- **Scope**: Update ONLY {role1}/analysis.md (isolated, no cross-role dependencies)
- **Constraints**: Preserve original insights, add refinements without deletion

## Input from Main Flow
- role: {role1}
- analysis_path: {brainstorm_dir}/{role1}/analysis.md
- enhancements: [EP-001, EP-003] (user-selected improvements)
- clarifications: [{question, answer, category}, ...] (user-confirmed answers)
- original_user_intent: {from session metadata}

## Execution Instructions
[FLOW_CONTROL]

### Flow Control Steps
**AGENT RESPONSIBILITY**: Execute these update steps sequentially:

1. **load_current_analysis**
   - Action: Load existing role analysis document
   - Command: Read({brainstorm_dir}/{role1}/analysis.md)
   - Output: current_analysis_content

2. **add_clarifications_section**
   - Action: Insert Clarifications section with Q&A
   - Format: \"## Clarifications\\n### Session {date}\\n- **Q**: {question} (Category: {category})\\n  **A**: {answer}\"
   - Output: analysis_with_clarifications

3. **apply_enhancements**
   - Action: Integrate EP-001, EP-003 into relevant sections
   - Strategy: Locate section by category (Architecture → Architecture section, UX → User Experience section)
   - Output: analysis_with_enhancements

4. **resolve_contradictions**
   - Action: Remove conflicts between original content and clarifications/enhancements
   - Output: contradiction_free_analysis

5. **enforce_terminology_consistency**
   - Action: Align all terminology with user-confirmed choices from clarifications
   - Output: terminology_consistent_analysis

6. **validate_user_intent_alignment**
   - Action: Verify all updates support original_user_intent
   - Output: validated_analysis

7. **write_updated_file**
   - Action: Save final analysis document
   - Command: Write({brainstorm_dir}/{role1}/analysis.md, validated_analysis)
   - Output: File update confirmation

### Output
Updated {role1}/analysis.md with Clarifications section + enhanced content
")

Task(conceptual-planning-agent): "
## Agent Mission
Apply user-confirmed enhancements and clarifications to {role2} analysis document

## Agent Intent
- **Goal**: Integrate synthesis results into role-specific analysis
- **Scope**: Update ONLY {role2}/analysis.md (isolated, no cross-role dependencies)
- **Constraints**: Preserve original insights, add refinements without deletion

## Input from Main Flow
- role: {role2}
- analysis_path: {brainstorm_dir}/{role2}/analysis.md
- enhancements: [EP-002] (user-selected improvements)
- clarifications: [{question, answer, category}, ...] (user-confirmed answers)
- original_user_intent: {from session metadata}

## Execution Instructions
[FLOW_CONTROL]

### Flow Control Steps
**AGENT RESPONSIBILITY**: Execute same 7 update steps as {role1} agent (load → clarifications → enhancements → contradictions → terminology → validation → write)

### Output
Updated {role2}/analysis.md with Clarifications section + enhanced content
")

# ... repeat for each role in update_plan
```

**Agent Characteristics**:
- **Intent**: Integrate user-confirmed synthesis results (NOT generate new analysis)
- **Isolation**: Each agent updates exactly ONE role (parallel execution safe)
- **Context**: Minimal - receives only role-specific enhancements + clarifications
- **Dependencies**: Zero cross-agent dependencies (full parallelism)
- **Validation**: All updates must align with original_user_intent

### Phase 6: Completion & Metadata Update

**Main flow finalizes**:

1. Wait for all parallel agents to complete
2. Update workflow-session.json:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "clarification_completed",
      "clarification_completed": true,
      "completed_at": "timestamp",
      "participating_roles": [...],
      "clarification_results": {
        "enhancements_applied": ["EP-001", "EP-002", ...],
        "questions_asked": 3,
        "categories_clarified": ["Architecture", "UX", ...],
        "roles_updated": ["role1", "role2", ...],
        "outstanding_items": []
      },
      "quality_metrics": {
        "user_intent_alignment": "validated",
        "requirement_coverage": "comprehensive",
        "ambiguity_resolution": "complete",
        "terminology_consistency": "enforced"
      }
    }
  }
}
```

3. Generate completion report (show to user):
```markdown
## ✅ Clarification Complete

**Enhancements Applied**: EP-001, EP-002, EP-003
**Questions Answered**: 3/5
**Roles Updated**: role1, role2, role3

### Next Steps
✅ PROCEED: `/workflow:plan --session WFS-{session-id}`
```

## Output

**Location**: `.workflow/WFS-{session}/.brainstorming/[role]/analysis*.md` (in-place updates)

**Updated Structure**:
```markdown
## Clarifications
### Session {date}
- **Q**: {question} (Category: {category})
  **A**: {answer}

## {Existing Sections}
{Refined content based on clarifications}
```

**Changes**:
- User intent validated/corrected
- Requirements more specific/measurable
- Architecture with rationale
- Ambiguities resolved, placeholders removed
- Consistent terminology

## Session Metadata

Update `workflow-session.json`:

```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "clarification_completed",
      "clarification_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["product-manager", "system-architect", ...],
      "clarification_results": {
        "questions_asked": 3,
        "categories_clarified": ["Architecture & Design", ...],
        "roles_updated": ["system-architect", "ui-designer", ...],
        "outstanding_items": []
      },
      "quality_metrics": {
        "user_intent_alignment": "validated",
        "requirement_coverage": "comprehensive",
        "ambiguity_resolution": "complete",
        "terminology_consistency": "enforced",
        "decision_transparency": "documented"
      }
    }
  }
}
```

## Quality Checklist

**Content**:
- All role analyses loaded/analyzed
- Cross-role analysis (consensus, conflicts, gaps)
- 9-category ambiguity scan
- Questions prioritized
- Clarifications documented

**Analysis**:
- User intent validated
- Cross-role synthesis complete
- Ambiguities resolved
- Correct roles updated
- Terminology consistent
- Contradictions removed

**Documents**:
- Clarifications section formatted
- Sections reflect answers
- No placeholders (TODO/TBD)
- Valid Markdown
- Cross-references maintained

## Next Steps

**Standard**:
```bash
/workflow:plan --session WFS-{session-id}
/workflow:action-plan-verify --session WFS-{session-id}  # Optional
/workflow:execute --session WFS-{session-id}
```

**TDD**:
```bash
/workflow:tdd-plan --session WFS-{session-id} "description"
/workflow:action-plan-verify --session WFS-{session-id}  # Optional
/workflow:execute --session WFS-{session-id}
```

