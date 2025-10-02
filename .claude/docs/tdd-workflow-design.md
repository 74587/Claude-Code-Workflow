# TDD Workflow Design Specification

## Architecture Overview

The TDD workflow introduces a specialized planning and verification system that enforces Test-Driven Development principles through the existing workflow architecture. It follows the same orchestrator pattern as `/workflow:plan` but generates TDD-specific task chains.

## Command Structure

### Primary Commands (Orchestrators)
- `/workflow:tdd-plan` - TDD workflow planning orchestrator
- `/workflow:tdd-verify` - TDD compliance verification orchestrator

### Tool Commands (Executors)
- `/workflow:tools:task-generate-tdd` - TDD-specific task generator
- `/workflow:tools:tdd-coverage-analysis` - Test coverage analyzer

---

## 1. /workflow:tdd-plan Command

### Purpose
Orchestrate TDD-specific workflow planning that generates Red-Green-Refactor task chains with enforced dependencies.

### Command Specification

```yaml
name: tdd-plan
description: Orchestrate TDD workflow planning with Red-Green-Refactor task chains
usage: /workflow:tdd-plan [--agent] <input>
argument-hint: "[--agent] \"feature description\"|file.md|ISS-001"
examples:
  - /workflow:tdd-plan "Implement user authentication"
  - /workflow:tdd-plan --agent requirements.md
  - /workflow:tdd-plan ISS-001
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
```

### Execution Flow (5 Phases)

**Phase 1: Session Discovery**
```bash
/workflow:session:start --auto "TDD: [structured-description]"
```
- Extract: `sessionId` (WFS-xxx)
- Validation: Session directory created

**Phase 2: Context Gathering**
```bash
/workflow:tools:context-gather --session [sessionId] "TDD: [structured-description]"
```
- Extract: `contextPath` (context-package.json)
- Validation: Context package exists

**Phase 3: TDD Analysis**
```bash
/workflow:tools:concept-enhanced --session [sessionId] --context [contextPath]
```
- Extract: ANALYSIS_RESULTS.md
- Validation: Contains TDD-specific recommendations

**Phase 4: TDD Task Generation**
```bash
# Manual mode (default)
/workflow:tools:task-generate-tdd --session [sessionId]

# Agent mode
/workflow:tools:task-generate-tdd --session [sessionId] --agent
```
- Extract: Task count, TDD chain count
- Validation:
  - IMPL_PLAN.md exists
  - TDD_PLAN.md exists (TDD-specific plan)
  - Task JSONs follow Red-Green-Refactor pattern
  - Dependencies correctly enforced

**Phase 5: TDD Structure Validation**
```bash
# Internal validation step (no separate command call)
# Verify task chain structure:
# - Each feature has TEST → IMPL → REFACTOR sequence
# - Dependencies are correctly set
# - Meta.type fields are appropriate
```
- Extract: Validation report
- Validation: All TDD chains valid

### Structured Input Format

```
TDD: [feature-name]
GOAL: [Clear objective]
SCOPE: [What to test and implement]
CONTEXT: [Relevant background]
TEST_FOCUS: [Critical test scenarios]
```

### TDD-Specific TodoWrite Pattern

```javascript
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "in_progress", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "pending", "activeForm": "Executing context gathering"},
  {"content": "Execute TDD analysis", "status": "pending", "activeForm": "Executing TDD analysis"},
  {"content": "Execute TDD task generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Validate TDD structure", "status": "pending", "activeForm": "Validating TDD structure"}
]})
```

### Output Structure

```
TDD Planning complete for session: [sessionId]

Features analyzed: [count]
TDD chains generated: [count]
Total tasks: [count]

Structure:
- [Feature 1]: TEST-1 → IMPL-1 → REFACTOR-1
- [Feature 2]: TEST-2 → IMPL-2 → REFACTOR-2

Plans:
- Implementation: .workflow/[sessionId]/IMPL_PLAN.md
- TDD Structure: .workflow/[sessionId]/TDD_PLAN.md

Next: /workflow:execute or /workflow:tdd-verify
```

