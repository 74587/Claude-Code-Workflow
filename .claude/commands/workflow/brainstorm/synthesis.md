---
name: synthesis
description: Generate synthesis-specification.md from topic-framework and role analyses with @ references using conceptual-planning-agent
argument-hint: "[optional: --session session-id]"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*), Read(*), Write(*)
---

## 🧩 **Synthesis Document Generator**

### Core Function
**Specialized command for generating synthesis-specification.md** that integrates topic-framework.md and all role analysis.md files using @ reference system. Creates comprehensive implementation specification with cross-role insights.

**Dynamic Role Discovery**: Automatically detects which roles participated in brainstorming by scanning for `*/analysis.md` files. Synthesizes only actual participating roles, not predefined lists.

### Primary Capabilities
- **Dynamic Role Discovery**: Automatically identifies participating roles at runtime
- **Framework Integration**: Reference topic-framework.md discussion points across all discovered roles
- **Role Analysis Integration**: Consolidate all discovered role/analysis.md files using @ references
- **Cross-Framework Comparison**: Compare how each participating role addressed framework discussion points
- **@ Reference System**: Create structured references to source documents
- **Update Detection**: Smart updates when new role analyses are added
- **Flexible Participation**: Supports any subset of available roles (1 to 9+)

### Document Integration Model
**Three-Document Reference System**:
1. **topic-framework.md** → Structured discussion framework (input)
2. **[role]/analysis.md** → Role-specific analyses addressing framework (input)
3. **synthesis-specification.md** → Complete integrated specification (output)

## ⚙️ **Execution Protocol**

### ⚠️ Agent Execution with Flow Control
**Execution Model**: Uses conceptual-planning-agent for synthesis generation with structured file loading.

**Rationale**:
- **Autonomous Execution**: Agent independently loads and processes all required documents
- **Flow Control**: Structured document loading ensures systematic analysis
- **Complex Cognitive Analysis**: Leverages agent's analytical capabilities for cross-role synthesis
- **Conceptual Focus**: Agent specializes in conceptual analysis and multi-perspective integration

**Agent Responsibility**: All file reading and synthesis generation performed by conceptual-planning-agent with FLOW_CONTROL instructions.

### 📋 Task Tracking Protocol
Initialize synthesis task tracking using TodoWrite at command start:
```json
[
  {"content": "Detect active session and validate topic-framework.md existence", "status": "in_progress", "activeForm": "Detecting session and validating framework"},
  {"content": "Discover participating role analyses dynamically", "status": "pending", "activeForm": "Discovering role analyses"},
  {"content": "Check existing synthesis and confirm user action", "status": "pending", "activeForm": "Checking update mechanism"},
  {"content": "Execute synthesis generation using conceptual-planning-agent with FLOW_CONTROL", "status": "pending", "activeForm": "Executing agent-based synthesis generation"},
  {"content": "Agent performs cross-role analysis and generates synthesis-specification.md", "status": "pending", "activeForm": "Agent analyzing and generating synthesis"},
  {"content": "Update workflow-session.json with synthesis completion status", "status": "pending", "activeForm": "Updating session metadata"}
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

# Validate required documents
CHECK: brainstorm_dir/topic-framework.md
IF NOT EXISTS:
    ERROR: "topic-framework.md not found. Run /workflow:brainstorm:artifacts first"
    EXIT

# Load user's original prompt from session metadata
session_metadata = Read(.workflow/WFS-{session}/workflow-session.json)
original_user_prompt = session_metadata.project || session_metadata.description
IF NOT original_user_prompt:
    WARN: "No original user prompt found in session metadata"
    original_user_prompt = "Not available"
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

LOAD_DOCUMENTS: {
    "original_user_prompt": original_user_prompt (from session metadata),
    "topic_framework": topic-framework.md,
    "role_analyses": [dynamically discovered analysis*.md files],
    "participating_roles": [extract role names from discovered directories],
    "existing_synthesis": synthesis-specification.md (if exists)
}

# Note: Not all roles participate in every brainstorming session
# Only synthesize roles that actually produced analysis*.md files
# Each role may have 1-3 analysis files: analysis.md OR analysis-1.md, analysis-2.md, analysis-3.md
# CRITICAL: Original user prompt MUST be primary reference for synthesis
```

