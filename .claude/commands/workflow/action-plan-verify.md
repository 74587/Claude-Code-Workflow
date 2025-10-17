---
name: action-plan-verify
description: Perform non-destructive cross-artifact consistency and quality analysis of IMPL_PLAN.md and task.json before execution
argument-hint: "[optional: --session session-id]"
allowed-tools: Read(*), TodoWrite(*), Glob(*), Bash(*)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items between action planning artifacts (`IMPL_PLAN.md`, `task.json`) and brainstorming artifacts (`synthesis-specification.md`) before implementation. This command MUST run only after `/workflow:plan` has successfully produced complete `IMPL_PLAN.md` and task JSON files.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any follow-up editing commands).

**Synthesis Authority**: The `synthesis-specification.md` is **authoritative** for requirements and design decisions. Any conflicts between IMPL_PLAN/tasks and synthesis are automatically CRITICAL and require adjustment of the plan/tasks—not reinterpretation of requirements.

## Execution Steps

### 1. Initialize Analysis Context

```bash
# Detect active workflow session
IF --session parameter provided:
    session_id = provided session
ELSE:
    CHECK: .workflow/.active-* marker files
    IF active_session EXISTS:
        session_id = get_active_session()
    ELSE:
        ERROR: "No active workflow session found. Use --session <session-id>"
        EXIT

# Derive absolute paths
session_dir = .workflow/WFS-{session}
brainstorm_dir = session_dir/.brainstorming
task_dir = session_dir/.task

# Validate required artifacts
SYNTHESIS = brainstorm_dir/synthesis-specification.md
IMPL_PLAN = session_dir/IMPL_PLAN.md
TASK_FILES = Glob(task_dir/*.json)

# Abort if missing
IF NOT EXISTS(SYNTHESIS):
    ERROR: "synthesis-specification.md not found. Run /workflow:brainstorm:synthesis first"
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

**From synthesis-specification.md**:
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
- Meta (complexity, priority, use_codex)

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

Focus on high-signal findings. Limit to 50 findings total; aggregate remainder in overflow summary.

#### A. Requirements Coverage Analysis

- **Orphaned Requirements**: Requirements in synthesis with zero associated tasks
- **Unmapped Tasks**: Tasks with no clear requirement linkage
- **NFR Coverage Gaps**: Non-functional requirements (performance, security, scalability) not reflected in tasks

#### B. Consistency Validation

- **Requirement Conflicts**: Tasks contradicting synthesis requirements
- **Architecture Drift**: IMPL_PLAN architecture not matching synthesis ADRs
- **Terminology Drift**: Same concept named differently across IMPL_PLAN and tasks
- **Data Model Inconsistency**: Tasks referencing entities/fields not in synthesis data model

#### C. Dependency Integrity

- **Circular Dependencies**: Task A depends on B, B depends on C, C depends on A
- **Missing Dependencies**: Task requires outputs from another task but no explicit dependency
- **Broken Dependencies**: Task depends on non-existent task ID
- **Logical Ordering Issues**: Implementation tasks before foundational setup without dependency note

#### D. Synthesis Alignment

- **Priority Conflicts**: High-priority synthesis requirements mapped to low-priority tasks
- **Success Criteria Mismatch**: IMPL_PLAN success criteria not covering synthesis acceptance criteria
- **Risk Mitigation Gaps**: Critical risks in synthesis without corresponding mitigation tasks

#### E. Task Specification Quality

- **Ambiguous Focus Paths**: Tasks with vague or missing focus_paths
- **Underspecified Acceptance**: Tasks without clear acceptance criteria
- **Missing Artifacts References**: Tasks not referencing relevant brainstorming artifacts in context.artifacts
- **Weak Flow Control**: Tasks without clear implementation_approach or pre_analysis steps
- **Missing Target Files**: Tasks without flow_control.target_files specification

#### F. Duplication Detection

- **Overlapping Task Scope**: Multiple tasks with nearly identical descriptions
- **Redundant Requirements Coverage**: Same requirement covered by multiple tasks without clear partitioning

#### G. Feasibility Assessment

- **Complexity Misalignment**: Task marked "simple" but requires multiple file modifications
- **Resource Conflicts**: Parallel tasks requiring same resources/files
- **Skill Gap Risks**: Tasks requiring skills not in team capability assessment (from synthesis)

### 5. Severity Assignment

Use this heuristic to prioritize findings:

- **CRITICAL**:
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

Output a Markdown report (no file writes) with the following structure:

```markdown
## Action Plan Verification Report