---

## 2. /workflow:tools:task-generate-tdd Command

### Purpose
Generate TDD-specific task chains from ANALYSIS_RESULTS.md with enforced Red-Green-Refactor structure.

### Command Specification

```yaml
name: task-generate-tdd
description: Generate TDD task chains with Red-Green-Refactor dependencies
usage: /workflow:tools:task-generate-tdd --session <session-id> [--agent]
argument-hint: "--session WFS-xxx [--agent]"
examples:
  - /workflow:tools:task-generate-tdd --session WFS-auth
  - /workflow:tools:task-generate-tdd --session WFS-auth --agent
allowed-tools: Read(*), Write(*), Bash(gemini-wrapper:*)
```

### Implementation Flow

**Step 1: Load Analysis**
```bash
cat .workflow/[sessionId]/ANALYSIS_RESULTS.md
```

**Step 2: Gemini TDD Task Planning**
```bash
cd project-root && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate TDD task breakdown with Red-Green-Refactor chains
TASK: Analyze ANALYSIS_RESULTS.md and create TDD-structured task breakdown
CONTEXT: @{.workflow/[sessionId]/ANALYSIS_RESULTS.md}
EXPECTED:
- Feature list with testable requirements
- Test cases for each feature (Red phase)
- Implementation requirements (Green phase)
- Refactoring opportunities (Refactor phase)
- Task dependencies and execution order
RULES: Each feature must have TEST → IMPL → REFACTOR chain. Output structured markdown for task generation.
" > .workflow/[sessionId]/.process/TDD_TASK_BREAKDOWN.md
```

**Step 3: Generate Task JSONs**

For each feature identified:

```json
// TEST Phase (Red)
{
  "id": "TEST-1.1",
  "title": "Write failing test for [feature]",
  "status": "pending",
  "meta": {
    "type": "test",
    "agent": "@code-review-test-agent",
    "tdd_phase": "red"
  },
  "context": {
    "requirements": ["Write test case that fails", "Test should define expected behavior"],
    "focus_paths": ["tests/[feature]"],
    "acceptance": ["Test written and fails with clear error message"],
    "depends_on": []
  }
}

// IMPL Phase (Green)
{
  "id": "IMPL-1.1",
  "title": "Implement [feature] to pass tests",
  "status": "pending",
  "meta": {
    "type": "feature",
    "agent": "@code-developer",
    "tdd_phase": "green"
  },
  "context": {
    "requirements": ["Implement minimal code to pass TEST-1.1"],
    "focus_paths": ["src/[feature]", "tests/[feature]"],
    "acceptance": ["All tests in TEST-1.1 pass"],
    "depends_on": ["TEST-1.1"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_test_requirements",
        "action": "Read test specifications from TEST phase",
        "command": "bash(cat .workflow/[sessionId]/.summaries/TEST-1.1-summary.md)",
        "output_to": "test_requirements",
        "on_error": "fail"
      }
    ]
  }
}

// REFACTOR Phase
{
  "id": "REFACTOR-1.1",
  "title": "Refactor [feature] implementation",
  "status": "pending",
  "meta": {
    "type": "refactor",
    "agent": "@code-developer",
    "tdd_phase": "refactor"
  },
  "context": {
    "requirements": ["Improve code quality while keeping tests green", "Remove duplication", "Improve readability"],
    "focus_paths": ["src/[feature]", "tests/[feature]"],
    "acceptance": ["Code improved", "All tests still pass"],
    "depends_on": ["IMPL-1.1"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "verify_tests_passing",
        "action": "Run tests to confirm green state before refactoring",
        "command": "bash(npm test -- tests/[feature])",
        "output_to": "test_status",
        "on_error": "fail"
      }
    ]
  }
}
```

