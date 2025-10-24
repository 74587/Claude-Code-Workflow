---
name: synthesis
description: Analyze role analyses, identify ambiguities through clarification, and update role documents intelligently using conceptual-planning-agent
argument-hint: "[optional: --session session-id]"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*), Edit(*), Glob(*), AskUserQuestion(*)
---

## 🧩 **Role Analysis Clarification & Refinement**

### Core Function
**Specialized command for analyzing and refining role analysis documents** through intelligent clarification. Agent performs cross-role integration analysis, identifies ambiguities and gaps, interacts with user to clarify uncertainties, and intelligently updates relevant role analysis.md files.

**Dynamic Role Discovery**: Automatically detects which roles participated in brainstorming by scanning for `*/analysis.md` files. Analyzes only actual participating roles, not predefined lists.

### Primary Capabilities
- **Dynamic Role Discovery**: Automatically identifies participating roles at runtime
- **Cross-Role Integration Analysis**: Internal analysis of consistency, conflicts, and gaps across roles
- **Ambiguity Detection**: Systematic scanning using 8-category taxonomy (user intent, requirements, architecture, etc.)
- **Interactive Clarification**: Priority-based question queue (max 5 questions) with user interaction
- **Intelligent Document Update**: Agent autonomously determines which role documents to update based on clarification answers
- **User Intent Validation**: Ensures role analyses align with user's original goals

### Document Integration Model
**Role-Centric Architecture**:
1. **[role]/analysis.md** → Individual role analyses (input & output)
2. **guidance-specification.md** → Structured discussion framework (reference)
3. **User's Original Intent** → Primary alignment reference (from session metadata)
4. **Updated [role]/analysis.md** → Refined role analyses after clarification (output)

## ⚙️ **Execution Protocol**

### ⚠️ Agent Execution with Interactive Clarification
**Execution Model**: Uses conceptual-planning-agent for cross-role analysis, clarification generation, user interaction, and intelligent document updates.

**Rationale**:
- **Autonomous Analysis**: Agent independently loads and analyzes all role documents
- **Cognitive Complexity**: Leverages agent's capabilities for cross-role synthesis and ambiguity detection
- **Interactive Intelligence**: Agent manages question prioritization and document update decisions
- **Conceptual Focus**: Agent specializes in conceptual analysis and multi-perspective integration

**Agent Responsibility**: All file reading, analysis, clarification interaction, and document updates performed by conceptual-planning-agent.

### 📋 Task Tracking Protocol
Initialize clarification task tracking using TodoWrite at command start:
```json
[
  {"content": "Detect active session and validate role analyses existence", "status": "in_progress", "activeForm": "Detecting session and validating analyses"},
  {"content": "Discover participating role analyses dynamically", "status": "pending", "activeForm": "Discovering role analyses"},
  {"content": "Execute cross-role integration analysis using conceptual-planning-agent", "status": "pending", "activeForm": "Executing agent-based cross-role analysis"},
  {"content": "Execute CLI-powered concept enhancement analysis", "status": "pending", "activeForm": "Executing concept enhancement analysis"},
  {"content": "Present enhancement points and get user confirmation", "status": "pending", "activeForm": "Presenting enhancement points for user confirmation"},
  {"content": "Apply selected enhancements to role analysis documents", "status": "pending", "activeForm": "Applying selected enhancements"},
  {"content": "Agent performs ambiguity detection and generates clarification questions", "status": "pending", "activeForm": "Agent detecting ambiguities and generating questions"},
  {"content": "Interactive clarification loop with user (max 5 questions)", "status": "pending", "activeForm": "Interactive clarification with user"},
  {"content": "Agent intelligently updates relevant role analysis documents", "status": "pending", "activeForm": "Agent updating role documents"},
  {"content": "Update workflow-session.json with clarification completion status", "status": "pending", "activeForm": "Updating session metadata"}
]
```