### Phase 3: Update Mechanism Check
```bash
# Check for existing synthesis
IF synthesis-specification.md EXISTS:
    SHOW current synthesis summary to user
    ASK: "Synthesis exists. Do you want to:"
    OPTIONS:
      1. "Regenerate completely" → Create new synthesis
      2. "Update with new analyses" → Integrate new role analyses
      3. "Preserve existing" → Exit without changes
ELSE:
    CREATE new synthesis
```

### Phase 4: Agent Execution with Flow Control
**Synthesis Generation using conceptual-planning-agent**

Delegate synthesis generation to conceptual-planning-agent with structured file loading:

```bash
Task(conceptual-planning-agent): "
[FLOW_CONTROL]

Execute comprehensive synthesis generation from topic framework and role analyses

## Context Loading
OUTPUT_FILE: synthesis-specification.md
OUTPUT_PATH: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md
SESSION_ID: {session_id}
ANALYSIS_MODE: cross_role_synthesis

## ⚠️ CRITICAL: User Intent Authority
**ORIGINAL USER PROMPT IS THE PRIMARY REFERENCE**: {original_user_prompt}
All synthesis MUST align with user's original intent. Topic framework and role analyses are supplementary context.

## Flow Control Steps
1. **load_original_user_prompt**
   - Action: Load user's original intent from session metadata
   - Command: Read(.workflow/WFS-{session}/workflow-session.json)
   - Extract: project field or description field
   - Output: original_user_prompt (PRIMARY REFERENCE)
   - Priority: HIGHEST - This is the authoritative source of user intent

2. **load_topic_framework**
   - Action: Load structured topic discussion framework
   - Command: Read(.workflow/WFS-{session}/.brainstorming/topic-framework.md)
   - Output: topic_framework_content
   - Note: Validate alignment with original_user_prompt

3. **discover_role_analyses**
   - Action: Dynamically discover all participating role analysis files (supports multiple files per role)
   - Command: Glob(.workflow/WFS-{session}/.brainstorming/*/analysis*.md)
   - Output: role_analysis_paths, participating_roles
   - Note: Each role may have 1-3 files (analysis.md OR analysis-1.md, analysis-2.md, analysis-3.md)

4. **load_role_analyses**
   - Action: Load all discovered role analysis documents
   - Command: Read(each path from role_analysis_paths)
   - Output: role_analyses_content
   - Note: Filter insights relevant to original_user_prompt

5. **check_existing_synthesis**
   - Action: Check if synthesis-specification.md already exists
   - Command: Read(.workflow/WFS-{session}/.brainstorming/synthesis-specification.md) [if exists]
   - Output: existing_synthesis_content [optional]

6. **load_synthesis_template**
   - Action: Load synthesis role template for structure and guidelines
   - Command: Read(~/.claude/workflows/cli-templates/planning-roles/synthesis-role.md)
   - Output: synthesis_template_guidelines

## Synthesis Requirements

### ⚠️ PRIMARY REQUIREMENT: User Intent Alignment
**User's Original Goal is Supreme**: Synthesis MUST directly address {original_user_prompt}
**Intent Validation**: Every requirement, design decision, and recommendation must trace back to user's original intent
**Deviation Detection**: Flag any role analysis points that drift from user's stated goals
**Refocus Mechanism**: When role discussions diverge, explicitly refocus on original user prompt
**Traceability**: Each section should reference how it fulfills user's original intent

### Core Integration
**Cross-Role Analysis**: Integrate all discovered role analyses with comprehensive coverage
**Framework Integration**: Address how each role responded to topic-framework.md discussion points
**User Intent Filter**: Prioritize insights that directly serve user's original prompt
**Decision Transparency**: Document both adopted solutions and rejected alternatives with rationale
**Process Integration**: Include team capability gaps, process risks, and collaboration patterns
**Visual Documentation**: Include key diagrams (architecture, data model, user journey) via Mermaid
**Priority Matrix**: Create quantified recommendation matrix aligned with user's goals
**Actionable Plan**: Provide phased implementation roadmap addressing user's original objectives

### Cross-Role Analysis Process (Agent Internal Execution)
Perform systematic cross-role analysis following these steps:

1. **Data Collection**: Extract key insights, recommendations, concerns, and diagrams from each discovered role analysis
2. **Consensus Identification**: Identify common themes and agreement areas across all participating roles
3. **Disagreement Analysis**: Document conflicting views and track which specific roles disagree on each point
4. **Innovation Extraction**: Identify breakthrough ideas and cross-role synergy opportunities
5. **Priority Scoring**: Calculate multi-dimensional priority scores (impact, feasibility, effort, risk) for each recommendation
6. **Decision Matrix**: Create comprehensive evaluation matrix and sort recommendations by priority

## Synthesis Quality Standards
Follow synthesis-specification.md structure defined in synthesis-role.md template:
- Use template structure for comprehensive document organization
- Apply analysis guidelines for cross-role synthesis process
- Include all required sections from template (Executive Summary, Key Designs, Requirements, etc.)
- Follow @ reference system for traceability to source role analyses
- Apply quality standards from template (completeness, visual clarity, decision transparency)
- Validate output against template's output validation checklist

## Expected Deliverables
1. **synthesis-specification.md**: Complete integrated specification consolidating all role perspectives
2. **@ References**: Include cross-references to source role analyses
3. **Session Metadata Update**: Update workflow-session.json with synthesis completion status

## Completion Criteria
- ⚠️ **USER INTENT ALIGNMENT**: Synthesis directly addresses user's original prompt
- All discovered role analyses integrated without gaps
- Framework discussion points addressed across all roles
- **Intent traceability**: Each major section references user's original goals
- Controversial points documented with dissenting roles identified
- Process concerns (team capabilities, risks, collaboration) captured
- Quantified priority recommendations aligned with user's objectives
- Actionable implementation plan addressing user's stated goals
- Comprehensive risk assessment with mitigation strategies
- **Deviation warnings**: Any significant departures from user intent flagged explicitly

## Execution Notes
- Dynamic role participation: Only synthesize roles that produced analysis.md files
- Update mechanism: If synthesis exists, prompt user for regenerate/update/preserve decision
- Timeout allocation: Complex synthesis task (60-90 min recommended)
- Reference @intelligent-tools-strategy.md for timeout guidelines
"
```