**Step 4: Generate TDD_PLAN.md**

```markdown
# TDD Implementation Plan - [Session ID]

## Features and Test Chains

### Feature 1: [Feature Name]
**TDD Chain**: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1

**Red Phase (TEST-1.1)**
- Write failing test for [specific behavior]
- Test assertions: [list]

**Green Phase (IMPL-1.1)**
- Implement minimal solution
- Dependencies: TEST-1.1 must fail first

**Refactor Phase (REFACTOR-1.1)**
- Improve: [specific improvements]
- Constraint: All tests must remain green

[Repeat for each feature]

## Execution Order
1. TEST-1.1 → IMPL-1.1 → REFACTOR-1.1
2. TEST-2.1 → IMPL-2.1 → REFACTOR-2.1
...

## TDD Compliance Checkpoints
- [ ] Each feature starts with failing test
- [ ] Implementation passes all tests
- [ ] Refactoring maintains green tests
- [ ] No implementation before tests
```

**Step 5: Generate TODO_LIST.md**

Standard todo list with TDD phase indicators:

```markdown
## Pending Tasks
- [ ] TEST-1.1: Write failing test for [feature] (RED)
- [ ] IMPL-1.1: Implement [feature] to pass tests (GREEN) [depends: TEST-1.1]
- [ ] REFACTOR-1.1: Refactor [feature] implementation (REFACTOR) [depends: IMPL-1.1]
```

### Validation Rules

1. **Chain Completeness**: Every TEST task must have corresponding IMPL and REFACTOR tasks
2. **Dependency Enforcement**:
   - IMPL depends_on TEST
   - REFACTOR depends_on IMPL
3. **Agent Assignment**:
   - TEST tasks → `@code-review-test-agent`
   - IMPL/REFACTOR tasks → `@code-developer`
4. **Meta Fields**:
   - `meta.tdd_phase` must be "red", "green", or "refactor"
   - `meta.type` must align with phase

---

## 3. /workflow:tdd-verify Command

### Purpose
Verify TDD workflow compliance, test coverage, and Red-Green-Refactor cycle execution.

### Command Specification

```yaml
name: tdd-verify
description: Verify TDD workflow compliance and generate quality report
usage: /workflow:tdd-verify [session-id]
argument-hint: "[WFS-session-id]"
examples:
  - /workflow:tdd-verify
  - /workflow:tdd-verify WFS-auth
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
```

### Execution Flow (4 Phases)

**Phase 1: Session Discovery**
```bash
# Auto-detect or use provided session
find .workflow/ -name '.active-*' | head -1 | sed 's/.*active-//'
```
- Extract: `sessionId`

**Phase 2: Task Chain Validation**
```bash
# Bash script to validate TDD structure
find .workflow/[sessionId]/.task/ -name '*.json' -exec jq -r '.meta.tdd_phase' {} \;
```
- Verify: TEST → IMPL → REFACTOR chains exist
- Verify: Dependencies are correct
- Extract: Chain validation report

**Phase 3: Test Execution Analysis**
```bash
/workflow:tools:tdd-coverage-analysis --session [sessionId]
```
- Run tests from TEST tasks
- Verify IMPL tasks made tests pass
- Check REFACTOR tasks maintained green tests
- Extract: Test execution report

**Phase 4: Compliance Report Generation**
```bash
# Gemini analysis
cd project-root && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate TDD compliance report
TASK: Analyze TDD workflow execution and generate quality report
CONTEXT: @{.workflow/[sessionId]/.task/*.json,.workflow/[sessionId]/.summaries/*}
EXPECTED:
- TDD compliance score
- Chain completeness verification
- Test coverage analysis
- Quality recommendations
- Red-Green-Refactor cycle validation
RULES: Focus on TDD best practices and workflow adherence
" > .workflow/[sessionId]/TDD_COMPLIANCE_REPORT.md
```

### TodoWrite Pattern