### Phase 1: Document Discovery & Validation
```bash
# Detect active brainstorming session
IF --session parameter provided:
    session_id = provided session
ELSE:
    CHECK: .workflow/.active-* marker files
    IF active_session EXISTS:
        session_id = get_active_session()
    ELSE:
        ERROR: "No active brainstorming session found"
        EXIT

brainstorm_dir = .workflow/WFS-{session}/.brainstorming/

# Validate topic framework (optional but recommended)
CHECK: brainstorm_dir/guidance-specification.md
IF NOT EXISTS:
    WARN: "guidance-specification.md not found. Analysis will rely on role documents only."

# Validate role analyses exist
role_analyses = Glob(brainstorm_dir/*/analysis*.md)
IF role_analyses is empty:
    ERROR: "No role analysis files found. Run role brainstorming commands first."
    EXIT

# Load user's original prompt from session metadata
session_metadata = Read(.workflow/WFS-{session}/workflow-session.json)
original_user_intent = session_metadata.project || session_metadata.description
IF NOT original_user_intent:
    WARN: "No original user intent found in session metadata"
    original_user_intent = "Not available"
```

### Phase 2: Role Analysis Discovery
```bash
# Dynamically discover available role analyses
SCAN_DIRECTORY: .workflow/WFS-{session}/.brainstorming/
FIND_ANALYSES: [
    Scan all subdirectories for */analysis*.md files (supports analysis.md, analysis-1.md, analysis-2.md, analysis-3.md)
    Extract role names from directory names
]

# Available roles (for reference, actual participation is dynamic):
# - product-manager
# - product-owner
# - scrum-master
# - system-architect
# - ui-designer
# - ux-expert
# - data-architect
# - subject-matter-expert
# - test-strategist
# - api-designer

LOAD_DOCUMENTS: {
    "original_user_intent": original_user_intent (from session metadata),
    "topic_framework": guidance-specification.md (if exists),
    "role_analyses": [dynamically discovered analysis*.md files],
    "participating_roles": [extract role names from discovered directories]
}

# Note: Not all roles participate in every brainstorming session
# Only analyze roles that actually produced analysis*.md files
# Each role may have 1-3 analysis files: analysis.md OR analysis-1.md, analysis-2.md, analysis-3.md
# CRITICAL: Original user intent MUST be primary reference for validation
```

### Phase 3: Agent Execution with Interactive Clarification
**Clarification & Update using conceptual-planning-agent**

Delegate analysis, clarification, and update to conceptual-planning-agent:

```bash
Task(conceptual-planning-agent): "
[INTERACTIVE_CLARIFICATION_WORKFLOW]

Execute comprehensive cross-role analysis, ambiguity detection, user clarification, and intelligent document updates

## Context Loading
SESSION_ID: {session_id}
BRAINSTORM_DIR: .workflow/WFS-{session}/.brainstorming/
ANALYSIS_MODE: cross_role_clarification_and_update
MAX_QUESTIONS: 5

## ⚠️ CRITICAL: User Intent Authority
**ORIGINAL USER INTENT IS THE PRIMARY REFERENCE**: {original_user_intent}
All analysis and updates MUST align with user's original intent. Topic framework and role analyses are supplementary context.

## Workflow Steps

### Step 1: Load All Context Documents
1. **load_original_user_intent**
   - Action: Load user's original intent from session metadata
   - Command: Read(.workflow/WFS-{session}/workflow-session.json)
   - Extract: project field or description field
   - Output: original_user_intent (PRIMARY REFERENCE)
   - Priority: HIGHEST - This is the authoritative source of user intent

2. **load_topic_framework**
   - Action: Load structured topic discussion framework (optional)
   - Command: Read(.workflow/WFS-{session}/.brainstorming/guidance-specification.md) [if exists]
   - Output: topic_framework_content
   - Note: Validate alignment with original_user_intent

3. **discover_role_analyses**
   - Action: Dynamically discover all participating role analysis files (supports multiple files per role)
   - Command: Glob(.workflow/WFS-{session}/.brainstorming/*/analysis*.md)
   - Output: role_analysis_paths, participating_roles
   - Note: Each role may have 1-3 files (analysis.md OR analysis-1.md, analysis-2.md, analysis-3.md)

4. **load_role_analyses**
   - Action: Load all discovered role analysis documents
   - Command: Read(each path from role_analysis_paths)
   - Output: role_analyses_content_map = {role_name: [analysis_content_1, analysis_content_2, ...]}
   - Note: Maintain role-to-content mapping for intelligent updates

### Step 2: Cross-Role Integration Analysis (Internal)
Perform internal cross-role analysis following these steps (DO NOT OUTPUT TO USER):

1. **Consensus Identification**: Identify common themes and agreement areas across all participating roles
2. **Conflict Detection**: Document conflicting views and track which specific roles disagree on each point
3. **Gap Analysis**: Identify missing information, underspecified areas, and ambiguous points
4. **User Intent Alignment Check**: Validate all role analyses align with user's original intent
5. **Innovation Extraction**: Identify breakthrough ideas and cross-role synergy opportunities

### Step 2.5: Concept Enhancement (CLI-Powered)
Execute CLI-powered concept enhancement analysis to identify improvement opportunities:

**Purpose**: Enhance role analyses with deeper architectural insights and best practices

**CLI Execution**:
\`\`\`bash
cd .workflow/WFS-{session}/.brainstorming && gemini -p "
PURPOSE: Analyze role analyses for concept enhancement opportunities
TASK:
• Review all role analysis documents for architectural depth
• Identify underspecified design decisions
• Suggest concrete improvements with rationale
• Focus on technical feasibility and best practices
MODE: analysis
CONTEXT: @**/* @{session_metadata}
EXPECTED: Enhancement points list with specific recommendations
RULES: Focus on actionable improvements that add architectural value
" -m gemini-2.5-pro
\`\`\`

**Fallback**: If CLI unavailable, use Claude analysis with Read tool

**Enhancement Points Output**:
Generate list of enhancement opportunities:
\`\`\`markdown
### Enhancement Points

**EP-001: {title}**
- **Affected Roles**: {role_list}
- **Category**: {Architecture | Design | Requirements | Risk}
- **Current State**: {what_exists_now}
- **Enhancement**: {what_to_add_or_improve}
- **Rationale**: {why_this_improves_quality}
- **Priority**: {Critical | High | Medium}

**EP-002: {title}**
...
\`\`\`

**User Confirmation**:
Present enhancement points to user using AskUserQuestion:
- Show top 3-5 enhancement opportunities
- User selects which enhancements to apply
- User can skip all if satisfied with current analyses

**Apply Selected Enhancements**:
For each user-approved enhancement:
1. Identify affected role analysis files
2. Update relevant sections in analysis.md files
3. Add enhancement record to "## Enhancements" section
4. Maintain consistency across updated documents

**Enhancement Record Format**:
\`\`\`markdown
## Enhancements

### Session {date}
- **EP-001**: {title} - Applied to {section_name}
  - Enhancement: {brief_description}
\`\`\`

### Step 3: Ambiguity & Coverage Scan (Internal)
Perform structured scan using this taxonomy. For each category, mark status: **Clear** / **Partial** / **Missing**.

**⚠️ User Intent Alignment** (HIGHEST PRIORITY):
- [ ] Role analyses alignment with original user intent
- [ ] Goal consistency between analyses and user's stated objectives
- [ ] Scope match with user's requirements
- [ ] Success criteria reflects user's expectations
- [ ] Any unexplained deviations from user intent

**Requirements Clarity**:
- [ ] Functional requirements specificity and measurability
- [ ] Non-functional requirements with quantified targets
- [ ] Business requirements with success metrics
- [ ] Acceptance criteria completeness

**Architecture & Design Clarity**:
- [ ] Architecture decisions with rationale
- [ ] Data model completeness (entities, relationships, constraints)
- [ ] Technology stack justification
- [ ] Integration points and API contracts

**User Experience & Interface**:
- [ ] User journey completeness
- [ ] Critical interaction flows
- [ ] Error/edge case handling
- [ ] Accessibility and localization considerations

**Implementation Feasibility**:
- [ ] Team capability vs. required skills
- [ ] External dependencies and failure modes
- [ ] Resource constraints (timeline, personnel)
- [ ] Technical constraints and tradeoffs

**Risk & Mitigation**:
- [ ] Critical risks identified
- [ ] Mitigation strategies defined
- [ ] Success factors clarity
- [ ] Monitoring and quality gates

**Process & Collaboration**:
- [ ] Role responsibilities and handoffs
- [ ] Collaboration patterns defined
- [ ] Timeline and milestone clarity
- [ ] Dependency management strategy

**Decision Traceability**:
- [ ] Controversial points documented
- [ ] Alternatives considered and rejected
- [ ] Decision rationale clarity
- [ ] Consensus vs. dissent tracking

**Terminology & Consistency**:
- [ ] Canonical terms defined
- [ ] Consistent naming across role analyses
- [ ] No unresolved placeholders (TODO, TBD, ???)

### Step 4: Generate Prioritized Question Queue (Internal)
Internally generate prioritized queue of candidate questions (maximum 5):

**Constraints**:
- Maximum 5 questions per session
- Each question must be answerable with:
  * Multiple-choice (2-4 mutually exclusive options), OR
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

**If zero high-impact ambiguities found**: Report success and proceed to Step 7 (Session Metadata Update).

### Step 5: Sequential Clarification Loop (Interactive with User)
Present **EXACTLY ONE** question at a time using AskUserQuestion tool:

**Question Format Template**:
```markdown
**Question {N}/5**: {Question text}

