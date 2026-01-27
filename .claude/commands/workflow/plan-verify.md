---
name: plan-verify
description: Perform READ-ONLY verification analysis between IMPL_PLAN.md, task JSONs, and brainstorming artifacts. Generates structured report with quality gate recommendation. Does NOT modify any files.
argument-hint: "[optional: --session session-id]"
allowed-tools: Read(*), Write(*), Glob(*), Bash(*)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Generate a comprehensive verification report that identifies inconsistencies, duplications, ambiguities, and underspecified items between action planning artifacts (`IMPL_PLAN.md`, `task.json`) and brainstorming artifacts (`role analysis documents`). This command MUST run only after `/workflow:plan` has successfully produced complete `IMPL_PLAN.md` and task JSON files.

**Output**: A structured Markdown report saved to `.workflow/active/WFS-{session}/.process/PLAN_VERIFICATION.md` containing:
- Executive summary with quality gate recommendation
- Detailed findings by severity (CRITICAL/HIGH/MEDIUM/LOW)
- Requirements coverage analysis
- Dependency integrity check
- Synthesis alignment validation
- Actionable remediation recommendations

## Operating Constraints

**STRICTLY READ-ONLY FOR SOURCE ARTIFACTS**:
- **MUST NOT** modify `IMPL_PLAN.md`, any `task.json` files, or brainstorming artifacts
- **MUST NOT** create or delete task files
- **MUST ONLY** write the verification report to `.process/PLAN_VERIFICATION.md`

**Synthesis Authority**: The `role analysis documents` are **authoritative** for requirements and design decisions. Any conflicts between IMPL_PLAN/tasks and synthesis are automatically CRITICAL and require adjustment of the plan/tasks—not reinterpretation of requirements.

**Quality Gate Authority**: The verification report provides a binding recommendation (BLOCK_EXECUTION / PROCEED_WITH_FIXES / PROCEED_WITH_CAUTION / PROCEED) based on objective severity criteria. User MUST review critical/high issues before proceeding with implementation.

## Execution Steps

### 1. Initialize Analysis Context

```bash
# Detect active workflow session
IF --session parameter provided:
    session_id = provided session
ELSE:
    # Auto-detect active session
    active_sessions = bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null)
    IF active_sessions is empty:
        ERROR: "No active workflow session found. Use --session <session-id>"
        EXIT
    ELSE IF active_sessions has multiple entries:
        # Use most recently modified session
        session_id = bash(ls -td .workflow/active/WFS-*/ 2>/dev/null | head -1 | xargs basename)
    ELSE:
        session_id = basename(active_sessions[0])

# Derive absolute paths
session_dir = .workflow/active/WFS-{session}
brainstorm_dir = session_dir/.brainstorming
task_dir = session_dir/.task
process_dir = session_dir/.process
session_file = session_dir/workflow-session.json

# Create .process directory if not exists (report output location)
IF NOT EXISTS(process_dir):
    bash(mkdir -p "{process_dir}")

# Validate required artifacts
# Note: "role analysis documents" refers to [role]/analysis.md files (e.g., product-manager/analysis.md)
SYNTHESIS_DIR = brainstorm_dir  # Contains role analysis files: */analysis.md
IMPL_PLAN = session_dir/IMPL_PLAN.md
TASK_FILES = Glob(task_dir/*.json)

# Abort if missing - in order of dependency
SESSION_FILE_EXISTS = EXISTS(session_file)
IF NOT SESSION_FILE_EXISTS:
    WARNING: "workflow-session.json not found. User intent alignment verification will be skipped."
    # Continue execution - this is optional context, not blocking

SYNTHESIS_FILES = Glob(brainstorm_dir/*/analysis.md)
IF SYNTHESIS_FILES.count == 0:
    ERROR: "No role analysis documents found in .brainstorming/*/analysis.md. Run /workflow:brainstorm:synthesis first"
    EXIT

IF NOT EXISTS(IMPL_PLAN):
    ERROR: "IMPL_PLAN.md not found. Run /workflow:plan first"
    EXIT

IF TASK_FILES.count == 0:
    ERROR: "No task JSON files found. Run /workflow:plan first"
    EXIT
```