```javascript
TodoWrite({todos: [
  {"content": "Identify target session", "status": "in_progress", "activeForm": "Identifying target session"},
  {"content": "Validate task chain structure", "status": "pending", "activeForm": "Validating task chain structure"},
  {"content": "Analyze test execution", "status": "pending", "activeForm": "Analyzing test execution"},
  {"content": "Generate compliance report", "status": "pending", "activeForm": "Generating compliance report"}
]})
```

### Output Structure

```
TDD Verification Report - Session: [sessionId]

## Chain Validation
✅ Feature 1: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1 (Complete)
✅ Feature 2: TEST-2.1 → IMPL-2.1 → REFACTOR-2.1 (Complete)
⚠️  Feature 3: TEST-3.1 → IMPL-3.1 (Missing REFACTOR phase)

## Test Execution
✅ All TEST tasks produced failing tests
✅ All IMPL tasks made tests pass
✅ All REFACTOR tasks maintained green tests

## Compliance Score: 95/100

Detailed report: .workflow/[sessionId]/TDD_COMPLIANCE_REPORT.md

Recommendations:
- Complete missing REFACTOR-3.1 task
- Consider additional edge case tests for Feature 2
```

---

## 4. /workflow:tools:tdd-coverage-analysis Command

### Purpose
Analyze test coverage and execution results for TDD workflow validation.

### Command Specification

```yaml
name: tdd-coverage-analysis
description: Analyze test coverage and TDD cycle execution
usage: /workflow:tools:tdd-coverage-analysis --session <session-id>
argument-hint: "--session WFS-xxx"
examples:
  - /workflow:tools:tdd-coverage-analysis --session WFS-auth
allowed-tools: Read(*), Write(*), Bash(*)
```

### Implementation Flow

**Step 1: Extract Test Tasks**
```bash
find .workflow/[sessionId]/.task/ -name 'TEST-*.json' -exec jq -r '.context.focus_paths[]' {} \;
```

**Step 2: Run Test Suite**
```bash
npm test -- --coverage --json > .workflow/[sessionId]/.process/test-results.json
```

**Step 3: Analyze Coverage**
```bash
jq '.coverage' .workflow/[sessionId]/.process/test-results.json > .workflow/[sessionId]/.process/coverage-report.json
```

**Step 4: Verify TDD Cycle**
For each chain:
- Check TEST task created test files
- Check IMPL task made tests pass
- Check REFACTOR task didn't break tests

**Step 5: Generate Analysis Report**
```markdown
# Test Coverage Analysis

## Coverage Metrics
- Line Coverage: X%
- Branch Coverage: Y%
- Function Coverage: Z%

## TDD Cycle Verification
- Red Phase: X tests written and failed initially
- Green Phase: Y implementations made tests pass
- Refactor Phase: Z refactorings maintained green tests

## Gaps Identified
- [List any missing test coverage]
- [List any incomplete TDD cycles]
```

---

## Integration with Existing System

### Data Flow Diagram

```
User Input
    ↓
/workflow:tdd-plan "feature description"
    ↓
Phase 1: /workflow:session:start --auto "TDD: ..."
    ↓ sessionId
Phase 2: /workflow:tools:context-gather --session sessionId
    ↓ contextPath
Phase 3: /workflow:tools:concept-enhanced --session sessionId --context contextPath
    ↓ ANALYSIS_RESULTS.md
Phase 4: /workflow:tools:task-generate-tdd --session sessionId
    ↓ TEST-*.json, IMPL-*.json, REFACTOR-*.json
    ↓ TDD_PLAN.md, IMPL_PLAN.md, TODO_LIST.md
Phase 5: Internal validation
    ↓
Return summary
    ↓
/workflow:execute (user executes tasks)
    ↓
/workflow:tdd-verify (user verifies compliance)
    ↓
Phase 1: Session discovery
    ↓ sessionId
Phase 2: Task chain validation
    ↓ validation report
Phase 3: /workflow:tools:tdd-coverage-analysis
    ↓ coverage report
Phase 4: Gemini compliance report
    ↓ TDD_COMPLIANCE_REPORT.md
Return verification summary
```