**Category**: {Category name from taxonomy}
**Impact**: {Brief impact description}
**Affects Roles**: {List of roles that will be updated based on answer}

| Option | Description |
|--------|-------------|
| A | {Option A description} |
| B | {Option B description} |
| C | {Option C description} |
| D | {Option D description} |
```

**Answer Handling**:
- Record answer in working memory with metadata: {question, answer, affected_roles, category}
- Store in clarification_results array for later batch processing
- Proceed to next question immediately (DO NOT update documents yet)

**Stop Conditions**:
- All critical ambiguities resolved
- User signals completion ("done", "no more", "proceed")
- Reached 5 questions

**Never reveal future queued questions in advance**.

### Step 6: Intelligent Document Update (Batch Processing)
After all questions answered, process all clarifications in batch:

**For each clarification in clarification_results**:

1. **Determine Affected Roles** (Intelligent Judgment):
   - Analyze question category and answer content
   - Determine which role documents need updates
   - Example mapping:
     * Architecture questions → system-architect, data-architect
     * UX questions → ui-designer, ux-expert
     * Requirements questions → product-manager, product-owner
     * Process questions → scrum-master, product-manager
   - Cross-cutting concerns may update multiple roles

2. **Create Clarifications Section** (If Not Exists):
   ```bash
   FOR each affected role analysis file:
       IF file NOT contains "## Clarifications":
           Insert "## Clarifications" section after first heading

       IF NOT contains "### Session YYYY-MM-DD":
           Create "### Session {today's date}" under "## Clarifications"

       APPEND: "- **Q**: {question} ({category})"
       APPEND: "  **A**: {answer}"
   ```

3. **Apply Clarification to Relevant Sections**:
   ```bash
   CASE category:
       User Intent Alignment → Update "## Overview" or "## Executive Summary"
       Functional Requirements → Update "## Requirements" or "## Functional Specifications"
       Architecture → Update "## Architecture" or "## Design" sections
       User Experience → Update "## UI/UX" or "## User Experience" sections
       Risk → Update "## Risks" or "## Risk Assessment" sections
       Process → Update "## Process" or "## Implementation" sections
       Data Model → Update "## Data Model" or "## Database" sections
       Non-Functional → Update "## Non-Functional Requirements" or equivalent
   ```

4. **Remove Contradictions**:
   ```bash
   IF clarification invalidates existing statement:
       Replace statement instead of duplicating
       Mark removed content with comment: <!-- Superseded by clarification {date} -->
   ```

5. **Maintain Consistency**:
   - Update terminology throughout document if clarification defines canonical terms
   - Remove placeholders (TODO, TBD, ???) that were addressed
   - Ensure no contradictory statements remain

6. **Save Updates**:
   ```bash
   FOR each modified role analysis file:
       Write(file_path, updated_content)
   ```

### Step 7: Validation After Updates
Verify all updates meet quality standards:

- [ ] Clarifications section contains exactly one bullet per question per affected role
- [ ] Total asked questions ≤ 5
- [ ] Updated sections contain no lingering placeholders
- [ ] No contradictory earlier statements remain
- [ ] Markdown structure valid in all updated files
- [ ] Terminology consistent across all updated role analyses
- [ ] User intent alignment explicitly validated in affected documents

### Step 8: Completion Report
Generate comprehensive completion report for user:

```markdown
## ✅ Role Analysis Clarification Complete