### 2. Load Artifacts (Progressive Disclosure)

Load only minimal necessary context from each artifact:

**From workflow-session.json** (OPTIONAL - Primary Reference for User Intent):
- **ONLY IF EXISTS**: Load user intent context
- Original user prompt/intent (project or description field)
- User's stated goals and objectives
- User's scope definition
- **IF MISSING**: Set user_intent_analysis = "SKIPPED: workflow-session.json not found"

**From role analysis documents** (AUTHORITATIVE SOURCE):
- Functional Requirements (IDs, descriptions, acceptance criteria)
- Non-Functional Requirements (IDs, targets)
- Business Requirements (IDs, success metrics)
- Key Architecture Decisions
- Risk factors and mitigation strategies
- Implementation Roadmap (high-level phases)

**From IMPL_PLAN.md**:
- Summary and objectives
- Context Analysis
- Implementation Strategy
- Task Breakdown Summary
- Success Criteria
- Brainstorming Artifacts References (if present)

**From task.json files**:
- Task IDs
- Titles and descriptions
- Status
- Dependencies (depends_on, blocks)
- Context (requirements, focus_paths, acceptance, artifacts)
- Flow control (pre_analysis, implementation_approach)
- Meta (complexity, priority)

### 3. Build Semantic Models

Create internal representations (do not include raw artifacts in output):

**Requirements inventory**:
- Each functional/non-functional/business requirement with stable ID
- Requirement text, acceptance criteria, priority

**Architecture decisions inventory**:
- ADRs from synthesis
- Technology choices
- Data model references

**Task coverage mapping**:
- Map each task to one or more requirements (by ID reference or keyword inference)
- Map each requirement to covering tasks

**Dependency graph**:
- Task-to-task dependencies (depends_on, blocks)
- Requirement-level dependencies (from synthesis)

### 4. Detection Passes (Agent-Driven Multi-Dimensional Analysis)

**Execution Strategy**:
- Single `cli-explore-agent` invocation
- Agent executes multiple CLI analyses internally (different dimensions: A-H)
- Token Budget: 50 findings maximum (aggregate remainder in overflow summary)
- Priority Allocation: CRITICAL (unlimited) → HIGH (15) → MEDIUM (20) → LOW (15)
- Early Exit: If CRITICAL findings > 0 in User Intent/Requirements Coverage, skip LOW/MEDIUM checks

**Execution Order** (Agent orchestrates internally):

1. **Tier 1 (CRITICAL Path)**: A, B, C - User intent, coverage, consistency (full analysis)
2. **Tier 2 (HIGH Priority)**: D, E - Dependencies, synthesis alignment (limit 15 findings)
3. **Tier 3 (MEDIUM Priority)**: F - Specification quality (limit 20 findings)
4. **Tier 4 (LOW Priority)**: G, H - Duplication, feasibility (limit 15 findings)

---

#### Phase 4.1: Launch Unified Verification Agent

**Single Agent, Multi-Dimensional Analysis**:

```javascript
Task(
  subagent_type="cli-explore-agent",
  run_in_background=false,  // ⚠️ MANDATORY: Must wait for results
  description="Multi-dimensional plan verification",
  prompt=`
## Plan Verification Task

Execute comprehensive verification across dimensions A-H, using Gemini CLI for semantic analysis.

### MANDATORY FIRST STEPS
1. Read: ${session_file} (user intent/context)
2. Read: ${IMPL_PLAN} (implementation plan)
3. Glob: ${task_dir}/*.json (all task JSON files)
4. Glob: ${SYNTHESIS_DIR}/*/analysis.md (role analysis documents)
5. Read: \~/.claude/workflows/cli-templates/schemas/verify-json-schema.json (output schema reference)

### Output Location
${process_dir}/verification-findings.json

### Verification Dimensions

#### Dimension A: User Intent Alignment (CRITICAL - Tier 1)
- Goal Alignment: IMPL_PLAN objectives match user's original intent
- Scope Drift: Plan covers user's stated scope without unauthorized expansion
- Success Criteria Match: Plan's success criteria reflect user's expectations
- Intent Conflicts: Tasks contradicting user's original objectives

