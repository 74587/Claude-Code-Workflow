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

### 4. Detection Passes (Token-Efficient Analysis)

**Token Budget Strategy**:
- **Total Limit**: 50 findings maximum (aggregate remainder in overflow summary)
- **Priority Allocation**: CRITICAL (unlimited) → HIGH (15) → MEDIUM (20) → LOW (15)
- **Early Exit**: If CRITICAL findings > 0 in User Intent/Requirements Coverage, skip LOW/MEDIUM priority checks

**Execution Order** (Process in sequence; skip if token budget exhausted):

1. **Tier 1 (CRITICAL Path)**: A, B, C - User intent, coverage, consistency (process fully)
2. **Tier 2 (HIGH Priority)**: D, E - Dependencies, synthesis alignment (limit 15 findings total)
3. **Tier 3 (MEDIUM Priority)**: F - Specification quality (limit 20 findings)
4. **Tier 4 (LOW Priority)**: G, H - Duplication, feasibility (limit 15 findings total)

---

#### A. User Intent Alignment (CRITICAL - Tier 1)

- **Goal Alignment**: IMPL_PLAN objectives match user's original intent
- **Scope Drift**: Plan covers user's stated scope without unauthorized expansion
- **Success Criteria Match**: Plan's success criteria reflect user's expectations
- **Intent Conflicts**: Tasks contradicting user's original objectives

#### B. Requirements Coverage Analysis

- **Orphaned Requirements**: Requirements in synthesis with zero associated tasks
- **Unmapped Tasks**: Tasks with no clear requirement linkage
- **NFR Coverage Gaps**: Non-functional requirements (performance, security, scalability) not reflected in tasks

#### C. Consistency Validation

- **Requirement Conflicts**: Tasks contradicting synthesis requirements
- **Architecture Drift**: IMPL_PLAN architecture not matching synthesis ADRs
- **Terminology Drift**: Same concept named differently across IMPL_PLAN and tasks
- **Data Model Inconsistency**: Tasks referencing entities/fields not in synthesis data model

#### D. Dependency Integrity

- **Circular Dependencies**: Task A depends on B, B depends on C, C depends on A
- **Missing Dependencies**: Task requires outputs from another task but no explicit dependency
- **Broken Dependencies**: Task depends on non-existent task ID
- **Logical Ordering Issues**: Implementation tasks before foundational setup without dependency note

#### E. Synthesis Alignment

- **Priority Conflicts**: High-priority synthesis requirements mapped to low-priority tasks
- **Success Criteria Mismatch**: IMPL_PLAN success criteria not covering synthesis acceptance criteria
- **Risk Mitigation Gaps**: Critical risks in synthesis without corresponding mitigation tasks

#### F. Task Specification Quality

- **Ambiguous Focus Paths**: Tasks with vague or missing focus_paths
- **Underspecified Acceptance**: Tasks without clear acceptance criteria
- **Missing Artifacts References**: Tasks not referencing relevant brainstorming artifacts in context.artifacts
- **Weak Flow Control**: Tasks without clear implementation_approach or pre_analysis steps
- **Missing Target Files**: Tasks without flow_control.target_files specification

#### G. Duplication Detection

- **Overlapping Task Scope**: Multiple tasks with nearly identical descriptions
- **Redundant Requirements Coverage**: Same requirement covered by multiple tasks without clear partitioning

#### H. Feasibility Assessment

- **Complexity Misalignment**: Task marked "simple" but requires multiple file modifications
- **Resource Conflicts**: Parallel tasks requiring same resources/files
- **Skill Gap Risks**: Tasks requiring skills not in team capability assessment (from synthesis)

### 5. Severity Assignment

Use this heuristic to prioritize findings:

- **CRITICAL**:
  - Violates user's original intent (goal misalignment, scope drift)
  - Violates synthesis authority (requirement conflict)
  - Core requirement with zero coverage
  - Circular dependencies
  - Broken dependencies

- **HIGH**:
  - NFR coverage gaps
  - Priority conflicts
  - Missing risk mitigation tasks
  - Ambiguous acceptance criteria

- **MEDIUM**:
  - Terminology drift
  - Missing artifacts references
  - Weak flow control
  - Logical ordering issues

- **LOW**:
  - Style/wording improvements
  - Minor redundancy not affecting execution

### 6. Produce Compact Analysis Report

**Report Generation**: Generate report content and save to file.

Output a Markdown report with the following structure:

```markdown
# Plan Verification Report

**Session**: WFS-{session-id}
**Generated**: {timestamp}
**Artifacts Analyzed**: role analysis documents, IMPL_PLAN.md, {N} task files
**User Intent Analysis**: {user_intent_analysis or "SKIPPED: workflow-session.json not found"}

---

## Executive Summary

### Quality Gate Decision

| Metric | Value | Status |
|--------|-------|--------|
| Overall Risk Level | CRITICAL \| HIGH \| MEDIUM \| LOW | {status_emoji} |
| Critical Issues | {count} | 🔴 |
| High Issues | {count} | 🟠 |
| Medium Issues | {count} | 🟡 |
| Low Issues | {count} | 🟢 |

### Recommendation

**{RECOMMENDATION}**

**Decision Rationale**:
{brief explanation based on severity criteria}

**Quality Gate Criteria**:
- **BLOCK_EXECUTION**: Critical issues > 0 (must fix before proceeding)
- **PROCEED_WITH_FIXES**: Critical = 0, High > 0 (fix recommended before execution)
- **PROCEED_WITH_CAUTION**: Critical = 0, High = 0, Medium > 0 (proceed with awareness)
- **PROCEED**: Only Low issues or None (safe to execute)

---

## Findings Summary

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | CRITICAL | synthesis:FR-03 | Requirement "User auth" has zero task coverage | Add authentication implementation task |
| H1 | Consistency | HIGH | IMPL-1.2 vs synthesis:ADR-02 | Task uses REST while synthesis specifies GraphQL | Align task with ADR-02 decision |
| M1 | Specification | MEDIUM | IMPL-2.1 | Missing context.artifacts reference | Add @synthesis reference |
| L1 | Duplication | LOW | IMPL-3.1, IMPL-3.2 | Similar scope | Consider merging |

(Generate stable IDs prefixed by severity initial: C/H/M/L + number)

---

## User Intent Alignment Analysis

{IF user_intent_analysis != "SKIPPED"}

### Goal Alignment
- **User Intent**: {user_original_intent}
- **IMPL_PLAN Objectives**: {plan_objectives}
- **Alignment Status**: {ALIGNED/MISALIGNED/PARTIAL}
- **Findings**: {specific alignment issues}

### Scope Verification
- **User Scope**: {user_defined_scope}
- **Plan Scope**: {plan_actual_scope}
- **Drift Detection**: {NONE/MINOR/MAJOR}
- **Findings**: {specific scope issues}

{ELSE}
> ⚠️ User intent alignment analysis was skipped because workflow-session.json was not found.

{END IF}

---

## Requirements Coverage Analysis

### Functional Requirements

| Requirement ID | Requirement Summary | Has Task? | Task IDs | Priority Match | Notes |
|----------------|---------------------|-----------|----------|----------------|-------|
| FR-01 | User authentication | Yes | IMPL-1.1, IMPL-1.2 | Match | Complete |
| FR-02 | Data export | Yes | IMPL-2.3 | Mismatch | High req → Med priority task |
| FR-03 | Profile management | No | - | - | **CRITICAL: Zero coverage** |

### Non-Functional Requirements

| Requirement ID | Requirement Summary | Has Task? | Task IDs | Notes |
|----------------|---------------------|-----------|----------|-------|
| NFR-01 | Response time <200ms | No | - | **HIGH: No performance tasks** |
| NFR-02 | Security compliance | Yes | IMPL-4.1 | Complete |

### Business Requirements

| Requirement ID | Requirement Summary | Has Task? | Task IDs | Notes |
|----------------|---------------------|-----------|----------|-------|
| BR-01 | Launch by Q2 | Yes | IMPL-1.* through IMPL-5.* | Timeline realistic |

### Coverage Metrics

| Requirement Type | Total | Covered | Coverage % |
|------------------|-------|---------|------------|
| Functional | {count} | {count} | {percent}% |
| Non-Functional | {count} | {count} | {percent}% |
| Business | {count} | {count} | {percent}% |
| **Overall** | **{total}** | **{covered}** | **{percent}%** |

---

## Dependency Integrity

### Dependency Graph Analysis

**Circular Dependencies**: {None or List}

**Broken Dependencies**:
- IMPL-2.3 depends on "IMPL-2.4" (non-existent)

**Missing Dependencies**:
- IMPL-5.1 (integration test) has no dependency on IMPL-1.* (implementation tasks)

**Logical Ordering Issues**:
{List or "None detected"}

---

## Synthesis Alignment Issues

| Issue Type | Synthesis Reference | IMPL_PLAN/Task | Impact | Recommendation |
|------------|---------------------|----------------|--------|----------------|
| Architecture Conflict | synthesis:ADR-01 (JWT auth) | IMPL_PLAN uses session cookies | HIGH | Update IMPL_PLAN to use JWT |
| Priority Mismatch | synthesis:FR-02 (High) | IMPL-2.3 (Medium) | MEDIUM | Elevate task priority |
| Missing Risk Mitigation | synthesis:Risk-03 (API rate limits) | No mitigation tasks | HIGH | Add rate limiting implementation task |

---

## Task Specification Quality

### Aggregate Statistics

| Quality Dimension | Tasks Affected | Percentage |
|-------------------|----------------|------------|
| Missing Artifacts References | {count} | {percent}% |
| Weak Flow Control | {count} | {percent}% |
| Missing Target Files | {count} | {percent}% |
| Ambiguous Focus Paths | {count} | {percent}% |

### Sample Issues

- **IMPL-1.2**: No context.artifacts reference to synthesis
- **IMPL-3.1**: Missing flow_control.target_files specification
- **IMPL-4.2**: Vague focus_paths ["src/"] - needs refinement

---

## Feasibility Concerns

| Concern | Tasks Affected | Issue | Recommendation |
|---------|----------------|-------|----------------|
| Skill Gap | IMPL-6.1, IMPL-6.2 | Requires Kubernetes expertise not in team | Add training task or external consultant |
| Resource Conflict | IMPL-3.1, IMPL-3.2 | Both modify src/auth/service.ts in parallel | Add dependency or serialize |

---

## Detailed Findings by Severity

### CRITICAL Issues ({count})

{Detailed breakdown of each critical issue with location, impact, and recommendation}

### HIGH Issues ({count})

{Detailed breakdown of each high issue with location, impact, and recommendation}

### MEDIUM Issues ({count})

{Detailed breakdown of each medium issue with location, impact, and recommendation}

### LOW Issues ({count})

{Detailed breakdown of each low issue with location, impact, and recommendation}

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Total Requirements | {count} ({functional} functional, {nonfunctional} non-functional, {business} business) |
| Total Tasks | {count} |
| Overall Coverage | {percent}% ({covered}/{total} requirements with ≥1 task) |
| Critical Issues | {count} |
| High Issues | {count} |
| Medium Issues | {count} |
| Low Issues | {count} |
| Total Findings | {total_findings} |

---

## Remediation Recommendations

### Priority Order

1. **CRITICAL** - Must fix before proceeding
2. **HIGH** - Fix before execution
3. **MEDIUM** - Fix during or after implementation
4. **LOW** - Optional improvements

### Next Steps

Based on the quality gate recommendation ({RECOMMENDATION}):

{IF BLOCK_EXECUTION}
**🛑 BLOCK EXECUTION**

You must resolve all CRITICAL issues before proceeding with implementation:

1. Review each critical issue in detail
2. Determine remediation approach (modify IMPL_PLAN.md, update task.json, or add new tasks)
3. Apply fixes systematically
4. Re-run verification to confirm resolution

{ELSE IF PROCEED_WITH_FIXES}
**⚠️ PROCEED WITH FIXES RECOMMENDED**

No critical issues detected, but HIGH issues exist. Recommended workflow:

1. Review high-priority issues
2. Apply fixes before execution for optimal results
3. Re-run verification (optional)

{ELSE IF PROCEED_WITH_CAUTION}
**✅ PROCEED WITH CAUTION**

Only MEDIUM issues detected. You may proceed with implementation:

- Address medium issues during or after implementation
- Maintain awareness of identified concerns

{ELSE}
**✅ PROCEED**

No significant issues detected. Safe to execute implementation workflow.

{END IF}

---

**Report End**
```

### 7. Save and Display Report

**Step 7.1: Save Report**:
```bash
report_path = ".workflow/active/WFS-{session}/.process/PLAN_VERIFICATION.md"
Write(report_path, full_report_content)
```

**Step 7.2: Display Summary to User**:
```bash
# Display executive summary in terminal
echo "=== Plan Verification Complete ==="
echo "Report saved to: {report_path}"
echo ""
echo "Quality Gate: {RECOMMENDATION}"
echo "Critical: {count} | High: {count} | Medium: {count} | Low: {count}"
echo ""
echo "Next: Review full report for detailed findings and recommendations"
```

**Step 7.3: Completion**:
- Report is saved to `.process/PLAN_VERIFICATION.md`
- User can review findings and decide on remediation approach
- No automatic modifications are made to source artifacts
- User can manually apply fixes or use separate remediation command (if available)