## 📊 **Output Specification**

### Output Location
The synthesis process creates **one consolidated document** that integrates all role perspectives:

```
.workflow/WFS-{topic-slug}/.brainstorming/
├── topic-framework.md          # Input: Framework structure
├── [role]/analysis*.md         # Input: Role analyses (supports analysis.md or analysis-1/2/3.md per role)
└── synthesis-specification.md  # ★ OUTPUT: Complete integrated specification
```

#### synthesis-specification.md Structure

**Document Purpose**: Defines **"WHAT"** to build - comprehensive requirements and design blueprint.
**Scope**: High-level features, requirements, and design specifications. Does NOT include executable task breakdown (that's IMPL_PLAN.md's responsibility).

**Template Reference**: Complete document structure and content guidelines available in `synthesis-role.md` template, including:
- Executive Summary with strategic overview
- Key Designs & Decisions (architecture diagrams, ADRs, user journeys)
- Controversial Points & Alternatives (decision transparency)
- Requirements & Acceptance Criteria (Functional, Non-Functional, Business)
- Design Specifications (UI/UX, Architecture, Domain Expertise)
- Process & Collaboration Concerns (team skills, risks, patterns, constraints)
- Implementation Roadmap (high-level phases)
- Risk Assessment & Mitigation strategies

**Agent Usage**: The conceptual-planning-agent loads this template to understand expected structure and quality standards.