#### Dimension B: Requirements Coverage Analysis (CRITICAL - Tier 1)
- Orphaned Requirements: Requirements in synthesis with zero associated tasks
- Unmapped Tasks: Tasks with no clear requirement linkage
- NFR Coverage Gaps: Non-functional requirements not reflected in tasks

#### Dimension C: Consistency Validation (CRITICAL - Tier 1)
- Requirement Conflicts: Tasks contradicting synthesis requirements
- Architecture Drift: IMPL_PLAN architecture not matching synthesis ADRs
- Terminology Drift: Same concept named differently across artifacts
- Data Model Inconsistency: Tasks referencing entities/fields not in synthesis

#### Dimension D: Dependency Integrity (HIGH - Tier 2)
- Circular Dependencies: Cyclic task dependencies
- Missing Dependencies: Task requires outputs from another task but no explicit dependency
- Broken Dependencies: Task depends on non-existent task ID
- Logical Ordering Issues: Implementation tasks before foundational setup

#### Dimension E: Synthesis Alignment (HIGH - Tier 2)
- Priority Conflicts: High-priority synthesis requirements mapped to low-priority tasks
- Success Criteria Mismatch: IMPL_PLAN success criteria not covering synthesis acceptance criteria
- Risk Mitigation Gaps: Critical risks without corresponding mitigation tasks

#### Dimension F: Task Specification Quality (MEDIUM - Tier 3)
- Ambiguous Focus Paths: Tasks with vague/missing focus_paths
- Underspecified Acceptance: Tasks without clear acceptance criteria
- Missing Artifacts References: Tasks not referencing brainstorming artifacts
- Weak Flow Control: Tasks without clear implementation_approach or pre_analysis
- Missing Target Files: Tasks without flow_control.target_files

#### Dimension G: Duplication Detection (LOW - Tier 4)
- Overlapping Task Scope: Multiple tasks with nearly identical descriptions
- Redundant Requirements Coverage: Same requirement covered by multiple tasks

#### Dimension H: Feasibility Assessment (LOW - Tier 4)
- Complexity Misalignment: Task marked "simple" but requires multiple file modifications
- Resource Conflicts: Parallel tasks requiring same resources/files
- Skill Gap Risks: Tasks requiring unavailable team skills

### CLI Analysis Execution

**Execute Tier 1 Analysis (All Dimensions)**:

\`\`\`bash
ccw cli -p "PURPOSE: Multi-dimensional plan verification for Tier 1 (user intent, coverage, consistency)
TASK:
• Verify user original intent matches IMPL_PLAN objectives (dimension A)
• Check all synthesis requirements have corresponding tasks (dimension B)
• Identify conflicts between tasks and synthesis decisions (dimension C)
• Find orphaned requirements or unmapped tasks
CONTEXT: @${session_dir}/**/* | Memory: Verification session WFS-${session_id}
EXPECTED: Findings JSON array with: dimension, severity, location, summary, recommendation
CONSTRAINTS: Focus on CRITICAL issues only | Identify all intent misalignments
" --tool gemini --mode analysis --rule analysis-review-architecture
\`\`\`

**If CRITICAL findings == 0, continue to Tier 2**:

\`\`\`bash
ccw cli -p "PURPOSE: Plan verification for Tier 2 (dependencies and synthesis alignment)
TASK:
• Detect circular or broken task dependencies (dimension D)
• Identify priority conflicts between synthesis and tasks (dimension E)
• Check risk mitigation coverage
CONTEXT: @${session_dir}/**/* | Previous: Tier 1 verified, no critical issues
EXPECTED: Findings JSON with dimension D-E results
CONSTRAINTS: Limit to 15 HIGH severity findings
" --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause
\`\`\`

**If High findings <= 15, continue to Tier 3**:

\`\`\`bash
ccw cli -p "PURPOSE: Plan verification for Tier 3 (task specification quality)
TASK:
• Check for missing or vague acceptance criteria (dimension F)
• Validate flow control specifications in tasks
• Identify missing artifact references
CONTEXT: @${task_dir}/**/* @${IMPL_PLAN}
EXPECTED: Findings JSON with dimension F results
CONSTRAINTS: Limit to 20 MEDIUM severity findings
" --tool gemini --mode analysis --rule analysis-analyze-code-patterns
\`\`\`

**If Medium findings <= 20, execute Tier 4**:

\`\`\`bash
ccw cli -p "PURPOSE: Plan verification for Tier 4 (duplication and feasibility)
TASK:
• Detect overlapping task scopes (dimension G)
• Assess complexity alignment and resource conflicts (dimension H)
CONTEXT: @${task_dir}/**/*
EXPECTED: Findings JSON with dimension G-H results
CONSTRAINTS: Limit to 15 LOW severity findings
" --tool gemini --mode analysis --rule analysis-analyze-code-patterns
\`\`\`

### Severity Assignment

**CRITICAL**:
- Violates user's original intent (goal misalignment, scope drift)
- Violates synthesis authority (requirement conflict)
- Core requirement with zero coverage
- Circular dependencies
- Broken dependencies

**HIGH**:
- NFR coverage gaps
- Priority conflicts
- Missing risk mitigation tasks
- Ambiguous acceptance criteria

**MEDIUM**:
- Terminology drift
- Missing artifacts references
- Weak flow control
- Logical ordering issues

**LOW**:
- Style/wording improvements
- Minor redundancy not affecting execution

### Output Schema

JSON findings array (reference from step 5 above):

\`\`\`json
{
  "session_id": "${session_id}",
  "timestamp": "2025-01-27T...",
  "verification_tiers_completed": ["Tier 1", "Tier 2"],
  "findings": [
    {
      "id": "C1",
      "dimension": "A",
      "dimension_name": "User Intent Alignment",
      "severity": "CRITICAL",
      "location": ["${IMPL_PLAN}:L45", "synthesis:FR-03"],
      "summary": "User goal: add user profiles, but IMPL_PLAN focuses on authentication",
      "recommendation": "Update IMPL_PLAN to include profile management tasks"
    },
    {
      "id": "H1",
      "dimension": "D",
      "dimension_name": "Dependency Integrity",
      "severity": "HIGH",
      "location": ["task:IMPL-2.3"],
      "summary": "Depends on non-existent IMPL-2.4",
      "recommendation": "Fix depends_on reference or remove dependency"
    }
  ],
  "summary": {
    "critical_count": 2,
    "high_count": 3,
    "medium_count": 5,
    "low_count": 8,
    "total_findings": 18,
    "coverage_percentage": 92,
    "recommendation": "PROCEED_WITH_FIXES"
  }
}
\`\`\`

### Success Criteria

- [ ] All Tier 1 findings identified (no early exit)
- [ ] Tier 2-4 executed in sequence (skipped only by token budget exhaustion)
- [ ] Each finding includes: dimension, severity, location, recommendation
- [ ] Findings aggregated in single JSON output file
- [ ] Agent returns completion summary with quality gate recommendation

### Return Output

Write: \`${process_dir}/verification-findings.json\`

Return: 2-3 sentence summary with quality gate decision (BLOCK_EXECUTION / PROCEED_WITH_FIXES / PROCEED_WITH_CAUTION / PROCEED)
`
)
```

---

#### Phase 4.2: Parse and Aggregate Agent Results

```javascript
// Load agent findings
const findings = JSON.parse(Read(\`${process_dir}/verification-findings.json\`))

// Organize by severity
const byServerity = {
  CRITICAL: findings.findings.filter(f => f.severity === 'CRITICAL'),
  HIGH: findings.findings.filter(f => f.severity === 'HIGH'),
  MEDIUM: findings.findings.filter(f => f.severity === 'MEDIUM'),
  LOW: findings.findings.filter(f => f.severity === 'LOW')
}

// Determine quality gate
const recommendation =
  byServerity.CRITICAL.length > 0 ? 'BLOCK_EXECUTION' :
  byServerity.HIGH.length > 0 ? 'PROCEED_WITH_FIXES' :
  byServerity.MEDIUM.length > 0 ? 'PROCEED_WITH_CAUTION' :
  'PROCEED'
```

### 5. Generate Human-Readable Report

**Report Generation**: Transform agent findings JSON into comprehensive Markdown report.

**Step 5.1: Load Agent Findings**
```javascript
// Load verification findings from agent
const findingsData = JSON.parse(Read(`${process_dir}/verification-findings.json`))

// Extract key metrics
const { session_id, timestamp, verification_tiers_completed, findings, summary } = findingsData
const { critical_count, high_count, medium_count, low_count, total_findings, coverage_percentage, recommendation } = summary

// Organize findings by severity
const bySeverity = {
  CRITICAL: findings.filter(f => f.severity === 'CRITICAL'),
  HIGH: findings.filter(f => f.severity === 'HIGH'),
  MEDIUM: findings.filter(f => f.severity === 'MEDIUM'),
  LOW: findings.filter(f => f.severity === 'LOW')
}

// Organize findings by dimension
const byDimension = findings.reduce((acc, f) => {
  acc[f.dimension] = acc[f.dimension] || []
  acc[f.dimension].push(f)
  return acc
}, {})
```

**Step 5.2: Generate Markdown Report**

Output a Markdown report with the following structure:

```markdown
# Plan Verification Report

**Session**: WFS-${session_id}
**Generated**: ${timestamp}
**Verification Tiers Completed**: ${verification_tiers_completed.join(', ')}
**Artifacts Analyzed**: role analysis documents, IMPL_PLAN.md, ${task_files_count} task files

---

## Executive Summary

### Quality Gate Decision

| Metric | Value | Status |
|--------|-------|--------|
| Overall Risk Level | ${critical_count > 0 ? 'CRITICAL' : high_count > 0 ? 'HIGH' : medium_count > 0 ? 'MEDIUM' : 'LOW'} | ${critical_count > 0 ? '🔴' : high_count > 0 ? '🟠' : medium_count > 0 ? '🟡' : '🟢'} |
| Critical Issues | ${critical_count} | 🔴 |
| High Issues | ${high_count} | 🟠 |
| Medium Issues | ${medium_count} | 🟡 |
| Low Issues | ${low_count} | 🟢 |
| Requirements Coverage | ${coverage_percentage}% | ${coverage_percentage >= 90 ? '🟢' : coverage_percentage >= 75 ? '🟡' : '🔴'} |

### Recommendation

**${recommendation}**

**Decision Rationale**:
${
  recommendation === 'BLOCK_EXECUTION' ?
    `Critical issues detected that violate core requirements or user intent. Must be resolved before implementation.` :
  recommendation === 'PROCEED_WITH_FIXES' ?
    `No critical issues, but high-severity concerns exist. Recommended to fix before execution to ensure quality.` :
  recommendation === 'PROCEED_WITH_CAUTION' ?
    `Medium-severity issues detected. May proceed but address concerns during/after implementation.` :
    `No significant issues detected. Safe to proceed with implementation.`
}

**Quality Gate Criteria**:
- **BLOCK_EXECUTION**: Critical issues > 0 (must fix before proceeding)
- **PROCEED_WITH_FIXES**: Critical = 0, High > 0 (fix recommended before execution)
- **PROCEED_WITH_CAUTION**: Critical = 0, High = 0, Medium > 0 (proceed with awareness)
- **PROCEED**: Only Low issues or None (safe to execute)

---

## Findings Summary

| ID | Dimension | Severity | Location(s) | Summary | Recommendation |
|----|-----------|----------|-------------|---------|----------------|
${findings.map(f => `| ${f.id} | ${f.dimension_name} | ${f.severity} | ${f.location.join(', ')} | ${f.summary} | ${f.recommendation} |`).join('\n')}

(IDs prefixed by severity initial: C/H/M/L + number)

---

## User Intent Alignment Analysis (Dimension A)

${
  byDimension['A'] && byDimension['A'].length > 0 ?
    byDimension['A'].map(f => `
### ${f.summary}

**Severity**: ${f.severity}
**Location**: ${f.location.join(', ')}

**Issue Description**:
${f.summary}

**Recommendation**:
${f.recommendation}
`).join('\n') :
    `> ✅ No user intent alignment issues detected. IMPL_PLAN objectives and scope match user's original intent.`
}

---

## Requirements Coverage Analysis (Dimension B)

### Coverage Metrics

| Metric | Value |
|--------|-------|
| Overall Coverage | ${coverage_percentage}% |
| Total Findings | ${byDimension['B']?.length || 0} |

### Findings

${
  byDimension['B'] && byDimension['B'].length > 0 ?
    byDimension['B'].map(f => `
#### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ All synthesis requirements have corresponding tasks. No coverage gaps detected.`
}

---

## Consistency Validation (Dimension C)

${
  byDimension['C'] && byDimension['C'].length > 0 ?
    byDimension['C'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No consistency issues detected. Tasks align with synthesis requirements and architecture.`
}

---

## Dependency Integrity (Dimension D)

${
  byDimension['D'] && byDimension['D'].length > 0 ?
    byDimension['D'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No dependency issues detected. All task dependencies are valid and logically ordered.`
}

---

## Synthesis Alignment (Dimension E)

${
  byDimension['E'] && byDimension['E'].length > 0 ?
    byDimension['E'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No synthesis alignment issues. Task priorities and success criteria match synthesis specifications.`
}

---

## Task Specification Quality (Dimension F)

${
  byDimension['F'] && byDimension['F'].length > 0 ?
    byDimension['F'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ All tasks have clear specifications with proper focus_paths, acceptance criteria, and flow control.`
}

---

## Duplication Detection (Dimension G)

${
  byDimension['G'] && byDimension['G'].length > 0 ?
    byDimension['G'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No duplicate task scopes detected. All tasks have distinct responsibilities.`
}

---

## Feasibility Assessment (Dimension H)

${
  byDimension['H'] && byDimension['H'].length > 0 ?
    byDimension['H'].map(f => `
### ${f.id}: ${f.summary}

- **Severity**: ${f.severity}
- **Location**: ${f.location.join(', ')}
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No feasibility concerns. Task complexity assessments and resource allocations are appropriate.`
}

---

## Detailed Findings by Severity

### CRITICAL Issues (${critical_count})

${
  bySeverity.CRITICAL.length > 0 ?
    bySeverity.CRITICAL.map(f => `
#### ${f.id}: ${f.summary}

- **Dimension**: ${f.dimension_name} (${f.dimension})
- **Location**: ${f.location.join(', ')}
- **Impact**: Blocks execution - must be resolved before implementation
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No critical issues detected.`
}

### HIGH Issues (${high_count})

${
  bySeverity.HIGH.length > 0 ?
    bySeverity.HIGH.map(f => `
#### ${f.id}: ${f.summary}

- **Dimension**: ${f.dimension_name} (${f.dimension})
- **Location**: ${f.location.join(', ')}
- **Impact**: Significant quality concern - recommended to fix before execution
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No high-severity issues detected.`
}

### MEDIUM Issues (${medium_count})

${
  bySeverity.MEDIUM.length > 0 ?
    bySeverity.MEDIUM.map(f => `
#### ${f.id}: ${f.summary}

- **Dimension**: ${f.dimension_name} (${f.dimension})
- **Location**: ${f.location.join(', ')}
- **Impact**: Quality improvement opportunity - address during/after implementation
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No medium-severity issues detected.`
}

### LOW Issues (${low_count})

${
  bySeverity.LOW.length > 0 ?
    bySeverity.LOW.map(f => `
#### ${f.id}: ${f.summary}

- **Dimension**: ${f.dimension_name} (${f.dimension})
- **Location**: ${f.location.join(', ')}
- **Impact**: Minor improvement - optional
- **Recommendation**: ${f.recommendation}
`).join('\n') :
    `> ✅ No low-severity issues detected.`
}

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Requirements Coverage | ${coverage_percentage}% |
| Total Findings | ${total_findings} |
| Critical Issues | ${critical_count} |
| High Issues | ${high_count} |
| Medium Issues | ${medium_count} |
| Low Issues | ${low_count} |
| Verification Tiers Completed | ${verification_tiers_completed.join(', ')} |

---

## Remediation Recommendations

### Priority Order

1. **CRITICAL** - Must fix before proceeding
2. **HIGH** - Fix before execution
3. **MEDIUM** - Fix during or after implementation
4. **LOW** - Optional improvements

### Next Steps

Based on the quality gate recommendation (**${recommendation}**):

${
  recommendation === 'BLOCK_EXECUTION' ?
    `
**🛑 BLOCK EXECUTION**

You must resolve all CRITICAL issues before proceeding with implementation:

1. Review each critical issue in detail (see section "CRITICAL Issues" above)
2. Determine remediation approach:
   - Modify IMPL_PLAN.md for goal/scope conflicts
   - Update task.json for requirement misalignments
   - Add new tasks for coverage gaps
   - Fix dependencies for circular/broken references
3. Apply fixes systematically
4. Re-run verification to confirm resolution: \`/workflow:plan-verify --session ${session_id}\`
` :
  recommendation === 'PROCEED_WITH_FIXES' ?
    `
**⚠️ PROCEED WITH FIXES RECOMMENDED**

No critical issues detected, but HIGH issues exist. Recommended workflow:

1. Review high-priority issues (see section "HIGH Issues" above)
2. Apply fixes before execution for optimal results:
   - Use IMPL_PLAN.md for architecture/priority misalignments
   - Update task.json for specification improvements
   - Add missing dependencies or risk mitigation tasks
3. Re-run verification to confirm resolution: \`/workflow:plan-verify --session ${session_id}\`
4. Proceed to implementation when ready
` :
  recommendation === 'PROCEED_WITH_CAUTION' ?
    `
**✅ PROCEED WITH CAUTION**

Only MEDIUM issues detected. You may proceed with implementation:

- Review medium-severity issues (see section "MEDIUM Issues" above)
- Address concerns during or after implementation
- Maintain awareness of identified concerns
- Schedule remediation for future improvement cycles
` :
    `
**✅ PROCEED**

No significant issues detected. Safe to execute implementation workflow:

- Requirements fully covered
- User intent aligned
- Dependencies valid and logically ordered
- All tasks properly specified
- Ready for immediate execution
`
}

---

**Report End**
\`\`\`

### 6. Save and Display Report

**Step 6.1: Generate Complete Markdown Report**

```javascript
// Build complete report from template above using findings data
const fullReport = \`
# Plan Verification Report
... [complete markdown template generated above] ...
\`

// Write report to file
const reportPath = \`${process_dir}/PLAN_VERIFICATION.md\`
Write(reportPath, fullReport)
```

**Step 6.2: Display Summary to User**

```javascript
console.log(\`
=== Plan Verification Complete ===
Report saved to: ${reportPath}

Quality Gate: \${recommendation}
Critical: \${critical_count} | High: \${high_count} | Medium: \${medium_count} | Low: \${low_count}
Coverage: \${coverage_percentage}%

Next: Review full report at ${reportPath} for detailed findings and recommendations
\`)
```

**Step 6.3: Next Step Selection**

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const canExecute = recommendation !== 'BLOCK_EXECUTION'

// Auto mode
if (autoYes) {
  if (canExecute) {
    SlashCommand("/workflow:execute --yes --resume-session=\"${session_id}\"")
  } else {
    console.log(`[--yes] BLOCK_EXECUTION - Fix ${critical_count} critical issues first.`)
  }
  return
}

// Interactive mode - build options based on quality gate
const options = canExecute
  ? [
      { label: canExecute && recommendation === 'PROCEED_WITH_FIXES' ? "Execute Anyway" : "Execute (Recommended)",
        description: "Proceed to /workflow:execute" },
      { label: "Review Report", description: "Review findings before deciding" },
      { label: "Re-verify", description: "Re-run after manual fixes" }
    ]
  : [
      { label: "Review Report", description: "Review critical issues" },
      { label: "Re-verify", description: "Re-run after fixing issues" }
    ]

const selection = AskUserQuestion({
  questions: [{
    question: `Quality gate: ${recommendation}. Next step?`,
    header: "Action",
    multiSelect: false,
    options
  }]
})

// Handle selection
if (selection.includes("Execute")) {
  SlashCommand("/workflow:execute --resume-session=\"${session_id}\"")
} else if (selection === "Re-verify") {
  SlashCommand("/workflow:plan-verify --session ${session_id}")
}
```