**Session**: WFS-{session-id}
**Generated**: {timestamp}
**Artifacts Analyzed**: synthesis-specification.md, IMPL_PLAN.md, {N} task files

---

### Executive Summary

- **Overall Risk Level**: CRITICAL | HIGH | MEDIUM | LOW
- **Recommendation**: BLOCK_EXECUTION | PROCEED_WITH_FIXES | PROCEED_WITH_CAUTION | PROCEED
- **Critical Issues**: {count}
- **High Issues**: {count}
- **Medium Issues**: {count}
- **Low Issues**: {count}

---

### Findings Summary

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | CRITICAL | synthesis:FR-03 | Requirement "User auth" has zero task coverage | Add authentication implementation task |
| H1 | Consistency | HIGH | IMPL-1.2 vs synthesis:ADR-02 | Task uses REST while synthesis specifies GraphQL | Align task with ADR-02 decision |
| M1 | Specification | MEDIUM | IMPL-2.1 | Missing context.artifacts reference | Add @synthesis reference |
| L1 | Duplication | LOW | IMPL-3.1, IMPL-3.2 | Similar scope | Consider merging |

(Add one row per finding; generate stable IDs prefixed by severity initial.)

---

### Requirements Coverage Analysis

| Requirement ID | Requirement Summary | Has Task? | Task IDs | Priority Match | Notes |
|----------------|---------------------|-----------|----------|----------------|-------|
| FR-01 | User authentication | ✅ Yes | IMPL-1.1, IMPL-1.2 | ✅ Match | Complete |
| FR-02 | Data export | ✅ Yes | IMPL-2.3 | ⚠️ Mismatch | High req → Med priority task |
| FR-03 | Profile management | ❌ No | - | - | **CRITICAL: Zero coverage** |
| NFR-01 | Response time <200ms | ❌ No | - | - | **HIGH: No performance tasks** |

**Coverage Metrics**:
- Functional Requirements: 85% (17/20 covered)
- Non-Functional Requirements: 40% (2/5 covered)
- Business Requirements: 100% (5/5 covered)

---

### Unmapped Tasks

| Task ID | Title | Issue | Recommendation |
|---------|-------|-------|----------------|
| IMPL-4.5 | Refactor utils | No requirement linkage | Link to technical debt or remove |

---

### Dependency Graph Issues

**Circular Dependencies**: None detected ✅

**Broken Dependencies**:
- IMPL-2.3 depends on "IMPL-2.4" (non-existent)

**Logical Ordering Issues**:
- IMPL-5.1 (integration test) has no dependency on IMPL-1.* (implementation tasks)

---

### Synthesis Alignment Issues

| Issue Type | Synthesis Reference | IMPL_PLAN/Task | Impact | Recommendation |
|------------|---------------------|----------------|--------|----------------|
| Architecture Conflict | synthesis:ADR-01 (JWT auth) | IMPL_PLAN uses session cookies | HIGH | Update IMPL_PLAN to use JWT |
| Priority Mismatch | synthesis:FR-02 (High) | IMPL-2.3 (Medium) | MEDIUM | Elevate task priority |
| Missing Risk Mitigation | synthesis:Risk-03 (API rate limits) | No mitigation tasks | HIGH | Add rate limiting implementation task |

---

### Task Specification Quality Issues

**Missing Artifacts References**: 12 tasks lack context.artifacts
**Weak Flow Control**: 5 tasks lack implementation_approach
**Missing Target Files**: 8 tasks lack flow_control.target_files

**Sample Issues**:
- IMPL-1.2: No context.artifacts reference to synthesis
- IMPL-3.1: Missing flow_control.target_files specification
- IMPL-4.2: Vague focus_paths ["src/"] - needs refinement

---

### Feasibility Concerns

| Concern | Tasks Affected | Issue | Recommendation |
|---------|----------------|-------|----------------|
| Skill Gap | IMPL-6.1, IMPL-6.2 | Requires Kubernetes expertise not in team | Add training task or external consultant |
| Resource Conflict | IMPL-3.1, IMPL-3.2 | Both modify src/auth/service.ts in parallel | Add dependency or serialize |

---

### Metrics

- **Total Requirements**: 30 (20 functional, 5 non-functional, 5 business)
- **Total Tasks**: 25
- **Overall Coverage**: 77% (23/30 requirements with ≥1 task)
- **Critical Issues**: 2
- **High Issues**: 5
- **Medium Issues**: 8
- **Low Issues**: 3

---

### Next Actions

#### Action Recommendations