## 🔄 **Session Integration**

### Streamlined Status Synchronization
Upon completion, update `workflow-session.json`:

**Dynamic Role Participation**: The `participating_roles` and `roles_synthesized` values are determined at runtime based on actual analysis.md files discovered.

```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "completed",
      "synthesis_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["<dynamically-discovered-role-1>", "<dynamically-discovered-role-2>", "..."],
      "available_roles": ["product-manager", "product-owner", "scrum-master", "system-architect", "ui-designer", "ux-expert", "data-architect", "subject-matter-expert", "test-strategist"],
      "consolidated_output": {
        "synthesis_specification": ".workflow/WFS-{topic}/.brainstorming/synthesis-specification.md"
      },
      "synthesis_quality": {
        "role_integration": "complete",
        "requirement_coverage": "comprehensive",
        "decision_transparency": "alternatives_documented",
        "process_risks_identified": true,
        "implementation_readiness": "ready"
      },
      "content_metrics": {
        "roles_synthesized": "<COUNT(participating_roles)>",
        "functional_requirements": "<dynamic-count>",
        "non_functional_requirements": "<dynamic-count>",
        "business_requirements": "<dynamic-count>",
        "architecture_decisions": "<dynamic-count>",
        "controversial_points": "<dynamic-count>",
        "diagrams_included": "<dynamic-count>",
        "process_risks": "<dynamic-count>",
        "team_skill_gaps": "<dynamic-count>",
        "implementation_phases": "<dynamic-count>",
        "risk_factors_identified": "<dynamic-count>"
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
      "status": "completed",
      "participating_roles": ["product-manager", "system-architect", "ui-designer", "ux-expert", "scrum-master"],
      "content_metrics": {
        "roles_synthesized": 5,
        "functional_requirements": 18,
        "controversial_points": 2
      }
    }
  }
}
```

## ✅ **Quality Assurance**

Verify synthesis output meets these standards (detailed criteria in `synthesis-role.md` template):

### Content Completeness
- [ ] All discovered role analyses integrated without gaps
- [ ] Key designs documented (architecture diagrams, ADRs, user journeys via Mermaid)
- [ ] Controversial points captured with alternatives and rationale
- [ ] Process concerns included (team skills, risks, collaboration patterns)
- [ ] Requirements documented (Functional, Non-Functional, Business) with sources

### Analysis Quality
- [ ] Cross-role synthesis identifies consensus and conflicts
- [ ] Decision transparency documents both adopted and rejected alternatives
- [ ] Priority recommendations with multi-dimensional evaluation
- [ ] Implementation roadmap with phased approach
- [ ] Risk assessment with mitigation strategies
- [ ] @ references to source role analyses throughout

## 🚀 **Recommended Next Steps**

After synthesis completion, proceed to action planning:

### Standard Workflow (Recommended)
```bash
/workflow:concept-clarify --session WFS-{session-id}  # Optional: Clarify ambiguities
/workflow:plan --session WFS-{session-id}             # Generate IMPL_PLAN.md and tasks
/workflow:action-plan-verify --session WFS-{session-id}  # Optional: Verify plan quality
/workflow:execute --session WFS-{session-id}          # Start implementation
```

### TDD Workflow
```bash
/workflow:concept-clarify --session WFS-{session-id}  # Optional: Clarify ambiguities
/workflow:tdd-plan --session WFS-{session-id} "Feature description"
/workflow:action-plan-verify --session WFS-{session-id}  # Optional: Verify plan quality
/workflow:execute --session WFS-{session-id}
```