**Session**: WFS-{session-id}
**Questions Asked**: {count}/5
**Role Documents Updated**: {list updated role names}
**Categories Clarified**: {list category names}

### Coverage Summary

| Category | Status | Notes |
|----------|--------|-------|
| User Intent Alignment | ✅ Resolved | Clarified {specific points} |
| Requirements Clarity | ✅ Clear | No ambiguities found |
| Architecture & Design | ⚠️ Partial | {specific gaps if any} |
| User Experience | ✅ Resolved | Updated UI/UX specs |
| Implementation Feasibility | ✅ Clear | Team capabilities validated |
| Risk & Mitigation | ✅ Resolved | Mitigation strategies defined |
| Process & Collaboration | ✅ Clear | Role handoffs clarified |
| Decision Traceability | ✅ Resolved | Alternatives documented |
| Terminology & Consistency | ✅ Resolved | Canonical terms defined |

**Legend**:
- ✅ Resolved: Was Partial/Missing, now addressed
- ✅ Clear: Already sufficient
- ⚠️ Partial: Some gaps remain (details below)

### Document Updates

| Role | Files Updated | Sections Modified |
|------|---------------|-------------------|
{For each updated role}
| {role_name} | {file_name} | {section_list} |

### Clarification Details

{For each clarification}
**Q{N}**: {question}
**A**: {answer}
**Updated Roles**: {affected_roles}
**Category**: {category}

### Recommendations

- ✅ **PROCEED to /workflow:plan**: Conceptual foundation is clear and refined
- OR ⚠️ **Address Outstanding Items First**: {list critical outstanding items if any}
- OR 🔄 **Run /workflow:brainstorm:synthesis Again**: If new information or roles added

### Next Steps

**Standard Workflow (Recommended)**:
```bash
/workflow:plan --session WFS-{session-id}  # Generate IMPL_PLAN.md and tasks from role analyses
```

**TDD Workflow**:
```bash
/workflow:tdd-plan --session WFS-{session-id} \"Feature description\"
```
```

## Completion Criteria
- ⚠️ **USER INTENT ALIGNMENT**: Role analyses align with user's original intent
- All participating role analyses loaded and analyzed
- Cross-role integration analysis completed (consensus, conflicts, gaps identified)
- Ambiguity scan completed across all 9 categories
- Clarification questions prioritized (if needed)
- User interaction completed (max 5 questions)
- Affected role documents intelligently updated
- Clarifications section added to updated documents
- Contradictions removed, terminology consistent
- Session metadata updated with clarification results

## Execution Notes
- Dynamic role participation: Only analyze roles that produced analysis.md files
- Internal analysis: Cross-role synthesis performed internally, not shown to user
- Interactive clarification: Present one question at a time
- Intelligent updates: Agent determines affected roles based on answer context
- Batch processing: Update all affected documents after all questions answered
- Timeout allocation: Complex clarification task (60-90 min recommended)
- Reference @intelligent-tools-strategy.md for timeout guidelines
"
```