**If CRITICAL Issues Exist**:
- ❌ **BLOCK EXECUTION** - Resolve critical issues before proceeding
- Use `/task:create` for missing requirements coverage
- Fix broken dependencies and circular references

**If Only HIGH/MEDIUM/LOW Issues**:
- ⚠️ **PROCEED WITH CAUTION** - Fix high-priority issues first
- Use batch replan mode to apply all task improvements systematically

#### Batch Remediation

**Report Location**: `.workflow/WFS-{session}/.process/ACTION_PLAN_VERIFICATION.md`

**Apply All Task Improvements** (Recommended):
```bash
# Batch process all task replan recommendations
/task:replan --batch .workflow/WFS-{session}/.process/ACTION_PLAN_VERIFICATION.md

# Or with auto-confirmation (no prompts)
/task:replan --batch ACTION_PLAN_VERIFICATION.md --auto-confirm
```

**Manual Selective Fixes**:
```bash
# Fix critical coverage gaps first
/task:create "Implement user authentication (FR-03)"
/task:create "Add performance optimization (NFR-01)"

# Then apply task refinements individually
/task:replan IMPL-1.2 "Add context.artifacts and target_files"
```

**Notes**:
- Batch mode extracts all `/task:replan` commands from report
- Processes by priority: CRITICAL → HIGH → MEDIUM → LOW
- Creates TodoWrite tracking for all modifications
- Architecture drift in IMPL_PLAN requires manual editing
```

### 7. Save Report and Provide Remediation Options

**Save Analysis Report**:
```bash
report_path = ".workflow/WFS-{session}/.process/ACTION_PLAN_VERIFICATION.md"
Write(report_path, full_report_content)
```

At end of report, provide batch remediation guidance:

```markdown
### 🔧 Remediation Options

**Recommended Workflow**:
1. **Batch Mode** (Fastest): Apply all task improvements automatically
   ```bash
   /task:replan --batch .workflow/WFS-{session}/.process/ACTION_PLAN_VERIFICATION.md
   ```

2. **Manual Review**: Examine each issue before applying
   - Review findings in this report
   - Execute specific `/task:create` or `/task:replan` commands individually

3. **Architecture Changes**: Update IMPL_PLAN.md manually if architecture drift detected

**Note**: This is read-only analysis. All fixes require explicit execution.
```

### 8. Update Session Metadata

```json
{
  "phases": {
    "PLAN": {
      "status": "completed",
      "action_plan_verification": {
        "completed": true,
        "completed_at": "timestamp",
        "overall_risk_level": "HIGH",
        "recommendation": "PROCEED_WITH_FIXES",
        "issues": {
          "critical": 2,
          "high": 5,
          "medium": 8,
          "low": 3
        },
        "coverage": {
          "functional_requirements": 0.85,
          "non_functional_requirements": 0.40,
          "business_requirements": 1.00
        },
        "report_path": ".workflow/WFS-{session}/.process/ACTION_PLAN_VERIFICATION.md"
      }
    }
  }
}
```

## Operating Principles

### Context Efficiency
- **Minimal high-signal tokens**: Focus on actionable findings
- **Progressive disclosure**: Load artifacts incrementally
- **Token-efficient output**: Limit findings table to 50 rows; summarize overflow
- **Deterministic results**: Rerunning without changes produces consistent IDs and counts

### Analysis Guidelines
- **NEVER modify files** (this is read-only analysis)
- **NEVER hallucinate missing sections** (if absent, report them accurately)
- **Prioritize synthesis violations** (these are always CRITICAL)
- **Use examples over exhaustive rules** (cite specific instances)
- **Report zero issues gracefully** (emit success report with coverage statistics)

### Verification Taxonomy
- **Coverage**: Requirements → Tasks mapping
- **Consistency**: Cross-artifact alignment
- **Dependencies**: Task ordering and relationships
- **Synthesis Alignment**: Adherence to authoritative requirements
- **Task Quality**: Specification completeness
- **Feasibility**: Implementation risks

## Behavior Rules

- **If no issues found**: Report "✅ Action plan verification passed. No issues detected." and suggest proceeding to `/workflow:execute`.
- **If CRITICAL issues exist**: Recommend blocking execution until resolved.
- **If only HIGH/MEDIUM issues**: User may proceed with caution, but provide improvement suggestions.
- **If IMPL_PLAN.md or task files missing**: Instruct user to run `/workflow:plan` first.
- **Always provide actionable remediation suggestions**: Don't just identify problems—suggest solutions.

## Context

{ARGS}