### File Structure

```
.workflow/
└── WFS-[session-id]/
    ├── ANALYSIS_RESULTS.md          # From concept-enhanced
    ├── IMPL_PLAN.md                 # Standard implementation plan
    ├── TDD_PLAN.md                  # TDD-specific plan (new)
    ├── TODO_LIST.md                 # Task list with TDD phases
    ├── TDD_COMPLIANCE_REPORT.md     # Verification report (new)
    ├── .task/
    │   ├── TEST-1.1.json
    │   ├── IMPL-1.1.json
    │   ├── REFACTOR-1.1.json
    │   └── ...
    ├── .summaries/
    │   ├── TEST-1.1-summary.md
    │   ├── IMPL-1.1-summary.md
    │   └── ...
    └── .process/
        ├── TDD_TASK_BREAKDOWN.md    # Gemini TDD breakdown
        ├── test-results.json         # Test execution results
        └── coverage-report.json      # Coverage data
```

### Relationship with Existing Commands

- **Reuses**: `/workflow:session:start`, `/workflow:tools:context-gather`, `/workflow:tools:concept-enhanced`
- **Extends**: Adds TDD-specific task generation and verification
- **Compatible with**: `/workflow:execute`, `/workflow:status`, `/workflow:resume`
- **Complements**: `/workflow:test-gen` (TDD is proactive, test-gen is reactive)

---

## Implementation Checklist

### Command Files to Create
- [ ] `.claude/commands/workflow/tdd-plan.md`
- [ ] `.claude/commands/workflow/tdd-verify.md`
- [ ] `.claude/commands/workflow/tools/task-generate-tdd.md`
- [ ] `.claude/commands/workflow/tools/tdd-coverage-analysis.md`

### Template Files to Create
- [ ] `.claude/workflows/cli-templates/prompts/development/tdd-test.txt`
- [ ] `.claude/workflows/cli-templates/prompts/development/tdd-impl.txt`
- [ ] `.claude/workflows/cli-templates/prompts/development/tdd-refactor.txt`

### Documentation to Update
- [ ] `.claude/workflows/workflow-architecture.md` - Add TDD workflow section
- [ ] `.claude/workflows/task-core.md` - Document `meta.tdd_phase` field
- [ ] `README.md` - Add TDD workflow usage examples

### Testing Requirements
- [ ] Test tdd-plan with simple feature
- [ ] Verify task chain dependencies
- [ ] Test tdd-verify compliance checking
- [ ] Validate integration with workflow:execute
- [ ] Test error handling and validation

---

## Usage Examples

### Example 1: Create TDD Workflow
```bash
# Plan TDD workflow
/workflow:tdd-plan "Implement user registration with email validation"

# Execute tasks in order
/workflow:execute

# Verify TDD compliance
/workflow:tdd-verify
```

### Example 2: Agent Mode
```bash
# Use agent for autonomous TDD planning
/workflow:tdd-plan --agent requirements.md

# Execute with automatic task execution
/workflow:execute
```

### Example 3: Issue-Based TDD
```bash
# Create TDD workflow from issue
/workflow:tdd-plan ISS-042

# Execute and verify
/workflow:execute
/workflow:tdd-verify WFS-issue-042
```

---

## Benefits

1. **Enforced TDD Discipline**: Dependencies ensure tests come before implementation
2. **Clear Structure**: Red-Green-Refactor phases are explicit
3. **Quality Verification**: Built-in compliance checking
4. **Existing Architecture**: Reuses proven workflow patterns
5. **Agent Support**: Can be fully automated or manually controlled
6. **Comprehensive Reporting**: Clear visibility into TDD adherence
7. **Flexible**: Works with existing workflow commands