## 📊 **Output Specification**

### Output Location
The clarification process **refines existing role analysis documents** without creating new consolidated files:

```
.workflow/WFS-{topic-slug}/.brainstorming/
├── guidance-specification.md              # Input: Framework structure (reference)
├── [role]/analysis*.md             # Input & OUTPUT: Role analyses 
```

#### Updated Role Analysis Structure
Each updated role analysis.md will contain:

**New Section - Clarifications**:
```markdown
## Clarifications

### Session 2025-01-15
- **Q**: {Question text} (Category: {category})
  **A**: {Answer}
- **Q**: {Question text} (Category: {category})
  **A**: {Answer}
```

**Updated Sections**: Existing sections refined based on clarifications:
- User intent alignment validated/corrected
- Requirements made more specific and measurable
- Architecture decisions clarified with rationale
- Ambiguities resolved, placeholders removed
- Terminology made consistent



## 🔄 **Session Integration**

### Streamlined Status Synchronization
Upon completion, update `workflow-session.json`:

**Dynamic Role Participation**: The `participating_roles` and `roles_updated` values are determined at runtime based on actual analysis.md files and clarification results.

```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "clarification_completed",
      "clarification_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["<dynamically-discovered-role-1>", "<dynamically-discovered-role-2>", "..."],
      "available_roles": ["product-manager", "product-owner", "scrum-master", "system-architect", "ui-designer", "ux-expert", "data-architect", "subject-matter-expert", "test-strategist", "api-designer"],
      "clarification_results": {
        "questions_asked": <count>,
        "categories_clarified": [<list of categories>],
        "roles_updated": [<list of updated role names>],
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

**Example with actual values**:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "clarification_completed",
      "participating_roles": ["product-manager", "system-architect", "ui-designer", "ux-expert", "scrum-master"],
      "clarification_results": {
        "questions_asked": 3,
        "categories_clarified": ["Architecture & Design", "User Experience", "Risk & Mitigation"],
        "roles_updated": ["system-architect", "ui-designer", "ux-expert"],
        "outstanding_items": []
      }
    }
  }
}
```

## ✅ **Quality Assurance**

Verify clarification output meets these standards:

### Content Completeness
- [ ] All participating role analyses loaded and analyzed
- [ ] Cross-role integration analysis completed (consensus, conflicts, gaps)
- [ ] Ambiguity scan completed across all 9 categories
- [ ] Clarification questions prioritized appropriately
- [ ] All clarifications documented in affected role documents

### Analysis Quality
- [ ] User intent alignment validated across all roles
- [ ] Cross-role synthesis identifies consensus and conflicts
- [ ] Ambiguities resolved through targeted clarification
- [ ] Intelligent role update decisions (correct roles updated)
- [ ] Terminology consistency enforced
- [ ] Contradictions removed from updated documents

### Document Quality
- [ ] Clarifications section properly formatted
- [ ] Updated sections reflect clarification answers
- [ ] No placeholders remain (TODO, TBD, ???)
- [ ] Markdown structure valid in all updated files
- [ ] Cross-references maintained

## 🚀 **Recommended Next Steps**

After clarification completion, proceed to planning:

### Standard Workflow (Recommended)
```bash
/workflow:plan --session WFS-{session-id}  # Generate IMPL_PLAN.md and tasks from refined role analyses
/workflow:action-plan-verify --session WFS-{session-id}  # Optional: Verify plan quality
/workflow:execute --session WFS-{session-id}  # Start implementation
```

### TDD Workflow
```bash
/workflow:tdd-plan --session WFS-{session-id} "Feature description"
/workflow:action-plan-verify --session WFS-{session-id}  # Optional: Verify plan quality
/workflow:execute --session WFS-{session-id}
```

